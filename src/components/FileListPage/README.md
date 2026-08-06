
# FileListPage


### 概述

文件管理页面，基于新版 TablePage、@kne/app-children-router 与 @kne/react-intl。左侧双菜单切换「文件库」与「文件系统」（默认 type=`admin-file-system`），支持列表查询、预览、重命名、替换、删除，以及批量加入 FileSystem 文件夹。


### 示例(全屏)

#### 示例代码

- 基础用法
- 完整文件管理页面：左侧「文件库 / 文件系统」菜单；文件库支持关键词搜索、多条件筛选、预览下载、重命名、替换上传、单条删除、批量删除、批量下载压缩包、批量加入文件系统
- _FileListPage(@components/FileListPage),_mockPreset(@root/mockPreset),remoteLoader(@kne/remote-loader),reactRouterDom(react-router-dom)

```jsx
const { default: FileListPage } = _FileListPage;
const { default: mockPreset } = _mockPreset;
const { createWithRemoteLoader } = remoteLoader;
const { Route, Routes, Navigate } = reactRouterDom;

const BaseExample = createWithRemoteLoader({
  modules: ['components-core:Global@PureGlobal', 'components-core:Layout']
})(({ remoteModules }) => {
  const [PureGlobal, Layout] = remoteModules;
  return (
    <PureGlobal preset={mockPreset}>
      <Layout navigation={{ isFixed: false }}>
        <Routes>
          <Route
            path="/FileListPage/*"
            element={
              <FileListPage
                baseUrl="/FileListPage"
                type="admin-file-system"
                pageProps={{
                  menuFixed: false,
                  title: '文件管理'
                }}
              />
            }
          />
          <Route path="*" element={<Navigate to="/FileListPage" replace />} />
        </Routes>
      </Layout>
    </PureGlobal>
  );
});

render(<BaseExample />);

```

- 列表页 List
- 直接使用 List 子组件渲染文件列表，适合嵌入已有路由、不需要 AppChildrenRouter 包裹的场景
- _FileListPage(@components/FileListPage),_mockPreset(@root/mockPreset),remoteLoader(@kne/remote-loader)

```jsx
const { List } = _FileListPage;
const { default: mockPreset } = _mockPreset;
const { createWithRemoteLoader } = remoteLoader;

const ListExample = createWithRemoteLoader({
  modules: ['components-core:Global@PureGlobal', 'components-core:Layout']
})(({ remoteModules }) => {
  const [PureGlobal, Layout] = remoteModules;
  return (
    <PureGlobal preset={mockPreset}>
      <Layout navigation={{ isFixed: false }}>
        <List
          baseUrl="/FileListPage"
          type="admin-file-system"
          pageProps={{
            menuFixed: false,
            title: '文件列表'
          }}
        />
      </Layout>
    </PureGlobal>
  );
});

render(<ListExample />);

```

- 表格列配置
- 使用 getColumns 获取文件列表列配置，可自定义国际化文案、预览与访问地址生成逻辑
- _FileListPage(@components/FileListPage),_mockPreset(@root/mockPreset),remoteLoader(@kne/remote-loader)

```jsx
const { getColumns } = _FileListPage;
const { default: mockPreset, fileList } = _mockPreset;
const { createWithRemoteLoader } = remoteLoader;

const GetColumnsExample = createWithRemoteLoader({
  modules: ['components-core:Global@PureGlobal', 'components-core:Layout@TablePage', 'components-core:Layout']
})(({ remoteModules }) => {
  const [PureGlobal, TablePage, Layout] = remoteModules;

  const formatMessage = ({ id }) => {
    const messages = {
      ID: 'ID',
      Filename: '文件名',
      FileSize: '文件大小',
      Namespace: '来源',
      MimeType: '文件类型',
      AccessUrl: '访问地址',
      CreatedAt: '创建时间',
      UpdatedAt: '更新时间'
    };
    return messages[id] || id;
  };

  const columns = getColumns({
    formatMessage,
    preview: item => {
      console.log('preview', item);
    },
    getUrl: item => `/api/v1/static/file-id/${item.id}`
  });

  return (
    <PureGlobal preset={mockPreset}>
      <Layout navigation={{ isFixed: false }}>
        <TablePage
          isNext
          loader={() => {
            return new Promise(resolve => {
              setTimeout(() => {
                resolve(fileList.data);
              }, 500);
            });
          }}
          columns={columns}
          pagination={{ paramsType: 'data' }}
          name="file-manager-columns-demo"
        />
      </Layout>
    </PureGlobal>
  );
});

render(<GetColumnsExample />);

```


### API

## FileListPage

文件管理页面入口组件，内部通过 `@kne/app-children-router` 挂载「文件库」与「文件系统」双路由。

| 属性名    | 说明                                                                 | 类型      | 默认值                |
| --------- | -------------------------------------------------------------------- | --------- | --------------------- |
| baseUrl   | 路由基础路径，传给 AppChildrenRouter                                 | string    | -                     |
| type      | 文件系统业务域，传给 FileSystem；批量「加入文件系统」不传 type，走后端 defaultFolderType | string    | `'admin-file-system'` |
| pageProps | 透传给 List / FileSystemPage 的 page 配置（如 title、menu、menuFixed） | object    | `{}`                  |
| children  | 路由未匹配时的兜底内容                                               | ReactNode | -                     |

路由：

- `index` / 默认 → 文件库 `List`
- `filesystem` → `FileSystemPage`

左侧菜单由 List / FileSystemPage 共用（可用 `pageProps.menu` 覆盖）。

## List

文件列表子组件，基于 `components-core:Layout@TablePage`（`isNext`）实现。

| 属性名    | 说明                                       | 类型   | 默认值 |
| --------- | ------------------------------------------ | ------ | ------ |
| baseUrl   | 路由基础路径（用于菜单跳转）               | string | -      |
| pageProps | 透传给 TablePage 的 page 配置              | object | `{}`   |

### 核心能力

- 左侧菜单：文件库 / 文件系统
- 关键词搜索（文件名）
- 筛选：ID、来源、大小区间、创建/更新时间
- 行选择与批量删除
- 批量下载压缩包
- 批量加入文件系统（选目标文件夹，挂载为 linked 节点；不传 type，走后端 defaultFolderType）
- 添加文件（上传弹窗）
- 行操作：更新（替换上传）、重命名、删除
- 文件预览与下载

### 依赖的 preset.apis.fileManager

| 接口           | 说明                                                         |
| -------------- | ------------------------------------------------------------ |
| getFileList    | 文件分页列表（POST，body 含 filter / currentPage / perPage） |
| deleteFiles    | 删除文件（body.ids）                                         |
| downloadFiles  | 批量下载压缩包（body.ids，返回 zip 流）                      |
| renameFile     | 重命名（body.id / filename）                                 |
| replaceFile    | 替换文件（query.id + form 文件）                             |
| getFileUrl     | 访问地址模板（`/file-url/{id}`）                             |
| upload         | 上传接口（添加文件）                                         |
| folderTree     | 获取文件夹树（批量加入时选目标）                             |
| folderAddFiles | 将文件库文件以 linked 节点加入指定文件夹                     |

## FileSystemPage

文件系统子页面，渲染带双菜单的 Layout Page + FileSystem。

| 属性名    | 说明                         | 类型   | 默认值                |
| --------- | ---------------------------- | ------ | --------------------- |
| baseUrl   | 路由基础路径（用于菜单跳转） | string | -                     |
| type      | FileSystem 业务域            | string | `'admin-file-system'` |
| pageProps | 透传给 Layout@Page 的配置    | object | `{}`                  |

## getColumns

生成文件列表列配置。

| 参数名        | 说明               | 类型                     | 默认值 |
| ------------- | ------------------ | ------------------------ | ------ |
| formatMessage | 国际化格式化函数   | `(descriptor) => string` | -      |
| preview       | 点击文件名预览回调 | `(item) => void`         | -      |
| getUrl        | 生成访问地址       | `(item) => string`       | -      |

返回值：TablePage columns 配置数组。

## ColumnsLoader

带国际化注入的列配置加载器，用法：

```jsx
<ColumnsLoader>
  {getColumns => {
    const columns = getColumns({ preview, getUrl });
    return <TablePage columns={columns} />;
  }}
</ColumnsLoader>
```

## 数据结构

```javascript
{
  id: string,          // 文件 ID（uuid）
  filename: string,    // 文件名
  size: number,        // 字节大小
  namespace: string,   // 来源/命名空间
  mimetype: string,    // MIME 类型
  createdAt: string,   // 创建时间
  updatedAt: string    // 更新时间
}
```

## 国际化

namespace：`components-file-manager`，默认语言 `zh-CN`，同时提供 `en-US`。

