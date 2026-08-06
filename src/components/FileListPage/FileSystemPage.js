import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';
import classnames from 'classnames';
import withLocale from './withLocale';
import FileSystem from '../FileSystem';
import { buildFileListPageMenuItems } from './menu';
import style from './style.module.scss';

const FileSystemPage = createWithRemoteLoader({
  modules: ['components-core:Layout@Page', 'components-core:Layout@Menu']
})(
  withLocale(({ remoteModules, baseUrl, type = 'admin-file-system', pageProps = {}, className, ...props }) => {
    const [Page, Menu] = remoteModules;
    const { formatMessage } = useIntl();
    const menuItems = buildFileListPageMenuItems({ baseUrl, formatMessage });

    return (
      <Page
        {...pageProps}
        title={pageProps.title || formatMessage({ id: 'PageTitle' })}
        menuFixed={pageProps.menuFixed !== undefined ? pageProps.menuFixed : false}
        menu={pageProps.menu || <Menu items={menuItems} defaultCurrentKey="filesystem" />}
        noPadding={pageProps.noPadding !== undefined ? pageProps.noPadding : true}
      >
        <div className={style.fileSystemPage}>
          <FileSystem
            className={classnames(style.fileSystemFill, className)}
            type={type}
            title={formatMessage({ id: 'MenuFileSystem' })}
            defaultView="icons"
            propertiesPanel
            {...props}
          />
        </div>
      </Page>
    );
  })
);

export default FileSystemPage;
