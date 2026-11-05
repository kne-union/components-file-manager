import { act } from 'react';
import { createRoot } from 'react-dom/client';
import getColumns, { resolveFileType } from '../getColumns';

global.IS_REACT_ACT_ENVIRONMENT = true;

const DATA_URL = 'data:image/webp;base64,dGVzdA==';
const formatMessage = ({ id }) => id;
const preview = jest.fn();
const getUrl = item => `/files/${item.id}`;

const buildColumns = (extra = {}) => getColumns({ preview, getUrl, formatMessage, ...extra });
const findColumn = (columns, name) => columns.find(column => column.name === name);
const renderFilenameCell = (columns, item) => findColumn(columns, 'filename').getValueOf(item, {});

const createLoader = ({ peekValue, requestValue } = {}) => ({
  peek: jest.fn(() => peekValue),
  request: jest.fn((id, listener) => {
    if (requestValue !== undefined) {
      listener(requestValue);
    }
    return jest.fn();
  })
});

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

describe('resolveFileType', () => {
  test('取文件名最后一个后缀', () => {
    expect(resolveFileType({ filename: 'report.pdf' })).toBe('pdf');
    expect(resolveFileType({ filename: 'archive.tar.gz' })).toBe('gz');
  });

  test('没有后缀、文件名缺失时返回空字符串', () => {
    expect(resolveFileType({ filename: 'README' })).toBe('');
    expect(resolveFileType({})).toBe('');
    expect(resolveFileType(null)).toBe('');
  });

  test('支持原始文件名与隐藏文件', () => {
    expect(resolveFileType({ originName: 'resume.docx' })).toBe('docx');
    expect(resolveFileType({ filename: '.env' })).toBe('env');
  });
});

describe('getColumns 列配置', () => {
  test('文件类型列有默认宽度并单行省略，多数 MIME 不会换行', () => {
    const column = findColumn(buildColumns(), 'mimetype');
    expect(column.width).toBe(200);
    expect(column.ellipsis).toBe(true);
  });

  test('列顺序与其它列配置不回归', () => {
    const columns = buildColumns();
    expect(columns.map(column => column.name)).toEqual(['id', 'filename', 'size', 'namespace', 'mimetype', 'url', 'createdAt', 'updatedAt']);
    expect(findColumn(columns, 'url')).toEqual(expect.objectContaining({ width: 240, ellipsis: true }));
  });

  test('无论是否传入缩略图加载器，文件名列都提供渲染函数', () => {
    expect(typeof findColumn(buildColumns(), 'filename').getValueOf).toBe('function');
    expect(typeof findColumn(buildColumns({ thumbnailLoader: createLoader() }), 'filename').getValueOf).toBe('function');
  });
});

describe('文件名列：类型图标占位与缩略图替换', () => {
  test('没有加载器时用 24px 文件类型图标占位，文件名照常展示', () => {
    render(renderFilenameCell(buildColumns(), { id: '1', filename: 'report.pdf' }));

    expect(container.querySelector('img')).toBeNull();
    const icon = container.querySelector('svg');
    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute('width', '24');
    expect(icon).toHaveAttribute('height', '24');
    expect(container.querySelector('.filenameTypeIcon')).not.toBeNull();
    expect(container).toHaveTextContent('report.pdf');
  });

  test('加载器判定为无缩略图时保持类型图标', () => {
    const loader = createLoader({ peekValue: undefined, requestValue: null });
    render(renderFilenameCell(buildColumns({ thumbnailLoader: loader }), { id: '2', filename: 'notes.txt' }));

    expect(loader.request).toHaveBeenCalledWith('2', expect.any(Function));
    expect(container.querySelector('svg')).not.toBeNull();
    expect(container.querySelector('img')).toBeNull();
  });

  test('已有缓存缩略图时直接渲染图片，不再显示类型图标', () => {
    const loader = createLoader({ peekValue: DATA_URL });
    render(renderFilenameCell(buildColumns({ thumbnailLoader: loader }), { id: '3', filename: 'photo.png' }));

    expect(container.querySelector('.filenameThumbnail')).toHaveAttribute('src', DATA_URL);
    expect(container.querySelector('svg')).toBeNull();
    expect(container).toHaveTextContent('photo.png');
  });

  test('缩略图异步到达后由类型图标替换为图片', () => {
    let emit;
    const loader = {
      peek: jest.fn(() => undefined),
      request: jest.fn((id, listener) => {
        emit = listener;
        return jest.fn();
      })
    };
    render(renderFilenameCell(buildColumns({ thumbnailLoader: loader }), { id: '4', filename: 'photo.png' }));

    expect(container.querySelector('svg')).not.toBeNull();
    expect(container.querySelector('img')).toBeNull();

    act(() => emit(DATA_URL));

    expect(container.querySelector('svg')).toBeNull();
    expect(container.querySelector('.filenameThumbnail')).toHaveAttribute('src', DATA_URL);
  });

  test('图片加载失败时回退到类型图标', () => {
    const loader = createLoader({ peekValue: 'broken-url' });
    render(renderFilenameCell(buildColumns({ thumbnailLoader: loader }), { id: '5', filename: 'photo.png' }));

    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    act(() => {
      img.dispatchEvent(new Event('error'));
    });

    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('svg')).not.toBeNull();
  });
});
