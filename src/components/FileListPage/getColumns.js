import withLocale from './withLocale';
import { useIntl } from '@kne/react-intl';
import FileType from '@kne/react-file-type';
import { Thumbnail } from '../../common/thumbnail';
import style from './style.module.scss';

// 类型图标与缩略图使用同一尺寸，缩略图到位时直接替换，不产生布局跳动
const FILE_ICON_SIZE = 24;

/** 从文件名取后缀，供文件类型图标使用 */
export const resolveFileType = item => {
  const name = item?.filename || item?.originName || '';
  const parts = String(name).split('.');
  return parts.length > 1 ? parts.pop() : '';
};

const formatFileSize = size => {
  if (size === undefined || size === null || size === '') {
    return '-';
  }
  const bytes = Number(size);
  if (!Number.isFinite(bytes) || bytes < 0) {
    return '-';
  }
  if (bytes === 0) {
    return '0 B';
  }
  if (bytes < 1000) {
    return `${bytes} B`;
  }

  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  for (const unit of units) {
    value /= 1000;
    if (value < 1000 || unit === 'TB') {
      const rounded = value >= 100 ? Math.round(value) : value.toFixed(value >= 10 ? 1 : 2).replace(/\.?0+$/, '');
      return `${rounded} ${unit}`;
    }
  }
  return '-';
};

const getColumns = ({ preview, getUrl, formatMessage, thumbnailLoader }) => {
  return [
    {
      name: 'id',
      title: formatMessage({ id: 'ID' }),
      renderType: 'id',
      fixed: 'left'
    },
    {
      name: 'filename',
      title: formatMessage({ id: 'Filename' }),
      renderType: 'main',
      getValueOf: item => (
        <>
          <Thumbnail
            loader={thumbnailLoader}
            id={item.id}
            className={style.filenameThumbnail}
            fallback={
              <span className={style.filenameTypeIcon}>
                <FileType type={resolveFileType(item)} size={FILE_ICON_SIZE} />
              </span>
            }
          />
          {item.filename}
        </>
      ),
      onClick: ({ colItem }) => {
        preview(colItem);
      }
    },
    {
      name: 'size',
      title: formatMessage({ id: 'FileSize' }),
      getValueOf: item => formatFileSize(item.size)
    },
    {
      name: 'namespace',
      title: formatMessage({ id: 'Namespace' })
    },
    {
      name: 'mimetype',
      title: formatMessage({ id: 'MimeType' }),
      width: 200,
      ellipsis: true
    },
    {
      name: 'url',
      title: formatMessage({ id: 'AccessUrl' }),
      getValueOf: item => getUrl(item),
      width: 240,
      ellipsis: true
    },
    {
      name: 'createdAt',
      title: formatMessage({ id: 'CreatedAt' }),
      format: 'datetime'
    },
    {
      name: 'updatedAt',
      title: formatMessage({ id: 'UpdatedAt' }),
      format: 'datetime'
    }
  ];
};

export const ColumnsLoader = withLocale(({ children }) => {
  const { formatMessage } = useIntl();
  return children(props => getColumns(Object.assign({}, props, { formatMessage })));
});

export default getColumns;
export { formatFileSize };
