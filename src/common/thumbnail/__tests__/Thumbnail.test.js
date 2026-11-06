import { act } from 'react';
import { createRoot } from 'react-dom/client';
import Thumbnail from '../Thumbnail';

global.IS_REACT_ACT_ENVIRONMENT = true;

const DATA_URL = 'data:image/webp;base64,dGVzdA==';
const fallback = <span data-testid="type-icon">类型图标</span>;

let container;
let root;

const render = node => act(() => root.render(node));

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  jest.clearAllMocks();
});

test('没有加载器或 id 时渲染 fallback', () => {
  render(<Thumbnail fallback={fallback} id="1" />);
  expect(container.querySelector('[data-testid="type-icon"]')).not.toBeNull();
  expect(container.querySelector('img')).toBeNull();

  const loader = { peek: jest.fn(), request: jest.fn(() => jest.fn()) };
  render(<Thumbnail loader={loader} id="" fallback={fallback} />);
  expect(container.querySelector('[data-testid="type-icon"]')).not.toBeNull();
  expect(loader.request).not.toHaveBeenCalled();
});

test('服务端判定为无缩略图时保持 fallback', () => {
  const loader = {
    peek: jest.fn(() => undefined),
    request: jest.fn((id, listener) => {
      listener(null);
      return jest.fn();
    })
  };
  render(<Thumbnail loader={loader} id="1" fallback={fallback} />);

  expect(container.querySelector('[data-testid="type-icon"]')).not.toBeNull();
  expect(container.querySelector('img')).toBeNull();
});

test('缓存命中时直接渲染缩略图', () => {
  const loader = { peek: jest.fn(() => DATA_URL), request: jest.fn(() => jest.fn()) };
  render(<Thumbnail loader={loader} id="1" fallback={fallback} className="cell-thumb" />);

  expect(container.querySelector('img')).toHaveAttribute('src', DATA_URL);
  expect(container.querySelector('img')).toHaveClass('cell-thumb', 'thumbnail');
  expect(container.querySelector('[data-testid="type-icon"]')).toBeNull();
});

test('缩略图异步到达后替换 fallback', () => {
  let emit;
  const loader = {
    peek: jest.fn(() => undefined),
    request: jest.fn((id, listener) => {
      emit = listener;
      return jest.fn();
    })
  };
  render(<Thumbnail loader={loader} id="1" fallback={fallback} />);
  expect(container.querySelector('[data-testid="type-icon"]')).not.toBeNull();

  act(() => emit(DATA_URL));

  expect(container.querySelector('[data-testid="type-icon"]')).toBeNull();
  expect(container.querySelector('img')).toHaveAttribute('src', DATA_URL);
});

test('图片加载出错时回退 fallback', () => {
  const loader = { peek: jest.fn(() => 'broken-url'), request: jest.fn(() => jest.fn()) };
  render(<Thumbnail loader={loader} id="1" fallback={fallback} />);

  act(() => {
    container.querySelector('img').dispatchEvent(new Event('error'));
  });

  expect(container.querySelector('img')).toBeNull();
  expect(container.querySelector('[data-testid="type-icon"]')).not.toBeNull();
});

test('size 属性同时约束缩略图宽高', () => {
  const loader = { peek: jest.fn(() => DATA_URL), request: jest.fn(() => jest.fn()) };
  render(<Thumbnail loader={loader} id="1" fallback={fallback} size={36} />);

  expect(container.querySelector('img')).toHaveStyle({ width: '36px', height: '36px' });
});

test('卸载时取消订阅', () => {
  const cancel = jest.fn();
  const loader = { peek: jest.fn(() => undefined), request: jest.fn(() => cancel) };
  render(<Thumbnail loader={loader} id="1" fallback={fallback} />);

  act(() => root.unmount());
  root = createRoot(container);

  expect(cancel).toHaveBeenCalledTimes(1);
});

test('id 变化时重新订阅并按新 id 取值', () => {
  const loader = {
    peek: jest.fn(id => (id === 'b' ? DATA_URL : undefined)),
    request: jest.fn(() => jest.fn())
  };
  render(<Thumbnail loader={loader} id="a" fallback={fallback} />);
  expect(container.querySelector('[data-testid="type-icon"]')).not.toBeNull();

  render(<Thumbnail loader={loader} id="b" fallback={fallback} />);

  expect(container.querySelector('img')).toHaveAttribute('src', DATA_URL);
  expect(loader.request).toHaveBeenCalledTimes(2);
  expect(loader.request).toHaveBeenLastCalledWith('b', expect.any(Function));
});
