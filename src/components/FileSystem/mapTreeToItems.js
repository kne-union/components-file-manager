const getNodeKind = node => {
  const kind = node?.options?.kind;
  if (kind === 'file' || kind === 'folder') {
    return kind;
  }
  return node?.options?.fileId ? 'file' : 'folder';
};

const mapNode = (node, parentPath = '', parentId = null) => {
  const kind = getNodeKind(node);
  const name = node.name || node.options?.filename || node.id;
  // 文件夹 path 用名称；文件 path 用稳定 id，避免同名覆盖，且重命名不改变 path
  const path =
    kind === 'folder'
      ? parentPath
        ? `${parentPath}${name}/`
        : `${name}/`
      : `${parentPath}${node.id}`;

  const entry = {
    id: node.id,
    parentId: node.parentId != null ? node.parentId : parentId,
    kind,
    path,
    name,
    parentPath,
    size: node.options?.size,
    mimetype: node.options?.mimetype,
    fileId: node.options?.fileId,
    status: node.status ?? node.options?.status,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    options: node.options
  };

  const children = (node.children || []).flatMap(child => mapNode(child, kind === 'folder' ? path : parentPath, node.id));
  return [entry, ...children];
};

const mapTreeToItems = (tree = []) => {
  const list = Array.isArray(tree) ? tree : [];
  return list.flatMap(node => mapNode(node, ''));
};

export { getNodeKind, mapTreeToItems };
export default mapTreeToItems;
