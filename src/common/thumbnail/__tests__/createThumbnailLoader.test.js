import createThumbnailLoader from '../createThumbnailLoader';

const URL_TPL = '/api/v1/static/thumbnail/{id}';

const imageResponse = () => ({ status: 200, data: new Blob(['x'], { type: 'image/webp' }) });
const jsonResponse = (status, body, headers) => ({
  status,
  headers,
  data: new Blob([JSON.stringify(body)], { type: 'application/json' })
});

const load = (loader, id) => new Promise(resolve => loader.request(id, resolve));

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

beforeAll(() => {
  let seq = 0;
  URL.createObjectURL = () => `blob:thumb-${++seq}`;
  URL.revokeObjectURL = () => {};
});

test('成功返回 objectURL，并缓存结果', async () => {
  const ajax = jest.fn(async () => imageResponse());
  const loader = createThumbnailLoader({ ajax, url: URL_TPL });
  const src = await load(loader, 'a/b');
  expect(src).toMatch(/^blob:/);
  expect(ajax).toHaveBeenCalledWith(expect.objectContaining({ url: '/api/v1/static/thumbnail/a%2Fb', responseType: 'blob', showError: false }));
  expect(loader.peek('a/b')).toBe(src);
  await load(loader, 'a/b');
  expect(ajax).toHaveBeenCalledTimes(1);
});

test('业务 404 只回退当前文件', async () => {
  const ajax = jest.fn(async ({ url }) => (url.endsWith('/bad') ? jsonResponse(404, { message: '该文件不支持缩略图' }) : imageResponse()));
  const loader = createThumbnailLoader({ ajax, url: URL_TPL });
  expect(await load(loader, 'bad')).toBeNull();
  expect(await load(loader, 'good')).toMatch(/^blob:/);
  expect(loader.isDisabled()).toBe(false);
});

test('路由不存在时整体停用，不再请求', async () => {
  const ajax = jest.fn(async () => jsonResponse(404, { message: 'Route GET:/api/v1/static/thumbnail/1 not found', statusCode: 404 }));
  const loader = createThumbnailLoader({ ajax, url: URL_TPL });
  expect(await load(loader, '1')).toBeNull();
  expect(loader.isDisabled()).toBe(true);
  expect(await load(loader, '2')).toBeNull();
  expect(ajax).toHaveBeenCalledTimes(1);
});

test('200 但不是图片（如 index.html 回退）时整体停用', async () => {
  const ajax = jest.fn(async () => ({ status: 200, data: new Blob(['<html>'], { type: 'text/html' }) }));
  const loader = createThumbnailLoader({ ajax, url: URL_TPL });
  expect(await load(loader, '1')).toBeNull();
  expect(loader.isDisabled()).toBe(true);
});

test('没有配置接口时直接回退', async () => {
  const loader = createThumbnailLoader({ ajax: jest.fn(), url: undefined });
  expect(await load(loader, '1')).toBeNull();
  expect(loader.peek('1')).toBeNull();
});

test('503 按 Retry-After 重试', async () => {
  jest.useFakeTimers();
  try {
    let calls = 0;
    const ajax = jest.fn(async () => (++calls === 1 ? jsonResponse(503, { message: 'busy' }, { 'retry-after': '1' }) : imageResponse()));
    const loader = createThumbnailLoader({ ajax, url: URL_TPL });
    const promise = load(loader, '1');
    for (let i = 0; i < 5 && ajax.mock.calls.length < 2; i++) {
      await Promise.resolve();
      jest.advanceTimersByTime(1000);
    }
    expect(await promise).toMatch(/^blob:/);
    expect(ajax).toHaveBeenCalledTimes(2);
  } finally {
    jest.useRealTimers();
  }
});

test('从未成功且连续网络错误达到阈值时停用', async () => {
  const ajax = jest.fn(async () => {
    throw new Error('network');
  });
  const loader = createThumbnailLoader({ ajax, url: URL_TPL });
  const results = await Promise.all(['1', '2', '3', '4', '5', '6'].map(id => load(loader, id)));
  expect(results.every(value => value === null)).toBe(true);
  expect(loader.isDisabled()).toBe(true);
  expect(ajax.mock.calls.length).toBeLessThanOrEqual(6);
});

test('最多 10 个并发，未开始的请求可取消', async () => {
  const pending = [];
  const ajax = jest.fn(() => new Promise(resolve => pending.push(resolve)));
  const loader = createThumbnailLoader({ ajax, url: URL_TPL });
  const cancels = Array.from({ length: 12 }, (_, i) => loader.request(String(i), () => {}));
  expect(ajax).toHaveBeenCalledTimes(10);

  cancels[11]();
  pending.shift()(imageResponse());
  await flush();
  expect(ajax).toHaveBeenCalledTimes(11);
  expect(ajax.mock.calls[10][0].url).toMatch(/\/10$/);

  pending.splice(0).forEach(resolve => resolve(imageResponse()));
  await flush();
  expect(ajax).toHaveBeenCalledTimes(11);
});
