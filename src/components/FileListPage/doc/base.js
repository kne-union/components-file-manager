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
