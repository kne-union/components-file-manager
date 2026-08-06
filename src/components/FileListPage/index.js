import AppChildrenRouter from '@kne/app-children-router';
import List from './List';
import FileSystemPage from './FileSystemPage';

const FileListPage = ({ baseUrl, children, type = 'admin-file-system', ...props }) => {
  return (
    <AppChildrenRouter
      baseUrl={baseUrl}
      list={[
        {
          index: true,
          element: <List {...props} baseUrl={baseUrl} />
        },
        {
          path: 'filesystem',
          element: <FileSystemPage {...props} baseUrl={baseUrl} type={type} />
        }
      ]}
    >
      {children}
    </AppChildrenRouter>
  );
};

export default FileListPage;

export { List };
export { default as FileSystemPage } from './FileSystemPage';
export { default as getColumns, ColumnsLoader } from './getColumns';
export { default as withLocale } from './withLocale';
export { buildFileListPageMenuItems, buildFolderSelectTree, matchFileListPageMenuPath } from './menu';
