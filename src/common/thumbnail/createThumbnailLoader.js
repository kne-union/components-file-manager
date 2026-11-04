const MAX_CONCURRENT = 10;
const MAX_CACHE_SIZE = 500;
const MAX_BUSY_RETRY = 2;
const MAX_RETRY_DELAY = 10000;
// 从未成功过且连续硬失败（网络错误 / 5xx）达到该次数，视为服务端不可用
const MAX_FAILURES_BEFORE_ANY_SUCCESS = 5;

const ROUTE_NOT_FOUND = /^Route\s.+\snot found/i;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const normalizeBlob = response => {
  let blob = response?.data;
  if (blob && !(blob instanceof Blob) && blob.data instanceof Blob) {
    blob = blob.data;
  }
  return blob instanceof Blob ? blob : null;
};

const readText = blob =>
  typeof blob.text === 'function'
    ? blob.text()
    : new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(blob);
      });

const readJson = async blob => {
  try {
    return JSON.parse(await readText(blob));
  } catch (e) {
    return null;
  }
};

const getHeader = (response, name) => {
  const headers = response?.headers;
  if (!headers) {
    return undefined;
  }
  return typeof headers.get === 'function' ? headers.get(name) : headers[name] || headers[name.toLowerCase()];
};

/**
 * 缩略图请求队列：最多 MAX_CONCURRENT 个并发；单个文件失败回退为 null；
 * 判定服务端不支持（路由不存在 / 非图片响应 / 持续不可用）后整体停用，后续不再发请求。
 */
const createThumbnailLoader = ({ ajax, url }) => {
  const cache = new Map();
  const queue = [];
  let active = 0;
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
        entry.value && URL.revokeObjectURL(entry.value);
      }
    }
  };

  const settle = (task, value) => {
    remember(task.id, value);
    task.listeners.forEach(listener => listener(value));
    task.listeners.clear();
  };

  const disable = () => {
    disabled = true;
    queue.splice(0).forEach(task => settle(task, null));
  };

  const fetchOnce = async id => {
    const response = await ajax({
      url: url.replace(/{([\s\S]+?)}/g, (match, name) => (name === 'id' ? encodeURIComponent(id) : match)),
      method: 'GET',
      responseType: 'blob',
      showError: false
    });
    const status = response?.status ?? 200;
    const blob = normalizeBlob(response);

    if (status === 200) {
      if (blob && /^image\//.test(blob.type)) {
        return { type: 'success', value: URL.createObjectURL(blob) };
      }
      // 例如开发服务器把未知路由回退成 index.html
      return { type: 'unsupported' };
    }
    if (status === 404) {
      const json = blob ? await readJson(blob) : null;
      return ROUTE_NOT_FOUND.test(json?.message || '') ? { type: 'unsupported' } : { type: 'missing' };
    }
    if (status === 503) {
      const seconds = Number(getHeader(response, 'retry-after'));
      return { type: 'busy', delay: Math.min(Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 1000, MAX_RETRY_DELAY) };
    }
    if (status >= 500) {
      return { type: 'error' };
    }
    return { type: 'missing' };
  };

  const run = async task => {
    let result;
    for (let attempt = 0; ; attempt++) {
      try {
        result = await fetchOnce(task.id);
      } catch (e) {
        result = { type: 'error' };
      }
      if (result.type !== 'busy' || attempt >= MAX_BUSY_RETRY || disabled) {
        break;
      }
      await sleep(result.delay);
    }

    if (result.type === 'success') {
      hasSuccess = true;
      hardFailures = 0;
      settle(task, result.value);
      return;
    }
    settle(task, null);
    if (result.type === 'unsupported') {
      disable();
    } else if (result.type === 'error' && !hasSuccess && ++hardFailures >= MAX_FAILURES_BEFORE_ANY_SUCCESS) {
      disable();
    }
  };

  const start = task => {
    task.started = true;
    active++;
    run(task).finally(() => {
      active--;
      pump();
    });
  };

  const pump = () => {
    while (!disabled && active < MAX_CONCURRENT && queue.length) {
      start(queue.shift());
    }
  };

  /** 已知结果：string 为图片地址，null 为无缩略图，undefined 为未知 */
  const peek = id => {
    if (disabled) {
      return null;
    }
    const entry = cache.get(id);
    return entry && 'value' in entry ? entry.value : undefined;
  };

  /** 订阅缩略图结果，返回取消函数；未开始的请求在无订阅者时会被移出队列 */
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
      task = { id, listeners: new Set(), started: false };
      cache.set(id, { task });
      queue.push(task);
    }
    task.listeners.add(listener);
    pump();
    return () => {
      task.listeners.delete(listener);
      if (!task.started && task.listeners.size === 0) {
        const index = queue.indexOf(task);
        index > -1 && queue.splice(index, 1);
        if (cache.get(id)?.task === task) {
          cache.delete(id);
        }
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
