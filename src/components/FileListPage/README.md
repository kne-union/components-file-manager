
# FileListPage


### 概述

文件管理页面


### 示例

#### 示例代码

- 这里填写示例标题
- 这里填写示例说明
- _FileListPage(@components/FileListPage),lodash(lodash),_Apis(@components/Apis),remoteLoader(@kne/remote-loader)

```jsx
const {default: FileListPage} = _FileListPage;
const {createWithRemoteLoader} = remoteLoader;
const {getApis} = _Apis;
const {merge} =lodash;
const BaseExample = createWithRemoteLoader({
    modules: ['Global@PureGlobal', 'Global@usePreset', 'Layout']
})(({remoteModules}) => {
    const [PureGlobal, usePreset, Layout] = remoteModules;
    const preset = usePreset();
    return <PureGlobal preset={merge({}, preset, {
        apis: {
            fileManager: getApis()
        }
    })}>
        <Layout navigation={{isFixed: false}}>
            <FileListPage/>
        </Layout>
    </PureGlobal>;
});

render(<BaseExample/>);

```


### API

|属性名|说明|类型|默认值|
|  ---  | ---  | --- | --- |

