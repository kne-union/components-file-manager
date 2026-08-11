import { globalInit } from '../preset';
import { getApis } from '@components/Apis';
import merge from 'lodash/merge';
import fileList from './file-list.json';

export { fileList };

let folderNodeSeq = 1;
const folderStore = new Map();

/** 对齐 react-file 虚拟滚动示例：大目录内 40 文件夹 + 960 文件 */
const BULK_FOLDER_COUNT = 40;
const BULK_FILE_COUNT = 960;

/**
 * 模拟真实后端：首包 ~0.5–0.8s，翻页越往后略慢（offset 查询），大目录再加点耗时。
 * 故意拉长，方便看 skeleton / 分页加载。
 */
const calcFolderListLatencyMs = ({ currentPage = 1, totalHint = 0 } = {}) => {
  const page = Math.max(1, Number(currentPage) || 1);
  const base = 520;
  const pagePenalty = (page - 1) * 90;
  const bulkPenalty = totalHint >= 200 ? 180 : totalHint >= 50 ? 80 : 0;
  const jitter = Math.floor(Math.random() * 280);
  return base + pagePenalty + bulkPenalty + jitter;
};

/** 供示例页订阅：看每次 folder/list 的 start → done */
export const folderRequestBus =
  typeof EventTarget !== 'undefined' ? new EventTarget() : { addEventListener() {}, removeEventListener() {}, dispatchEvent() {} };

const emitFolderRequest = (api, payload) => {
  const detail = Object.assign({ api, at: Date.now() }, payload);
  try {
    folderRequestBus.dispatchEvent(new CustomEvent('request', { detail }));
  } catch (e) {
    // ignore
  }
  if (typeof console !== 'undefined' && console.info) {
    const tag = detail.phase ? `${api}:${detail.phase}` : api;
    console.info(`[mock ${tag}]`, detail.request, detail.response || detail.latencyMs || '');
  }
};

const pad = (n, width = 2) => String(n).padStart(width, '0');

/**
 * 写入「大目录-虚拟滚动」+「多层导航测试」树，供虚拟滚动 / 分栏验证。
 * demo、admin-file-system 共用，避免业务页 type 默认值测不到大数据。
 */
const appendBulkVirtualScrollDemo = (nodes, key, rootId) => {
  const bulkParent = `folder-bulk-${key}`;
  nodes.push({
    id: bulkParent,
    type: key,
    name: '大目录-虚拟滚动',
    parentId: rootId,
    options: { kind: 'folder' }
  });

  for (let i = 1; i <= BULK_FOLDER_COUNT; i += 1) {
    const n = pad(i, 2);
    const subId = `folder-bulk-sub-${key}-${n}`;
    nodes.push({
      id: subId,
      type: key,
      name: `folder-${n}`,
      parentId: bulkParent,
      options: { kind: 'folder' }
    });

    // 前 5 个子文件夹再挂 2～3 层，便于测分栏/画廊导航
    if (i <= 5) {
      for (let j = 1; j <= 3; j += 1) {
        const midId = `folder-bulk-mid-${key}-${n}-${j}`;
        nodes.push({
          id: midId,
          type: key,
          name: `mid-${j}`,
          parentId: subId,
          options: { kind: 'folder' }
        });
        for (let k = 1; k <= 4; k += 1) {
          nodes.push({
            id: `file-bulk-mid-${key}-${n}-${j}-${k}`,
            type: key,
            name: `file-${k}.txt`,
            parentId: midId,
            options: {
              kind: 'file',
              fileId: `file-bulk-mid-id-${key}-${n}-${j}-${k}`,
              size: 2048 + k,
              mimetype: 'text/plain',
              filename: `file-${k}.txt`
            }
          });
        }
        if (j === 1) {
          const deepId = `folder-bulk-deep-${key}-${n}`;
          nodes.push({
            id: deepId,
            type: key,
            name: 'deep',
            parentId: midId,
            options: { kind: 'folder' }
          });
          for (let k = 1; k <= 12; k += 1) {
            const kn = pad(k, 2);
            nodes.push({
              id: `file-bulk-deep-${key}-${n}-${k}`,
              type: key,
              name: `deep-${kn}.txt`,
              parentId: deepId,
              options: {
                kind: 'file',
                fileId: `file-bulk-deep-id-${key}-${n}-${k}`,
                size: 4096 + k,
                mimetype: 'text/plain',
                filename: `deep-${kn}.txt`
              }
            });
          }
        }
      }
      for (let k = 1; k <= 6; k += 1) {
        nodes.push({
          id: `file-bulk-subfile-${key}-${n}-${k}`,
          type: key,
          name: `local-${k}.txt`,
          parentId: subId,
          options: {
            kind: 'file',
            fileId: `file-bulk-subfile-id-${key}-${n}-${k}`,
            size: 1536 + k,
            mimetype: 'text/plain',
            filename: `local-${k}.txt`
          }
        });
      }
    }
  }

  for (let i = 1; i <= BULK_FILE_COUNT; i += 1) {
    const n = pad(i, 4);
    nodes.push({
      id: `file-bulk-${key}-${n}`,
      type: key,
      name: `file-${n}.txt`,
      parentId: bulkParent,
      options: {
        kind: 'file',
        fileId: `file-bulk-id-${key}-${n}`,
        size: 1024 + i,
        mimetype: 'text/plain',
        filename: `file-${n}.txt`
      }
    });
  }

  // 独立「多层导航」树：结构更清晰，方便测分栏
  const nestRoot = `folder-nest-${key}`;
  nodes.push({
    id: nestRoot,
    type: key,
    name: '多层导航测试',
    parentId: rootId,
    options: { kind: 'folder' }
  });
  ['设计稿', '交付物', '归档'].forEach((level1Name, li) => {
    const level1Id = `folder-nest-l1-${key}-${li}`;
    nodes.push({
      id: level1Id,
      type: key,
      name: level1Name,
      parentId: nestRoot,
      options: { kind: 'folder' }
    });
    nodes.push({
      id: `file-nest-l1-${key}-${li}`,
      type: key,
      name: `${level1Name}-说明.md`,
      parentId: level1Id,
      options: {
        kind: 'file',
        fileId: `file-nest-l1-id-${key}-${li}`,
        size: 512,
        mimetype: 'text/markdown',
        filename: `${level1Name}-说明.md`
      }
    });
    const level2Names = li === 0 ? ['移动端', '桌面端', '组件库'] : li === 1 ? ['客户A', '客户B'] : ['2024', '2025'];
    level2Names.forEach((level2Name, lj) => {
      const level2Id = `folder-nest-l2-${key}-${li}-${lj}`;
      nodes.push({
        id: level2Id,
        type: key,
        name: level2Name,
        parentId: level1Id,
        options: { kind: 'folder' }
      });
      for (let k = 1; k <= 5; k += 1) {
        nodes.push({
          id: `file-nest-l2-${key}-${li}-${lj}-${k}`,
          type: key,
          name: `${level2Name}-${k}.png`,
          parentId: level2Id,
          options: {
            kind: 'file',
            fileId: `file-nest-l2-id-${key}-${li}-${lj}-${k}`,
            size: 8192 + k,
            mimetype: 'image/png',
            filename: `${level2Name}-${k}.png`
          }
        });
      }
      if (li === 0 && lj === 0) {
        const level3Id = `folder-nest-l3-${key}`;
        nodes.push({
          id: level3Id,
          type: key,
          name: '切图',
          parentId: level2Id,
          options: { kind: 'folder' }
        });
        for (let k = 1; k <= 12; k += 1) {
          const n = pad(k, 2);
          nodes.push({
            id: `file-nest-l3-${key}-${n}`,
            type: key,
            name: `icon-${n}.svg`,
            parentId: level3Id,
            options: {
              kind: 'file',
              fileId: `file-nest-l3-id-${key}-${n}`,
              size: 1024 + k,
              mimetype: 'image/svg+xml',
              filename: `icon-${n}.svg`
            }
          });
        }
      }
    });
  });
};

const ensureFolderType = type => {
  const key = type || 'default';
  if (!folderStore.has(key)) {
    const rootId = `folder-seed-${key}`;
    const nodes = [
      {
        id: rootId,
        type: key,
        name: '示例文件夹',
        parentId: null,
        options: { kind: 'folder' }
      },
      {
        id: `folder-docs-${key}`,
        type: key,
        name: '文档',
        parentId: rootId,
        options: { kind: 'folder' }
      },
      {
        id: `file-seed-${key}`,
        type: key,
        name: 'readme.txt',
        parentId: rootId,
        options: {
          kind: 'file',
          fileId: `file-id-${key}`,
          size: 128,
          mimetype: 'text/plain',
          filename: 'readme.txt'
        }
      },
      {
        id: `file-guide-${key}`,
        type: key,
        name: '使用说明.pdf',
        parentId: rootId,
        options: {
          kind: 'file',
          fileId: `file-guide-id-${key}`,
          size: 204800,
          mimetype: 'application/pdf',
          filename: '使用说明.pdf'
        }
      },
      {
        id: `file-long-name-${key}`,
        type: key,
        name: '超长文件名-2024年度第一季度产品规划评审会会议纪要与行动项跟踪清单-最终版-v3.2.1-已确认.pdf',
        parentId: rootId,
        options: {
          kind: 'file',
          fileId: `file-long-name-id-${key}`,
          size: 1048576,
          mimetype: 'application/pdf',
          filename: '超长文件名-2024年度第一季度产品规划评审会会议纪要与行动项跟踪清单-最终版-v3.2.1-已确认.pdf'
        }
      },
      {
        id: `folder-long-name-${key}`,
        type: key,
        name: '超长文件夹名称-客户交付资料归档-华东区-2024Q1-Q2合并备份',
        parentId: rootId,
        options: { kind: 'folder' }
      },
      {
        id: `file-long-en-${key}`,
        type: key,
        name: 'very-very-long-english-filename-without-spaces-product-requirements-document-final-review-copy-v12.docx',
        parentId: rootId,
        options: {
          kind: 'file',
          fileId: `file-long-en-id-${key}`,
          size: 256000,
          mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          filename: 'very-very-long-english-filename-without-spaces-product-requirements-document-final-review-copy-v12.docx'
        }
      },
      {
        id: `file-doc1-${key}`,
        type: key,
        name: '会议纪要.docx',
        parentId: `folder-docs-${key}`,
        options: {
          kind: 'file',
          fileId: `file-doc1-id-${key}`,
          size: 51200,
          mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          filename: '会议纪要.docx'
        }
      },
      {
        id: `file-doc2-${key}`,
        type: key,
        name: '报价单.xlsx',
        parentId: `folder-docs-${key}`,
        options: {
          kind: 'file',
          fileId: `file-doc2-id-${key}`,
          size: 36864,
          mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          filename: '报价单.xlsx'
        }
      }
    ];

    if (key === 'demo' || key === 'admin-file-system') {
      appendBulkVirtualScrollDemo(nodes, key, rootId);
    }

    if (key === 'preview-ext') {
      nodes.push(
        {
          id: `file-log-${key}`,
          type: key,
          name: 'app.log',
          parentId: rootId,
          options: {
            kind: 'file',
            fileId: `file-log-id-${key}`,
            size: 256,
            mimetype: 'text/plain',
            filename: 'app.log'
          }
        },
        {
          id: `file-dwg-${key}`,
          type: key,
          name: 'plan.dwg',
          parentId: rootId,
          options: {
            kind: 'file',
            fileId: `file-dwg-id-${key}`,
            size: 1024,
            mimetype: 'application/acad',
            filename: 'plan.dwg'
          }
        }
      );
    }

    folderStore.set(key, nodes);
  }
  return folderStore.get(key);
};

const toPlainNode = node => ({
  id: node.id,
  type: node.type,
  name: node.name,
  parentId: node.parentId,
  options: Object.assign({}, node.options),
  children: node.children
});

const buildFolderTree = (nodes, { kind } = {}) => {
  const map = new Map();
  nodes.forEach(node => {
    if (kind === 'folder' || kind === 'foldersOnly') {
      const nodeKind = node.options?.kind === 'file' || node.options?.fileId ? 'file' : 'folder';
      if (nodeKind !== 'folder') {
        return;
      }
    }
    map.set(node.id, Object.assign({}, toPlainNode(node), { children: [] }));
  });
  const roots = [];
  map.forEach(node => {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId).children.push(node);
    } else if (!node.parentId || !nodes.some(item => item.id === node.parentId)) {
      roots.push(node);
    }
  });
  const prune = list =>
    list.map(item => {
      const next = Object.assign({}, item);
      if (next.children?.length) {
        next.children = prune(next.children);
      } else {
        delete next.children;
      }
      return next;
    });
  return prune(roots);
};

const getNodeKindMock = node => {
  const kind = node?.options?.kind;
  if (kind === 'file' || kind === 'folder') {
    return kind;
  }
  return node?.options?.fileId ? 'file' : 'folder';
};

const sortSiblingNodes = (left, right) => {
  const leftIsFolder = getNodeKindMock(left) === 'folder' ? 0 : 1;
  const rightIsFolder = getNodeKindMock(right) === 'folder' ? 0 : 1;
  if (leftIsFolder !== rightIsFolder) {
    return leftIsFolder - rightIsFolder;
  }
  return String(left.name || '').localeCompare(String(right.name || ''), undefined, {
    numeric: true,
    sensitivity: 'base'
  });
};

const listFolderChildren = ({ type, parentId, currentPage = 1, perPage = 20, keyword } = {}) => {
  const nodes = ensureFolderType(type || 'demo');
  const parent = parentId || null;
  let list = nodes.filter(node => (node.parentId || null) === parent);
  const trimmed = String(keyword || '').trim().toLowerCase();
  if (trimmed) {
    list = list.filter(node => String(node.name || '').toLowerCase().indexOf(trimmed) > -1);
  }
  list = list.slice().sort(sortSiblingNodes);
  const page = Math.max(1, Number(currentPage) || 1);
  const size = Math.min(200, Math.max(1, Number(perPage) || 20));
  const start = (page - 1) * size;
  return {
    pageData: list.slice(start, start + size).map(toPlainNode),
    totalCount: list.length,
    /** 调试用：本页在全量中的下标区间（1-based） */
    range: list.length === 0 ? null : [Math.min(start + 1, list.length), Math.min(start + size, list.length)]
  };
};

const countFolderChildren = ({ type, parentId, keyword } = {}) => {
  const nodes = ensureFolderType(type || 'demo');
  const parent = parentId || null;
  let list = nodes.filter(node => (node.parentId || null) === parent);
  const trimmed = String(keyword || '').trim().toLowerCase();
  if (trimmed) {
    list = list.filter(node => String(node.name || '').toLowerCase().indexOf(trimmed) > -1);
  }
  return list.length;
};

const collectDescendants = (nodes, id) => {
  const childrenMap = new Map();
  nodes.forEach(node => {
    const list = childrenMap.get(node.parentId || null) || [];
    list.push(node);
    childrenMap.set(node.parentId || null, list);
  });
  const result = [];
  const walk = parentId => {
    (childrenMap.get(parentId) || []).forEach(child => {
      result.push(child);
      walk(child.id);
    });
  };
  const root = nodes.find(item => item.id === id);
  if (root) {
    result.push(root);
    walk(id);
  }
  return result;
};

const paginate = (list, currentPage = 1, perPage = 20) => {
  const totalCount = list.length;
  const page = Number(currentPage) || 1;
  const size = Number(perPage) || 20;
  const start = (page - 1) * size;
  return {
    pageData: list.slice(start, start + size),
    totalCount
  };
};

const filterFileList = ({ data } = {}) => {
  const { filter = {}, currentPage = 1, perPage = 20 } = Object.assign({}, data);
  let list = (fileList.data?.pageData || []).slice();

  if (filter.id) {
    const id = String(filter.id).toLowerCase();
    list = list.filter(item => String(item.id).toLowerCase().indexOf(id) > -1);
  }
  if (filter.filename) {
    const keyword = String(filter.filename).toLowerCase();
    list = list.filter(item => String(item.filename).toLowerCase().indexOf(keyword) > -1);
  }
  if (filter.namespace) {
    const namespace = String(filter.namespace).toLowerCase();
    list = list.filter(item => String(item.namespace).toLowerCase().indexOf(namespace) > -1);
  }
  if (Array.isArray(filter.size) && filter.size.length > 0) {
    const [minK, maxK] = filter.size;
    list = list.filter(item => {
      const sizeK = item.size / 1024;
      if (minK != null && minK !== '' && sizeK < Number(minK)) {
        return false;
      }
      if (maxK != null && maxK !== '' && sizeK > Number(maxK)) {
        return false;
      }
      return true;
    });
  }
  ['createdAt', 'updatedAt'].forEach(name => {
    if (!filter[name]) {
      return;
    }
    const { startTime, endTime } = filter[name];
    list = list.filter(item => {
      const value = item[name];
      if (!value) {
        return false;
      }
      if (startTime && value < startTime) {
        return false;
      }
      if (endTime && value > endTime) {
        return false;
      }
      return true;
    });
  });

  return paginate(list, currentPage, perPage);
};

const apis = merge(
  {},
  {
    fileManager: getApis()
  },
  {
    fileManager: {
      getFileList: {
        loader: props => filterFileList(props)
      },
      deleteFiles: {
        loader: () => ({ success: true })
      },
      renameFile: {
        loader: ({ data }) => ({
          id: data?.id,
          filename: data?.filename
        })
      },
      replaceFile: {
        loader: () => ({ success: true })
      },
      upload: {
        loader: () => ({
          id: `upload-${Date.now()}`,
          filename: '新上传文件.pdf',
          size: 102400,
          namespace: 'upload',
          mimetype: 'application/pdf'
        })
      },
      getFile: {
        loader: ({ urlParams }) => {
          const id = urlParams?.id;
          const item = (fileList.data?.pageData || []).find(file => file.id === id);
          return item || fileList.data.pageData[0];
        }
      },
      getFileUrl: {
        loader: ({ urlParams }) => {
          const id = urlParams?.id || 'demo';
          return { url: `/api/v1/static/file-id/${id}` };
        }
      },
      folderTree: {
        loader: async ({ params } = {}) => {
          const request = {
            type: params?.type || 'admin-file-system',
            kind: params?.kind || undefined
          };
          await new Promise(resolve => setTimeout(resolve, 180 + Math.floor(Math.random() * 120)));
          const tree = buildFolderTree(ensureFolderType(request.type), { kind: request.kind });
          emitFolderRequest('folder/tree', {
            phase: 'done',
            request,
            response: { rootCount: Array.isArray(tree) ? tree.length : 0 }
          });
          return tree;
        }
      },
      folderList: {
        loader: async ({ data } = {}) => {
          const request = {
            type: data?.type || 'demo',
            parentId: data?.parentId || null,
            currentPage: Number(data?.currentPage) || 1,
            perPage: Number(data?.perPage) || 20,
            keyword: data?.keyword || undefined
          };
          const parentName =
            request.parentId == null
              ? '(root)'
              : ensureFolderType(request.type).find(item => item.id === request.parentId)?.name || request.parentId;
          const isBulk = parentName === '大目录-虚拟滚动';
          const totalHint = countFolderChildren(request);
          const latencyMs = calcFolderListLatencyMs({
            currentPage: request.currentPage,
            totalHint
          });
          const requestId = `list-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const startedAt = Date.now();

          emitFolderRequest('folder/list', {
            phase: 'start',
            requestId,
            request,
            parentName,
            isBulk,
            latencyMs,
            response: {
              totalHint,
              expectedRange:
                totalHint === 0
                  ? null
                  : [
                      Math.min((request.currentPage - 1) * request.perPage + 1, totalHint),
                      Math.min(request.currentPage * request.perPage, totalHint)
                    ]
            }
          });

          await new Promise(resolve => setTimeout(resolve, latencyMs));

          const result = listFolderChildren(request);
          const durationMs = Date.now() - startedAt;
          emitFolderRequest('folder/list', {
            phase: 'done',
            requestId,
            request,
            parentName,
            isBulk,
            latencyMs,
            durationMs,
            response: {
              totalCount: result.totalCount,
              pageDataLength: result.pageData.length,
              range: result.range,
              pageNames: result.pageData.slice(0, 3).map(item => item.name),
              hasMore: result.range ? result.range[1] < result.totalCount : false
            }
          });
          return {
            pageData: result.pageData,
            totalCount: result.totalCount
          };
        }
      },
      folderMkdir: {
        loader: ({ data } = {}) => {
          const type = data?.type || 'default';
          const nodes = ensureFolderType(type);
          const node = {
            id: `folder-${Date.now()}-${folderNodeSeq++}`,
            type,
            name: data?.name || '新建文件夹',
            parentId: data?.parentId || null,
            options: { kind: 'folder' }
          };
          nodes.push(node);
          return toPlainNode(node);
        }
      },
      folderUpload: {
        loader: ({ params, data } = {}) => {
          const type = params?.type || data?.type || 'default';
          const folderPath = params?.path !== undefined ? params.path : data?.path;
          const segments = String(folderPath || '')
            .replace(/\\/g, '/')
            .split('/')
            .map(segment => segment.trim())
            .filter(segment => segment && segment !== '.' && segment !== '..');
          let parentId = null;
          const nodes = ensureFolderType(type);
          for (const name of segments) {
            let existing = nodes.find(
              item => (item.parentId || null) === parentId && item.name === name && item.options?.kind === 'folder'
            );
            if (!existing) {
              existing = {
                id: `folder-${Date.now()}-${folderNodeSeq++}`,
                type,
                name,
                parentId,
                options: { kind: 'folder' }
              };
              nodes.push(existing);
            }
            parentId = existing.id;
          }
          const fileId = `file-${Date.now()}-${folderNodeSeq++}`;
          const filename = data?.file?.name || data?.filename || '新上传文件.pdf';
          const size = data?.file?.size || data?.size || 102400;
          const mimetype = data?.file?.type || data?.mimetype || 'application/octet-stream';
          const node = {
            id: `node-${Date.now()}-${folderNodeSeq++}`,
            type,
            name: filename,
            parentId,
            options: {
              kind: 'file',
              fileId,
              size,
              mimetype,
              filename
            }
          };
          nodes.push(node);
          return Object.assign({}, toPlainNode(node), {
            file: { id: fileId, filename, size, mimetype }
          });
        }
      },
      folderRemove: {
        loader: ({ data } = {}) => {
          const type = data?.type || 'default';
          const nodes = ensureFolderType(type);
          const removing = collectDescendants(nodes, data?.id);
          const removeIds = new Set(removing.map(item => item.id));
          folderStore.set(
            type,
            nodes.filter(item => !removeIds.has(item.id))
          );
          return {};
        }
      },
      folderMove: {
        loader: ({ data } = {}) => {
          const type = data?.type || 'default';
          const nodes = ensureFolderType(type);
          const ids = Array.isArray(data?.ids) ? data.ids : [];
          const parentId = data?.parentId || null;
          const idSet = new Set(ids);
          const results = [];
          folderStore.set(
            type,
            nodes.map(node => {
              if (!idSet.has(node.id)) {
                return node;
              }
              const next = Object.assign({}, node, { parentId });
              results.push(toPlainNode(next));
              return next;
            })
          );
          return results;
        }
      },
      folderCopy: {
        loader: ({ data } = {}) => {
          const type = data?.type || 'admin-file-system';
          const nodes = ensureFolderType(type);
          const ids = Array.isArray(data?.ids) ? data.ids : [];
          const parentId = data?.parentId || null;
          const byId = new Map(nodes.map(node => [node.id, node]));
          const results = [];
          const cloneSubtree = (sourceId, nextParentId) => {
            const source = byId.get(sourceId);
            if (!source) {
              return;
            }
            const newId = `folder-${Date.now()}-${folderNodeSeq++}`;
            const next = Object.assign({}, toPlainNode(source), {
              id: newId,
              parentId: nextParentId,
              options: Object.assign({}, source.options, source.options?.kind === 'file' ? { linked: true } : {})
            });
            nodes.push(next);
            results.push(next);
            nodes
              .filter(item => item.parentId === sourceId)
              .forEach(child => cloneSubtree(child.id, newId));
          };
          ids.forEach(id => cloneSubtree(id, parentId));
          folderStore.set(type, nodes.slice());
          return results;
        }
      },
      folderRename: {
        loader: ({ data } = {}) => {
          const type = data?.type || 'default';
          const nodes = ensureFolderType(type);
          let result = null;
          folderStore.set(
            type,
            nodes.map(node => {
              if (node.id !== data?.id) {
                return node;
              }
              const next = Object.assign({}, node, { name: data?.name || node.name });
              result = toPlainNode(next);
              return next;
            })
          );
          return result;
        }
      },
      folderAddFiles: {
        loader: ({ data } = {}) => {
          const type = data?.type || 'admin-file-system';
          const parentId = data?.parentId || null;
          const ids = [...new Set((Array.isArray(data?.ids) ? data.ids : []).filter(Boolean).map(String))];
          const nodes = ensureFolderType(type);
          const pageData = fileList.data?.pageData || [];
          const existingFileIds = new Set(
            nodes
              .filter(node => node.parentId === parentId && node.options?.kind === 'file' && node.options?.fileId)
              .map(node => String(node.options.fileId))
          );
          const results = [];
          ids.forEach(fileId => {
            if (existingFileIds.has(String(fileId))) {
              return;
            }
            const file = pageData.find(item => item.id === fileId) || {
              id: fileId,
              filename: `linked-${fileId}.bin`,
              size: 1024,
              mimetype: 'application/octet-stream'
            };
            const node = {
              id: `linked-${Date.now()}-${folderNodeSeq++}`,
              type,
              name: file.filename,
              parentId,
              options: {
                kind: 'file',
                fileId: file.id,
                size: file.size,
                mimetype: file.mimetype,
                filename: file.filename,
                linked: true
              }
            };
            nodes.push(node);
            existingFileIds.add(String(file.id));
            results.push(toPlainNode(node));
          });
          return results;
        }
      }
    }
  }
);

const ajax = async ({ loader, ...props }) => {
  if (props.responseType === 'blob' && /download-files/.test(props.url || '')) {
    // 最小合法空 zip（EOCD）
    const emptyZip = new Uint8Array([0x50, 0x4b, 0x05, 0x06, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    return {
      data: new Blob([emptyZip], { type: 'application/zip' }),
      headers: { 'content-disposition': 'attachment; filename="files.zip"' }
    };
  }
  if (!loader && props.url) {
    const { ajax: realAjax } = await globalInit();
    return realAjax({ loader, ...props });
  }
  const result = loader ? await loader(props) : {};
  return { data: { code: 0, data: result } };
};

ajax.postForm = async ({ url, params, data } = {}) => {
  if (url && /folder\/upload/.test(url)) {
    const result = await apis.fileManager.folderUpload.loader({ params, data });
    return { data: { code: 0, data: result } };
  }
  if (url && /replace-file/.test(url)) {
    return {
      data: {
        code: 0,
        data: {
          id: params?.id || `file-${Date.now()}`,
          filename: data?.file?.name || 'replaced.bin',
          size: data?.file?.size || 1024,
          mimetype: data?.file?.type || 'application/octet-stream'
        }
      }
    };
  }
  return {
    data: {
      code: 0,
      data: {
        id: `upload-${Date.now()}`,
        filename: data?.file?.name || '新上传文件.pdf',
        size: data?.file?.size || 102400,
        namespace: 'upload',
        mimetype: data?.file?.type || 'application/octet-stream'
      }
    }
  };
};

const preset = {
  ajax,
  apis,
  ossUpload: async ({ file }) =>
    ajax.postForm({
      url: '/api/v1/static/upload',
      data: { file }
    }),
  staticUrl: '',
  themeToken: {
    colorPrimary: '#4F185A',
    colorPrimaryHover: '#702280'
  }
};

export default preset;
