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
