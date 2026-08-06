### FileSystem

| 属性名 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| virtualScroll | 是否开启虚拟分页滚动（大目录按需拉页）；默认开启，可传 `false` 回退整树加载 | boolean | `true` |
| type | 业务域（必填） | string | - |
| title | 根目录标题 | string | - |
| folderApis | 自定义文件夹 API | object | 默认走 fileManager.folder* |
| toolbarExtra | 顶部菜单扩展（接在上传/新建文件夹后） | ReactNode \| `({ selectedEntries, currentPath, parentId, reload, clearSelection }) => ReactNode` | - |
| propertiesPanel | 右侧属性面板（透传核心 FileSystem） | boolean \| ReactNode \| `({ selectedEntries, index, currentPath, close, actions, onAction, defaultActions }) => ReactNode` | true |
| propertiesActions | 属性面板操作按钮 | `false` \| `ActionItem[]` \| `(ctx) => ActionItem[]` \| `{ list?, replace?, ...ButtonGroupProps }` | 内置默认操作 |
| onPropertiesAction | 属性面板操作回调；传入则覆盖业务默认处理 | `(key, { entry, selectedEntries, clearSelection, currentPath }) => void` | 内置查看/替换/重命名/下载/移动/删除 |
| onFileOpen | 打开文件 | function | 弹窗预览 |
| onSelectionChange | 选中变化 | function(entries) | - |

可用 `components-core:File@FileSystem` 的 `FileSystem.PropertiesPanel.Default / InfoRow / Section / Actions` 扩展属性显示（`extraInfo` / `extraSections`）。

#### propertiesActions

| 取值 | 行为 |
| --- | --- |
| `false` | 关闭操作区 |
| `ActionItem[]` | 按 `key` 与默认项合并；`{ key, hidden: true }` 可关掉单项；新 `key` 追加 |
| `(ctx) => ActionItem[]` | 完全自定义；`ctx` 含 `defaultActions` / `selectedEntries` / `onAction` 等 |
| `{ list, replace?, ... }` | `replace: true` 时用 `list` 替换默认，否则按 `key` 合并；其余字段透传 ButtonGroup（如 `showLength`） |

默认操作 key：`view` / `replace` / `rename` / `download` / `move` / `copy` / `delete`（按选中项种类过滤）。外露 `showLength=2`，其余进「更多」。

#### folder API（fileManager）

| 接口 | 方法 | 路径 |
| --- | --- | --- |
| folderTree | GET | `{prefix}/folder/tree`（`kind=folder` 仅文件夹） |
| folderList | POST | `{prefix}/folder/list`（`parentId` + `currentPage` + `perPage` + 可选 `keyword` → `{ pageData, totalCount }`） |
| folderMkdir | POST | `{prefix}/folder/mkdir` |
| folderUpload | POST | `{prefix}/folder/upload` |
| folderRemove | POST | `{prefix}/folder/remove` |
| folderMove | POST | `{prefix}/folder/move` |
| folderCopy | POST | `{prefix}/folder/copy` |
| folderRename | POST | `{prefix}/folder/rename` |
| folderAddFiles | POST | `{prefix}/folder/add-files` |

节点：`options.kind` 为 `file` \| `folder`；文件节点含 `options.fileId`。`options.linked: true` 表示挂载自文件库（删除树节点不删文件实体）。

后端文件夹鉴权使用 `getAuthenticate(action)`，在 hook 内读取 `request` 的 `type`。
