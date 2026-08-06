import { Checkbox, Empty, Flex } from 'antd';
import classnames from 'classnames';
import get from 'lodash/get';
import { createWithRemoteLoader } from '@kne/remote-loader';
import FileType from '@kne/react-file-type';
import { formatFileSize } from './getColumns';
import style from './FileMobileList.module.scss';

const resolveRowId = (item, rowKey = 'id') => get(item, typeof rowKey === 'function' ? rowKey(item) : rowKey);

const resolveOptionsColumn = columns => {
  if (!Array.isArray(columns)) {
    return null;
  }
  return columns.find(column => column?.name === 'options' || column?.renderType === 'options') || null;
};

const formatDateTime = value => {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const resolveFileType = item => {
  const name = item?.filename || item?.originName || '';
  const parts = String(name).split('.');
  return parts.length > 1 ? parts.pop() : '';
};

const resolveActions = (optionsColumn, item, context) => {
  if (!optionsColumn?.getValueOf) {
    return null;
  }
  const value = optionsColumn.getValueOf(item, { context });
  if (value?.children) {
    return value.children;
  }
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }
  return value.filter(action => action && !action.hidden).map(action => Object.assign({ type: 'link' }, action));
};

/**
 * 文件库列表移动端卡片：文件名为主信息，大小/来源/时间为次要信息，支持勾选与操作
 */
const FileMobileList = createWithRemoteLoader({
  modules: ['components-core:ButtonGroup']
})(
  ({
    remoteModules,
    dataSource = [],
    columns,
    rowKey = 'id',
    context,
    empty,
    renderToolbar,
    getSelectionProps,
    getRowKey,
    formatMessage,
    preview
  }) => {
    const [ButtonGroup] = remoteModules;
    const optionsColumn = resolveOptionsColumn(columns);

    if (!dataSource.length) {
      return <div className={style.empty}>{empty || <Empty />}</div>;
    }

    return (
      <div className={classnames(style.list, 'info-page-table-mobile-card-list')}>
        {typeof renderToolbar === 'function' ? renderToolbar() : null}
        <Flex vertical gap={12} className={style.cards}>
          {dataSource.map(item => {
            const id = typeof getRowKey === 'function' ? getRowKey(item) : resolveRowId(item, rowKey);
            const selection = typeof getSelectionProps === 'function' ? getSelectionProps(item) : null;
            const actions = resolveActions(optionsColumn, item, context);
            const sizeText = formatFileSize(item?.size);
            const createdAt = formatDateTime(item?.createdAt);
            const namespace = item?.namespace;
            const isSelected = !!selection?.checked;
            const fileType = resolveFileType(item);

            return (
              <div
                key={id}
                className={classnames(style.card, 'info-page-table-mobile-card', {
                  [style.selected]: isSelected
                })}
              >
                {selection ? (
                  <Checkbox
                    className={style.checkbox}
                    checked={selection.checked}
                    indeterminate={selection.indeterminate}
                    disabled={selection.disabled}
                    onChange={selection.onChange}
                  />
                ) : null}

                <div
                  className={style.typeIcon}
                  aria-hidden
                  onClick={() => {
                    preview?.(item);
                  }}
                >
                  <FileType type={fileType} size={36} />
                </div>

                <div className={style.body}>
                  <div
                    className={style.title}
                    title={item?.filename}
                    onClick={() => {
                      preview?.(item);
                    }}
                  >
                    {item?.filename || '-'}
                  </div>

                  <Flex align="center" gap={8} wrap="wrap" className={style.meta}>
                    {sizeText && sizeText !== '-' ? <span className={style.metaItem}>{sizeText}</span> : null}
                    {namespace ? (
                      <>
                        {sizeText && sizeText !== '-' ? <span className={style.dot}>·</span> : null}
                        <span className={style.metaItem}>
                          {formatMessage({ id: 'Namespace' })} {namespace}
                        </span>
                      </>
                    ) : null}
                    {createdAt ? (
                      <>
                        <span className={style.dot}>·</span>
                        <span className={style.metaItem}>{createdAt}</span>
                      </>
                    ) : null}
                    {id != null && id !== '' ? <span className={style.id}>#{id}</span> : null}
                  </Flex>

                  {item?.mimetype ? <div className={style.description}>{item.mimetype}</div> : null}

                  {actions ? (
                    <div
                      className={style.actions}
                      onClick={event => {
                        event.stopPropagation();
                      }}
                    >
                      {Array.isArray(actions) ? (
                        <ButtonGroup itemClassName="btn-no-padding" moreType="link" list={actions} />
                      ) : (
                        actions
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </Flex>
      </div>
    );
  }
);

export default FileMobileList;
