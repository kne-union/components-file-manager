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
