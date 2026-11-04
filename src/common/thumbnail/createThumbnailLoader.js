// 批量缩略图加载器：同一轮渲染内的 id 合并成一批，满 BATCH_SIZE 个或下一 tick 发送，
// 服务端在结果里用 status 区分 ok / none / pending，接口固定返回 200，控制台不再出现大量 404。
const BATCH_SIZE = 10;
// 同时最多 2 个批次在途，避免一屏文件把服务端生成队列打满
const MAX_BATCH_INFLIGHT = 2;
const MAX_CACHE_SIZE = 500;
// pending（服务端排队中或超过等待上限）最多重试次数，超过后按无缩略图处理
const MAX_PENDING_RETRY = 5;
const PENDING_RETRY_DELAY = 1000;
const COLLECT_DELAY = 0;
// 从未成功过且连续硬失败（网络错误 / 5xx）达到该次数，视为服务端不可用
const MAX_FAILURES_BEFORE_ANY_SUCCESS = 5;

const STATUS_OK = 'ok';
const STATUS_PENDING = 'pending';

const TASK_IDLE = 'idle';
const TASK_QUEUED = 'queued';
const TASK_SENT = 'sent';

/**
 * 缩略图批量加载器：
 * - request(id) 入队，同一轮渲染内的 id 合并成一次 POST；
 * - ok 直接把 data URL 作为 src 并写入 LRU 缓存（不需要 objectURL，也就没有 revoke）；
 * - none 记为无缩略图，组件回退为类型图标且不再请求；
 * - pending 1 秒后重新入队，最多重试 MAX_PENDING_RETRY 次；
 * - 判定服务端不支持（路由不存在 / 非 JSON 响应 / 宿主 code 不为 0）后整体停用，后续不再发请求。
 */
const createThumbnailLoader = ({ ajax, url }) => {
  const cache = new Map();
  const pending = [];
  const unsettled = new Set();
  let inflight = 0;
  let timer = null;
  let disabled = !url || typeof ajax !== 'function';
  let hasSuccess = false;
  let hardFailures = 0;

  const remember = (id, value) => {
    cache.delete(id);
    cache.set(id, { value });
    if (cache.size <= MAX_CACHE_SIZE) {
      return;
    }
    for (const [key, entry] of cache) {
      if (cache.size <= MAX_CACHE_SIZE) {
        break;
      }
      if ('value' in entry) {
        cache.delete(key);
      }
    }
  };

  const settle = (task, value, { persist = true } = {}) => {
    unsettled.delete(task);
    task.state = TASK_IDLE;
    if (persist) {
      remember(task.id, value);
    } else if (cache.get(task.id)?.task === task) {
      // 硬失败不写长期缓存，下次挂载会重新尝试
      cache.delete(task.id);
    }
    task.listeners.forEach(listener => listener(value));
    task.listeners.clear();
  };

  const disable = () => {
    if (disabled) {
      return;
    }
    disabled = true;
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    pending.splice(0);
    Array.from(unsettled).forEach(task => settle(task, null));
  };

  const fetchBatch = async ids => {
    const response = await ajax({
      url,
      method: 'POST',
      data: { ids },
      showError: false
    });
    const status = response?.status ?? 200;
    // 批量接口固定返回 200，出现 404 只可能是路由不存在（3.1.x 及更早的服务端）
    if (status === 404) {
      return { type: 'fatal' };
    }
    if (status !== 200) {
      return { type: 'error' };
    }
    const body = response?.data;
    // 非 JSON（例如开发服务器把未知路由回退成 index.html）或宿主 code 不为 0
    if (!body || typeof body !== 'object' || body.code !== 0) {
      return { type: 'fatal' };
    }
    return { type: 'ok', data: body.data || {} };
  };

  function flush() {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    while (!disabled && inflight < MAX_BATCH_INFLIGHT && pending.length) {
      const tasks = pending.splice(0, BATCH_SIZE);
      tasks.forEach(task => {
        task.state = TASK_SENT;
      });
      send(tasks);
    }
  }

  function send(tasks) {
    inflight++;
    fetchBatch(tasks.map(task => task.id))
      .catch(() => ({ type: 'error' }))
      .then(outcome => applyResult(tasks, outcome))
      .finally(() => {
        inflight--;
        flush();
      });
  }

  const schedule = () => {
    if (timer !== null) {
      return;
    }
    timer = setTimeout(() => {
      timer = null;
      flush();
    }, COLLECT_DELAY);
  };

  const enqueue = task => {
    if (disabled || task.cancelled) {
      return;
    }
    task.state = TASK_QUEUED;
    pending.push(task);
    if (pending.length >= BATCH_SIZE) {
      flush();
    } else {
      schedule();
    }
  };

  const retryLater = task => {
    setTimeout(() => {
      if (disabled) {
        settle(task, null);
        return;
      }
      if (task.cancelled || task.state !== TASK_IDLE) {
        return;
      }
      enqueue(task);
    }, PENDING_RETRY_DELAY);
  };

  const applyResult = (tasks, outcome) => {
    if (disabled) {
      return;
    }
    if (outcome.type === 'fatal') {
      disable();
      return;
    }
    if (outcome.type === 'error') {
      tasks.forEach(task => settle(task, null, { persist: false }));
      if (!hasSuccess && ++hardFailures >= MAX_FAILURES_BEFORE_ANY_SUCCESS) {
        disable();
      }
      return;
    }
    tasks.forEach(task => {
      const entry = outcome.data[task.id];
      if (entry?.status === STATUS_OK && typeof entry.data === 'string') {
        hasSuccess = true;
        hardFailures = 0;
        settle(task, entry.data);
        return;
      }
      if (entry?.status === STATUS_PENDING) {
        task.retries++;
        if (task.retries <= MAX_PENDING_RETRY) {
          task.state = TASK_IDLE;
          retryLater(task);
          return;
        }
      }
      // none、结果里缺少该 id、重试次数用尽：都当作没有缩略图
      settle(task, null);
    });
  };

  /** 已知结果：string 为图片地址，null 为无缩略图，undefined 为未知 */
  const peek = id => {
    if (disabled) {
      return null;
    }
    const entry = cache.get(id);
    return entry && 'value' in entry ? entry.value : undefined;
  };

  /** 订阅缩略图结果，返回取消函数；未发送的请求在无订阅者时会被移出队列 */
  const request = (id, listener) => {
    if (disabled) {
      listener(null);
      return () => {};
    }
    const entry = cache.get(id);
    if (entry && 'value' in entry) {
      listener(entry.value);
      return () => {};
    }
    let task = entry?.task;
    if (!task) {
      task = { id, listeners: new Set(), retries: 0, state: TASK_IDLE, cancelled: false };
      cache.set(id, { task });
      unsettled.add(task);
    }
    task.cancelled = false;
    task.listeners.add(listener);
    if (task.state === TASK_IDLE) {
      enqueue(task);
    }
    return () => {
      task.listeners.delete(listener);
      // 已发出的批次不撤回（结果会写进缓存），其余状态没人订阅就直接丢掉，避免白跑一次请求
      if (task.listeners.size > 0 || task.state === TASK_SENT) {
        return;
      }
      task.cancelled = true;
      task.state = TASK_IDLE;
      const index = pending.indexOf(task);
      index > -1 && pending.splice(index, 1);
      unsettled.delete(task);
      if (cache.get(id)?.task === task) {
        cache.delete(id);
      }
    };
  };

  return { peek, request, isDisabled: () => disabled };
};

const loaders = new WeakMap();

/** 同一个 ajax + url 共享一个 loader，页面内多个组件复用缓存与「不支持」判定 */
export const getThumbnailLoader = ({ ajax, url }) => {
  if (typeof ajax !== 'function' || !url) {
    return null;
  }
  let byUrl = loaders.get(ajax);
  if (!byUrl) {
    byUrl = new Map();
    loaders.set(ajax, byUrl);
  }
  if (!byUrl.has(url)) {
    byUrl.set(url, createThumbnailLoader({ ajax, url }));
  }
  return byUrl.get(url);
};

export default createThumbnailLoader;
