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
            4. 默认开启 virtualScroll；进入「大目录-虚拟滚动」（40 文件夹 + 960 文件）测分页加载
          */}
          <FileSystem type="demo" title="演示文件库" defaultView="icons" propertiesPanel />
        </div>
      </Layout>
    </PureGlobal>
  );
});

render(<BaseExample />);
