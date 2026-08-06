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
