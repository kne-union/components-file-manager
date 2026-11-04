import createThumbnailLoader from '../createThumbnailLoader';

const BATCH_URL = '/api/v1/static/thumbnails';

const DATA_URL = 'data:image/webp;base64,dGVzdA==';
const PENDING_RETRY_DELAY = 1000;

const okResponse = data => ({ status: 200, data: { code: 0, data } });

// 一批里每个 id 都是 ok
const allOk = ids =>
  okResponse(
    ids.reduce((result, id) => {
      result[id] = { status: 'ok', data: DATA_URL };
      return result;
    }, {})
  );

const load = (loader, id) => new Promise(resolve => loader.request(id, resolve));

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

// 推进假定时器并让 ajax / promise 链的微任务跑完。
// advanceTimersByTime 不会执行本次推进期间新排的定时器（如收集用的 0ms 定时器），所以要再补几轮 0 推进。
const tick = async (ms = PENDING_RETRY_DELAY) => {
  for (let i = 0; i < 4; i++) {
    jest.advanceTimersByTime(i === 0 ? ms : 0);
    for (let j = 0; j < 4; j++) {
      await Promise.resolve();
    }
  }
};

test('同一轮渲染内的多个 id 合并为一次请求', async () => {
  const ajax = jest.fn(async ({ data }) => allOk(data.ids));
  const loader = createThumbnailLoader({ ajax, url: BATCH_URL });
  const results = await Promise.all(['a', 'b', 'c'].map(id => load(loader, id)));

  expect(results).toEqual([DATA_URL, DATA_URL, DATA_URL]);
  expect(ajax).toHaveBeenCalledTimes(1);
  expect(ajax).toHaveBeenCalledWith(expect.objectContaining({ url: BATCH_URL, method: 'POST', data: { ids: ['a', 'b', 'c'] }, showError: false }));
  expect(loader.peek('a')).toBe(DATA_URL);
});

test('相同 id 只出现在请求里一次', async () => {
  const ajax = jest.fn(async ({ data }) => allOk(data.ids));
  const loader = createThumbnailLoader({ ajax, url: BATCH_URL });
  await Promise.all([load(loader, 'a'), load(loader, 'a'), load(loader, 'a')]);
  expect(ajax).toHaveBeenCalledTimes(1);
  expect(ajax.mock.calls[0][0].data.ids).toEqual(['a']);
});

test('超过 10 个拆成多个批次，同时在途不超过 2 个', async () => {
  const resolvers = [];
  const ajax = jest.fn(
    ({ data }) =>
      new Promise(resolve => {
        resolvers.push(() => resolve(allOk(data.ids)));
      })
  );
  const loader = createThumbnailLoader({ ajax, url: BATCH_URL });
  Array.from({ length: 25 }, (_, i) => loader.request(`id-${i}`, () => {}));
  await flush();

  expect(ajax).toHaveBeenCalledTimes(2);
  expect(ajax.mock.calls[0][0].data.ids).toHaveLength(10);
  expect(ajax.mock.calls[1][0].data.ids).toHaveLength(10);

  // 前两批仍在途时不会发第三批
  expect(ajax).toHaveBeenCalledTimes(2);

  resolvers.splice(0).forEach(resolve => resolve());
  await flush();
  expect(ajax).toHaveBeenCalledTimes(3);
  expect(ajax.mock.calls[2][0].data.ids).toHaveLength(5);
});

test('none 记为无缩略图且不再请求', async () => {
  const ajax = jest.fn(async ({ data }) =>
    okResponse(
      data.ids.reduce((result, id) => {
        result[id] = id === 'bad' ? { status: 'none' } : { status: 'ok', data: DATA_URL };
        return result;
      }, {})
    )
  );
  const loader = createThumbnailLoader({ ajax, url: BATCH_URL });
  expect(await load(loader, 'bad')).toBeNull();
  expect(loader.peek('bad')).toBeNull();

  expect(await load(loader, 'bad')).toBeNull();
  expect(ajax).toHaveBeenCalledTimes(1);
});

test('pending 1 秒后重试，成功后缓存', async () => {
  jest.useFakeTimers();
  try {
    let calls = 0;
    const ajax = jest.fn(async ({ data }) => {
      calls++;
      return okResponse(
        data.ids.reduce((result, id) => {
          result[id] = calls === 1 ? { status: 'pending' } : { status: 'ok', data: DATA_URL };
          return result;
        }, {})
      );
    });
    const loader = createThumbnailLoader({ ajax, url: BATCH_URL });
    const promise = load(loader, 'a');
    for (let i = 0; i < 4; i++) {
      await tick();
    }

    expect(await promise).toBe(DATA_URL);
    expect(ajax).toHaveBeenCalledTimes(2);
  } finally {
    jest.useRealTimers();
  }
});

test('pending 重试 5 次后按无缩略图处理', async () => {
  jest.useFakeTimers();
  try {
    const ajax = jest.fn(async ({ data }) => okResponse(data.ids.reduce((result, id) => ({ ...result, [id]: { status: 'pending' } }), {})));
    const loader = createThumbnailLoader({ ajax, url: BATCH_URL });
    let settled = false;
    const promise = load(loader, 'a').then(value => {
      settled = true;
      return value;
    });
    for (let i = 0; i < 20 && !settled; i++) {
      await tick();
    }
    expect(await promise).toBeNull();
    // 首次请求 + 5 次重试
    expect(ajax).toHaveBeenCalledTimes(6);
    expect(loader.isDisabled()).toBe(false);
  } finally {
    jest.useRealTimers();
  }
});

test('批量接口 404（旧版服务端）时整体停用，只发一次请求', async () => {
  const ajax = jest.fn(async () => ({
    status: 404,
    data: { statusCode: 404, error: 'Not Found', message: 'Route POST:/api/v1/static/thumbnails not found' }
  }));
  const loader = createThumbnailLoader({ ajax, url: BATCH_URL });
  expect(await load(loader, 'a')).toBeNull();
  expect(loader.isDisabled()).toBe(true);
  expect(await load(loader, 'b')).toBeNull();
  expect(ajax).toHaveBeenCalledTimes(1);
});

test('返回非 JSON（如 index.html 回退）或 code 不为 0 时整体停用', async () => {
  for (const body of ['<html></html>', { code: 500, msg: 'error' }]) {
    const ajax = jest.fn(async () => ({ status: 200, data: body }));
    const loader = createThumbnailLoader({ ajax, url: BATCH_URL });
    expect(await load(loader, 'a')).toBeNull();
    expect(loader.isDisabled()).toBe(true);
  }
});

test('网络错误时不写长期缓存，下次仍会重试', async () => {
  const ajax = jest.fn(async () => {
    throw new Error('network');
  });
  const loader = createThumbnailLoader({ ajax, url: BATCH_URL });
  expect(await load(loader, 'a')).toBeNull();
  expect(loader.peek('a')).toBeUndefined();
  expect(loader.isDisabled()).toBe(false);
});

test('从未成功且连续 5 次网络错误后停用', async () => {
  const ajax = jest.fn(async () => {
    throw new Error('network');
  });
  const loader = createThumbnailLoader({ ajax, url: BATCH_URL });
  for (let i = 0; i < 5; i++) {
    await load(loader, String(i));
  }
  expect(loader.isDisabled()).toBe(true);
});

test('没有配置接口时直接回退', async () => {
  const loader = createThumbnailLoader({ ajax: jest.fn(), url: undefined });
  expect(await load(loader, 'a')).toBeNull();
  expect(loader.peek('a')).toBeNull();
});

test('未发送的请求在取消订阅后不会再发出去', async () => {
  const ajax = jest.fn(async ({ data }) => allOk(data.ids));
  const loader = createThumbnailLoader({ ajax, url: BATCH_URL });
  const cancel = loader.request('a', () => {});
  cancel();
  await flush();
  expect(ajax).not.toHaveBeenCalled();
});
