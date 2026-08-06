import { useCallback, useEffect, useRef, useState } from 'react';
import { mapListNodes } from './mapListNodes';

/** 按 path 隔离，避免 parentId 为空时与根目录页缓存撞车 */
const cacheKey = ({ path, parentId, keyword, perPage }) => `${path || ''}|${parentId || ''}|${keyword || ''}|${perPage}`;

const emptyListing = () => ({
  entries: [],
  totalCount: 0,
  loadingIndexes: new Set(),
  ready: false
});

const sameId = (a, b) => (a == null && b == null) || String(a) === String(b);

/**
 * 多目录稀疏分页缓存：
 * - icons/list/gallery 用当前 parentPath 的 listing
 * - columns（Miller）按 columnPath 分别缓存，单击文件夹只展开列、不改 currentPath
 */
const useFolderPageCache = ({ listFolder, parentId, parentPath, pathToId, enabled = true }) => {
  const [listings, setListings] = useState(() => ({}));

  const pagesRef = useRef(new Map());
  const inflightRef = useRef(new Map());
  const metaByPathRef = useRef(new Map());
  const totalByKeyRef = useRef(new Map());
  /** 从已加载 listing / pathToId 积累的 folder path → id，供分栏展开解析 parentId */
  const folderIdByPathRef = useRef(new Map());

  useEffect(() => {
    if (!pathToId || typeof pathToId.forEach !== 'function') {
      return;
    }
    pathToId.forEach((id, path) => {
      if (path && id != null) {
        folderIdByPathRef.current.set(path, id);
      }
    });
  }, [pathToId]);

  const rememberFolders = useCallback(entries => {
    (entries || []).forEach(entry => {
      if (entry?.kind === 'folder' && entry.path && entry.id != null) {
        folderIdByPathRef.current.set(entry.path, entry.id);
      }
    });
  }, []);

  const resolveParentId = useCallback(
    path => {
      const pathKey = path || '';
      if (!pathKey) {
        return null;
      }
      const remembered = folderIdByPathRef.current.get(pathKey);
      if (remembered != null) {
        return remembered;
      }
      if (pathToId && typeof pathToId.get === 'function') {
        const id = pathToId.get(pathKey);
        if (id != null) {
          return id;
        }
      }
      if (pathKey === (parentPath || '')) {
        return parentId || null;
      }
      return null;
    },
    [parentId, parentPath, pathToId]
  );

  const updateListing = useCallback((path, patch) => {
    const key = path || '';
    setListings(previous => {
      const current = previous[key] || emptyListing();
      const nextLoading =
        patch.loadingIndexes !== undefined
          ? patch.loadingIndexes
          : current.loadingIndexes instanceof Set
            ? current.loadingIndexes
            : new Set(current.loadingIndexes || []);
      return {
        ...previous,
        [key]: {
          entries: patch.entries !== undefined ? patch.entries : current.entries,
          totalCount: patch.totalCount !== undefined ? patch.totalCount : current.totalCount,
          loadingIndexes: nextLoading,
          ready: patch.ready !== undefined ? patch.ready : current.ready
        }
      };
    });
  }, []);

  const rebuildSparse = useCallback(
    (path, total, pageMap, perPage) => {
      const next = new Array(total);
      pageMap.forEach((pageData, page) => {
        const start = (page - 1) * perPage;
        mapListNodes(pageData, path || '').forEach((entry, offset) => {
          next[start + offset] = entry;
        });
      });
      rememberFolders(next);
      updateListing(path, { entries: next, totalCount: total, ready: true });
    },
    [rememberFolders, updateListing]
  );

  const ensurePages = useCallback(
    async ({ path, pages, perPage, keyword = '' }) => {
      if (!enabled || typeof listFolder !== 'function' || !perPage) {
        return;
      }

      const pathKey = path || '';
      const pid = resolveParentId(pathKey);

      // 非根路径必须先解析到 folder id，否则会误用根目录接口且与根缓存撞车
      if (pathKey && pid == null) {
        return;
      }

      const key = cacheKey({ path: pathKey, parentId: pid, keyword, perPage });
      metaByPathRef.current.set(pathKey, { parentId: pid, path: pathKey, keyword, perPage });

      if (!pagesRef.current.has(key)) {
        pagesRef.current.set(key, new Map());
      }
      const pageMap = pagesRef.current.get(key);
      const knownTotal = totalByKeyRef.current.get(key) || 0;
      const maxPage = knownTotal > 0 ? Math.max(1, Math.ceil(knownTotal / perPage)) : Infinity;
      let needed = [...new Set(pages)].filter(
        page => page >= 1 && page <= maxPage && !pageMap.has(page) && !inflightRef.current.has(`${key}:${page}`)
      );

      // 尚不知总数时禁止并行预取：只拉最小页，避免 page2/3 在 total 未回时打出空数组
      if (knownTotal <= 0 && needed.length > 1) {
        needed = [Math.min(...needed)];
      }

      if (needed.length === 0) {
        if (knownTotal > 0) {
          rebuildSparse(pathKey, knownTotal, pageMap, perPage);
        }
        return;
      }

      setListings(previous => {
        const current = previous[pathKey] || emptyListing();
        const loading = new Set(current.loadingIndexes || []);
        needed.forEach(page => {
          const start = (page - 1) * perPage;
          for (let i = 0; i < perPage; i += 1) {
            if (knownTotal <= 0 || start + i < knownTotal) {
              loading.add(start + i);
            }
          }
        });
        return {
          ...previous,
          [pathKey]: { ...current, loadingIndexes: loading }
        };
      });

      await Promise.all(
        needed.map(async page => {
          const flightKey = `${key}:${page}`;
          const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
          inflightRef.current.set(flightKey, controller);
          try {
            const result = await listFolder({
              parentId: pid || undefined,
              currentPage: page,
              perPage,
              keyword: keyword || undefined,
              signal: controller?.signal
            });
            const meta = metaByPathRef.current.get(pathKey);
            if (!meta || !sameId(meta.parentId, pid) || meta.keyword !== keyword || meta.perPage !== perPage) {
              return;
            }
            const pageData = result?.pageData || [];
            let total = Number(result?.totalCount) || 0;
            // 短页 = 已到末页：用实有条数收紧 total，避免再按旧 total 去打下一页空请求
            if (pageData.length < perPage) {
              total = (page - 1) * perPage + pageData.length;
            } else if (total > 0 && pageData.length >= total && page === 1) {
              total = pageData.length;
            }
            totalByKeyRef.current.set(key, total);
            pageMap.set(page, pageData);
            rebuildSparse(pathKey, total, pageMap, perPage);
          } catch (e) {
            if (e?.name === 'AbortError') {
              return;
            }
            console.error(e);
          } finally {
            inflightRef.current.delete(flightKey);
            setListings(previous => {
              const current = previous[pathKey] || emptyListing();
              const loading = new Set(current.loadingIndexes || []);
              const start = (page - 1) * perPage;
              for (let i = 0; i < perPage; i += 1) {
                loading.delete(start + i);
              }
              return {
                ...previous,
                [pathKey]: { ...current, loadingIndexes: loading }
              };
            });
          }
        })
      );

      // 首屏拿回 total 后，按原 pages 补拉仍合法的页（例如可视区跨页）；若一页已装下全部则不再请求
      const totalAfter = totalByKeyRef.current.get(key) || 0;
      if (totalAfter > 0) {
        const nextMax = Math.max(1, Math.ceil(totalAfter / perPage));
        const stillNeeded = [...new Set(pages)].filter(
          page => page >= 1 && page <= nextMax && !pageMap.has(page) && !inflightRef.current.has(`${key}:${page}`)
        );
        if (stillNeeded.length > 0) {
          return ensurePages({ path: pathKey, pages: stillNeeded, perPage, keyword });
        }
      }
    },
    [enabled, listFolder, rebuildSparse, resolveParentId]
  );

  const handleVisibleRangeChange = useCallback(
    ({ startIndex, endIndex, pageSize, keyword, columnPath, currentPath: rangePath }) => {
      const pathKey = columnPath != null ? columnPath || '' : rangePath != null ? rangePath || '' : parentPath || '';
      const nextKeyword = keyword || '';
      const pid = resolveParentId(pathKey);
      const meta = metaByPathRef.current.get(pathKey) || { perPage: null, keyword: '', parentId: undefined };

      let perPage = meta.perPage;
      if (!perPage) {
        perPage = Math.max(1, Number(pageSize) || 40);
      }

      // parentId 晚到或 keyword 变化：清掉错误缓存
      const parentIdChanged = meta.parentId !== undefined && !sameId(meta.parentId, pid);
      if ((meta.keyword && meta.keyword !== nextKeyword) || parentIdChanged) {
        const oldKey = cacheKey({
          path: pathKey,
          parentId: meta.parentId,
          keyword: meta.keyword || '',
          perPage: meta.perPage || perPage
        });
        pagesRef.current.delete(oldKey);
        totalByKeyRef.current.delete(oldKey);
        updateListing(pathKey, { entries: [], totalCount: 0, loadingIndexes: new Set(), ready: false });
      }

      metaByPathRef.current.set(pathKey, {
        parentId: pid,
        path: pathKey,
        keyword: nextKeyword,
        perPage
      });

      // 非根且尚无 id：先记下 perPage，等 folderId 就绪后再拉（由 pathToId/listing 更新触发重 emit）
      if (pathKey && pid == null) {
        return;
      }

      const start = Math.max(0, Number(startIndex) || 0);
      const end = Math.max(start, Number(endIndex) || 0);
      const startPage = Math.floor(start / perPage) + 1;
      const endPage = Math.floor(end / perPage) + 1;
      const pages = [];
      for (let page = startPage; page <= endPage; page += 1) {
        pages.push(page);
      }
      // 向上滚动时补上一页；不再预取 endPage+1（一页已满/已到末页时会打出空请求）
      if (startPage > 1) {
        pages.push(startPage - 1);
      }
      // 已知总数时裁掉超出末页的页码
      const cacheKeyForTotal = cacheKey({ path: pathKey, parentId: pid, keyword: nextKeyword, perPage });
      const knownTotal = totalByKeyRef.current.get(cacheKeyForTotal) || 0;
      if (knownTotal > 0) {
        const maxPage = Math.max(1, Math.ceil(knownTotal / perPage));
        const clipped = pages.filter(page => page <= maxPage);
        ensurePages({ path: pathKey, pages: clipped, perPage, keyword: nextKeyword });
        return;
      }
      ensurePages({ path: pathKey, pages, perPage, keyword: nextKeyword });
    },
    [ensurePages, parentPath, resolveParentId, updateListing]
  );

  const registerFolder = useCallback(
    (path, id) => {
      if (path && id != null) {
        folderIdByPathRef.current.set(path, id);
      }
      if (!path) {
        return;
      }
      // 展开列时立刻拉第 1 页；总数未知时不预取第 2 页，避免空数组请求
      const pathKey = path;
      const perPage = metaByPathRef.current.get(pathKey)?.perPage || 40;
      return ensurePages({ path: pathKey, pages: [1], perPage, keyword: '' });
    },
    [ensurePages]
  );

  const invalidateAndReload = useCallback(() => {
    pagesRef.current = new Map();
    inflightRef.current.forEach(controller => controller.abort?.());
    inflightRef.current = new Map();
    totalByKeyRef.current = new Map();
    metaByPathRef.current = new Map();
    folderIdByPathRef.current = new Map();
    setListings({});
    const pathKey = parentPath || '';
    const perPage = 40;
    return ensurePages({ path: pathKey, pages: [1], perPage, keyword: '' });
  }, [ensurePages, parentPath]);

  const current = listings[parentPath || ''] || emptyListing();

  return {
    entries: current.entries,
    totalCount: current.totalCount,
    loadingIndexes: current.loadingIndexes instanceof Set ? current.loadingIndexes : new Set(current.loadingIndexes || []),
    ready: current.ready,
    listings,
    handleVisibleRangeChange,
    registerFolder,
    invalidateAndReload
  };
};

export default useFolderPageCache;
