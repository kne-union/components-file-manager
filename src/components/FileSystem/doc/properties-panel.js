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
