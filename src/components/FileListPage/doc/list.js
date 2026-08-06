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
