import { getNodeKind, mapTreeToItems } from './mapTreeToItems';

/** 将 folder/list 单层节点映射为 FileSystem entry */
export const mapListNode = (node, parentPath = '') => {
  const kind = getNodeKind(node);
  const name = node.name || node.options?.filename || node.id;
  const path =
    kind === 'folder'
      ? parentPath
        ? `${parentPath}${name}/`
        : `${name}/`
      : `${parentPath}${node.id}`;

  return {
    id: node.id,
    parentId: node.parentId != null ? node.parentId : null,
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
};

export const mapListNodes = (nodes = [], parentPath = '') => (nodes || []).map(node => mapListNode(node, parentPath));

export { getNodeKind, mapTreeToItems };
export default mapListNodes;
