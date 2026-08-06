
# FileSystem


### 概述

基于 components-core:File@FileSystem 的业务文件树，支持上传、新建文件夹、多选批量操作（删除 / 压缩包下载 / 移动到）与右侧属性面板；目录存于 file-manager folder API（fastify-group）。


### 示例(全屏)

#### 示例代码

- 基础用法
- 指定 type；支持上传、新建文件夹、多选批量与默认属性面板
- _FileSystem(@components/FileSystem),_mockPreset(@root/mockPreset),remoteLoader(@kne/remote-loader)

```jsx
const { default: FileSystem } = _FileSystem;
const { default: mockPreset } = _mockPreset;
const { createWithRemoteLoader } = remoteLoader;

const BaseExample = createWithRemoteLoader({
  modules: ['components-core:Global@PureGlobal', 'components-core:Layout']
})(({ remoteModules }) => {
  const [PureGlobal, Layout] = remoteModules;
  return (
    <PureGlobal preset={mockPreset}>
      <Layout navigation={{ isFixed: false }}>
        <div style={{ padding: 16, height: 640 }}>
          {/*
            新特性说明：
            1. 多选后「新建文件夹」旁出现「已选:N条」：删除 / 压缩包下载 / 移动到
            2. 选中后右侧显示默认属性面板（扩展见 FileSystem.PropertiesPanel 示例）
            3. mock 含中英文超长文件名/文件夹，可切换图标/列表/分栏/画廊查看截断与换行
          */}
          <FileSystem type="demo" title="演示文件库" defaultView="icons" propertiesPanel />
        </div>
      </Layout>
    </PureGlobal>
  );
});

render(<BaseExample />);

```

- FileSystem.PropertiesPanel
- 使用 FileSystem.PropertiesPanel.Default / InfoRow / Section 扩展属性面板显示字段
- _FileSystem(@components/FileSystem),_mockPreset(@root/mockPreset),remoteLoader(@kne/remote-loader)

```jsx
const { default: FileSystem } = _FileSystem;
const { default: mockPreset } = _mockPreset;
const { createWithRemoteLoader } = remoteLoader;

const BaseExample = createWithRemoteLoader({
  modules: ['components-core:Global@PureGlobal', 'components-core:Layout', 'components-core:File@FileSystem']
})(({ remoteModules }) => {
  const [PureGlobal, Layout, CoreFileSystem] = remoteModules;
  const { PropertiesPanel } = CoreFileSystem;

  return (
    <PureGlobal preset={mockPreset}>
      <Layout navigation={{ isFixed: false }}>
        <div style={{ padding: 16, height: 640 }}>
          <FileSystem
            type="demo"
            title="属性面板扩展示例"
            defaultView="icons"
            propertiesPanel={({ selectedEntries, index }) => (
              <PropertiesPanel.Default
                selectedEntries={selectedEntries}
                index={index}
                extraInfo={({ entry }) => (
                  <>
                    <PropertiesPanel.InfoRow label="节点 ID" value={entry?.id} />
                    {entry?.kind === 'file' ? <PropertiesPanel.InfoRow label="fileId" value={entry.fileId} /> : null}
                    {entry?.kind === 'file' ? <PropertiesPanel.InfoRow label="MIME" value={entry.mimetype} /> : null}
                  </>
                )}
                extraSections={({ entry, selectedEntries: entries }) =>
                  entries?.length === 1 && entry ? (
                    <PropertiesPanel.Section title="更多">
                      <PropertiesPanel.InfoRow label="路径" value={entry.path} />
                    </PropertiesPanel.Section>
                  ) : null
                }
              />
            )}
          />
        </div>
      </Layout>
    </PureGlobal>
  );
});

render(<BaseExample />);

```

- 扩展预览类型
- 通过 components-core:File@preset 注册 previewExtensions / previewMapping，扩展 .log、.dwg 等预览（对齐 table-view preset）
- _FileSystem(@components/FileSystem),_mockPreset(@root/mockPreset),remoteLoader(@kne/remote-loader)

```jsx
const { default: FileSystem } = _FileSystem;
const { default: mockPreset } = _mockPreset;
const { createWithRemoteLoader } = remoteLoader;

const CadPreview = ({ filename, url }) => {
  return (
    <div style={{ padding: 24, background: '#fafafa', height: '100%' }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>自定义 CAD 预览</div>
      <div>文件名：{filename || '-'}</div>
      <div style={{ color: 'rgba(0,0,0,0.45)', marginTop: 4 }}>地址：{url || '-'}</div>
    </div>
  );
};

const BaseExample = createWithRemoteLoader({
  modules: ['components-core:Global@PureGlobal', 'components-core:Layout', 'components-core:File@preset']
})(({ remoteModules }) => {
  const [PureGlobal, Layout, filePreset] = remoteModules;

  // 对齐 @kne/table-view：通过 preset 扩展预览类型
  filePreset({
    previewExtensions: {
      log: 'txt',
      dwg: 'cad'
    },
    previewMapping: {
      cad: CadPreview
    }
  });

  return (
    <PureGlobal preset={mockPreset}>
      <Layout navigation={{ isFixed: false }}>
        <div style={{ padding: 16, height: 640 }}>
          <FileSystem type="preview-ext" title="扩展预览示例" defaultView="list" />
        </div>
      </Layout>
    </PureGlobal>
  );
});

render(<BaseExample />);

```

- 扩展顶部菜单
- 通过 toolbarExtra 在上传/新建文件夹旁追加自定义操作，可拿到 selectedEntries / reload 等上下文
- _FileSystem(@components/FileSystem),_mockPreset(@root/mockPreset),remoteLoader(@kne/remote-loader),antd(antd),icons(@ant-design/icons)

```jsx
const { default: FileSystem } = _FileSystem;
const { default: mockPreset } = _mockPreset;
const { createWithRemoteLoader } = remoteLoader;
const { Button, message } = antd;
const { DeleteOutlined, ReloadOutlined } = icons;

const BaseExample = createWithRemoteLoader({
  modules: ['components-core:Global@PureGlobal', 'components-core:Layout']
})(({ remoteModules }) => {
  const [PureGlobal, Layout] = remoteModules;

  return (
    <PureGlobal preset={mockPreset}>
      <Layout navigation={{ isFixed: false }}>
        <div style={{ padding: 16, height: 640 }}>
          <FileSystem
            type="demo"
            title="工具栏扩展示例"
            defaultView="list"
            toolbarExtra={({ selectedEntries, reload }) => (
              <>
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={() => {
                    reload?.();
                    message.success('已刷新');
                  }}
                >
                  刷新
                </Button>
                <Button
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  disabled={!selectedEntries?.length}
                  onClick={() => {
                    message.info(`已选择 ${selectedEntries.length} 项（示例仅演示工具栏扩展）`);
                  }}
                >
                  删除选中
                </Button>
              </>
            )}
          />
        </div>
      </Layout>
    </PureGlobal>
  );
});

render(<BaseExample />);

```


### API

### FileSystem

| 属性名 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| type | 业务域（必填） | string | - |
| title | 根目录标题 | string | - |
| folderApis | 自定义文件夹 API | object | 默认走 fileManager.folder* |
| toolbarExtra | 顶部菜单扩展（接在上传/新建文件夹后） | ReactNode \| `({ selectedEntries, currentPath, parentId, reload, clearSelection }) => ReactNode` | - |
| propertiesPanel | 右侧属性面板（透传核心 FileSystem） | boolean \| ReactNode \| `({ selectedEntries, index, currentPath, close, actions, onAction, defaultActions }) => ReactNode` | true |
| propertiesActions | 属性面板操作按钮 | `false` \| `ActionItem[]` \| `(ctx) => ActionItem[]` \| `{ list?, replace?, ...ButtonGroupProps }` | 内置默认操作 |
| onPropertiesAction | 属性面板操作回调；传入则覆盖业务默认处理 | `(key, { entry, selectedEntries, clearSelection, currentPath }) => void` | 内置查看/替换/重命名/下载/移动/复制/删除 |
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
| folderTree | GET | `{prefix}/folder/tree` |
| folderMkdir | POST | `{prefix}/folder/mkdir` |
| folderUpload | POST | `{prefix}/folder/upload` |
| folderRemove | POST | `{prefix}/folder/remove` |
| folderMove | POST | `{prefix}/folder/move` |
| folderCopy | POST | `{prefix}/folder/copy` |
| folderRename | POST | `{prefix}/folder/rename` |
| folderAddFiles | POST | `{prefix}/folder/add-files` |

节点：`options.kind` 为 `file` \| `folder`；文件节点含 `options.fileId`。`options.linked: true` 表示挂载自文件库（删除树节点不删文件实体）。

后端文件夹鉴权使用 `getAuthenticate(action)`，在 hook 内读取 `request` 的 `type`。

