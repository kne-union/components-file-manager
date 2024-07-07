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
