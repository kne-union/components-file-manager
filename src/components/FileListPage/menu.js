const normalizeBaseUrl = baseUrl => {
  if (!baseUrl || baseUrl === '/') {
    return '';
  }
  return String(baseUrl).replace(/\/+$/, '');
};

export const buildFileListPageMenuItems = ({ baseUrl, formatMessage }) => {
  const root = normalizeBaseUrl(baseUrl);
  return [
    {
      label: formatMessage({ id: 'MenuFileLibrary' }),
      key: 'list',
      path: root || '/'
    },
    {
      label: formatMessage({ id: 'MenuFileSystem' }),
      key: 'filesystem',
      path: root ? `${root}/filesystem` : '/filesystem'
    }
  ];
};

/** 选最长匹配 path；无匹配时默认文件库 */
export const matchFileListPageMenuPath = (menuItems, pathname) => {
  const current = String(pathname || '').replace(/[#,?].*$/, '').replace(/\/+$/, '') || '/';
  let best = null;
  (menuItems || []).forEach(item => {
    if (!item?.path) {
      return;
    }
    const target = String(item.path).replace(/\/+$/, '') || '/';
    if (current === target || (target !== '/' && current.startsWith(`${target}/`))) {
      if (!best || target.length > best.path.length) {
        best = item;
      }
    }
  });
  return best?.key || 'list';
};

export const buildFolderSelectTree = (tree, rootLabel) => {
  const isFolder = node => {
    const kind = node?.options?.kind;
    if (kind === 'folder') {
      return true;
    }
    if (kind === 'file') {
      return false;
    }
    return !node?.options?.fileId;
  };

  const walk = nodes =>
    (nodes || []).filter(isFolder).map(node => ({
      title: node.name,
      value: node.id,
      key: node.id,
      children: walk(node.children)
    }));

  return [
    {
      title: rootLabel,
      value: '__root__',
      key: '__root__',
      children: walk(tree)
    }
  ];
};

export default buildFileListPageMenuItems;
