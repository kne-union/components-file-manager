import { createWithRemoteLoader } from '@kne/remote-loader';
import { useMemo, useRef, useState, useCallback } from 'react';
import { App, Space } from 'antd';
import { useIntl } from '@kne/react-intl';
import withLocale from './withLocale';
import getColumns from './getColumns';
import { buildFileListPageMenuItems, buildFolderSelectTree } from './menu';

const List = createWithRemoteLoader({
  modules: [
    'components-core:Layout@TablePage',
    'components-core:TablePage@Table',
    'components-core:Filter',
    'components-core:Global@usePreset',
    'components-core:FormInfo',
    'components-core:FormInfo@useFormModal',
    'components-core:FileList@FileUpload',
    'components-core:Modal@useModal',
    'components-core:FilePreview',
    'components-core:File@Download',
    'components-core:Icon',
    'components-core:Layout@Menu'
  ]
})(
  withLocale(({ remoteModules, baseUrl, pageProps = {} }) => {
    const [TablePage, Table, Filter, usePreset, FormInfo, useFormModal, FileUpload, useModal, FilePreview, Download, Icon, Menu] =
      remoteModules;
    const { formatMessage } = useIntl();
    const { apis, ajax, staticUrl } = usePreset();
    const modal = useModal();
    const { getFilterValue, fields: filterFields } = Filter;
    const { InputFilterItem, NumberRangeFilterItem, TypeDateRangePickerFilterItem } = filterFields;
    const ref = useRef();
    const dataRef = useRef([]);
    const [filter, setFilter] = useState([]);
    const { message, modal: confirmModal } = App.useApp();
    const formModal = useFormModal();
    const { Input, Upload, TreeSelect } = FormInfo.fields;
    const menuItems = buildFileListPageMenuItems({ baseUrl, formatMessage });
    const { selectedRowKeys, selectedRows, setSelectedRowKeys, clearSelectedRows } = Table.useSelectedRow({
      rowKey: 'id'
    });

    const rowSelection = useMemo(
      () => ({
        type: 'checkbox',
        columnWidth: 56,
        fixed: true,
        selectedRowKeys,
        allowSelectedAll: false,
        onChange: keys => {
          setSelectedRowKeys(keys, dataRef.current || []);
        }
      }),
      [selectedRowKeys, setSelectedRowKeys]
    );

    const getUrl = useCallback(
      item => {
        return (
          (staticUrl || '') +
          apis.fileManager.getFileUrl.url.replace(/{([\s\S]+?)}/g, (match, name) => {
            return item[name];
          })
        );
      },
      [apis.fileManager.getFileUrl.url, staticUrl]
    );

    const preview = useCallback(
      item => {
        modal({
          title: (
            <Space>
              {formatMessage({ id: 'FilePreview' })}
              <Download id={item.id} type="link" originName={item.filename} icon={<Icon type="xiazai" />} />
            </Space>
          ),
          children: <FilePreview id={item.id} originName={item.filename} />,
          footer: null
        });
      },
      [Download, FilePreview, Icon, formatMessage, modal]
    );

    const handleBatchDelete = useCallback(
      ({ selectedRowKeys: ids, reload }) => {
        if (!ids?.length) {
          return;
        }
        confirmModal.confirm({
          title: formatMessage({ id: 'BatchDelete' }),
          onOk: async () => {
            const { data: resData } = await ajax(
              Object.assign({}, apis.fileManager.deleteFiles, {
                data: { ids }
              })
            );
            if (resData.code !== 0) {
              return;
            }
            message.success(formatMessage({ id: 'DeleteSuccess' }));
            clearSelectedRows();
            reload?.();
          }
        });
      },
      [ajax, apis.fileManager.deleteFiles, clearSelectedRows, confirmModal, formatMessage, message]
    );

    const handleBatchDownload = useCallback(
      async ({ selectedRowKeys: ids }) => {
        if (!ids?.length) {
          return;
        }
        try {
          const response = await ajax(
            Object.assign({}, apis.fileManager.downloadFiles, {
              data: { ids },
              responseType: 'blob',
              showError: false
            })
          );
          let blob = response?.data;
          if (blob && !(blob instanceof Blob) && blob.data instanceof Blob) {
            blob = blob.data;
          }
          if (!(blob instanceof Blob)) {
            message.error(formatMessage({ id: 'BatchDownloadFailed' }));
            return;
          }
          if (blob.type && blob.type.indexOf('application/json') > -1) {
            const text = await blob.text();
            try {
              const json = JSON.parse(text);
              message.error(json.msg || formatMessage({ id: 'BatchDownloadFailed' }));
            } catch (e) {
              message.error(formatMessage({ id: 'BatchDownloadFailed' }));
            }
            return;
          }
          await Download.downloadBlobFile(blob, 'files.zip');
          message.success(formatMessage({ id: 'BatchDownloadSuccess' }));
        } catch (e) {
          message.error(formatMessage({ id: 'BatchDownloadFailed' }));
        }
      },
      [Download, ajax, apis.fileManager.downloadFiles, formatMessage, message]
    );

    const handleBatchAddToFileSystem = useCallback(
      async ({ selectedRowKeys: ids }) => {
        if (!ids?.length) {
          return;
        }
        const { data: resData } = await ajax(Object.assign({}, apis.fileManager.folderTree));
        if (resData.code !== 0) {
          message.error(formatMessage({ id: 'BatchAddToFileSystemFailed' }));
          return;
        }
        const treeData = buildFolderSelectTree(resData.data || [], formatMessage({ id: 'RootFolder' }));
        const formModalApi = formModal({
          title: formatMessage({ id: 'BatchAddToFileSystem' }),
          size: 'small',
          formProps: {
            data: { targetParentId: '__root__' },
            onSubmit: async data => {
              const { data: addRes } = await ajax(
                Object.assign({}, apis.fileManager.folderAddFiles, {
                  data: {
                    parentId: !data.targetParentId || data.targetParentId === '__root__' ? null : data.targetParentId,
                    ids
                  }
                })
              );
              if (addRes.code !== 0) {
                return;
              }
              const addedCount = Array.isArray(addRes.data) ? addRes.data.length : 0;
              if (addedCount === 0) {
                message.info(formatMessage({ id: 'BatchAddToFileSystemSkipped' }));
              } else {
                message.success(formatMessage({ id: 'BatchAddToFileSystemSuccess' }, { count: addedCount }));
              }
              formModalApi.close();
              clearSelectedRows();
            }
          },
          children: (
            <FormInfo
              column={1}
              list={[
                <TreeSelect
                  name="targetParentId"
                  label={formatMessage({ id: 'TargetFolder' })}
                  treeData={treeData}
                  treeDefaultExpandAll
                  allowClear={false}
                  showSearch
                  treeNodeFilterProp="title"
                  rule="REQ"
                />
              ]}
            />
          )
        });
      },
      [
        FormInfo,
        TreeSelect,
        ajax,
        apis.fileManager.folderAddFiles,
        apis.fileManager.folderTree,
        clearSelectedRows,
        formModal,
        formatMessage,
        message
      ]
    );

    return (
      <TablePage
        isNext
        search={{
          name: 'filename',
          label: formatMessage({ id: 'Filename' })
        }}
        filter={{
          value: filter,
          onChange: setFilter,
          mapFilterValue: (filterValue, getFv) => {
            const value = (getFv || getFilterValue)(filterValue || []);
            return {
              filter: Object.assign({}, value, {
                createdAt: value.createdAt
                  ? {
                      startTime: value.createdAt.value[0],
                      endTime: value.createdAt.value[1]
                    }
                  : null,
                updatedAt: value.updatedAt
                  ? {
                      startTime: value.updatedAt.value[0],
                      endTime: value.updatedAt.value[1]
                    }
                  : null
              })
            };
          },
          list: [
            {
              type: InputFilterItem,
              props: { name: 'id', label: formatMessage({ id: 'ID' }) }
            },
            {
              type: InputFilterItem,
              props: { name: 'namespace', label: formatMessage({ id: 'Namespace' }) }
            },
            {
              type: NumberRangeFilterItem,
              props: { name: 'size', label: formatMessage({ id: 'Size' }), unit: 'K' }
            },
            {
              type: TypeDateRangePickerFilterItem,
              props: { label: formatMessage({ id: 'CreatedAt' }), name: 'createdAt', allowEmpty: [true, true] }
            },
            {
              type: TypeDateRangePickerFilterItem,
              props: { label: formatMessage({ id: 'UpdatedAt' }), name: 'updatedAt', allowEmpty: [true, true] }
            }
          ]
        }}
        {...Object.assign({}, apis.fileManager.getFileList, {
          dataFormat: data => {
            const list = data.pageData || [];
            dataRef.current = list;
            return {
              list,
              total: data.totalCount
            };
          }
        })}
        ref={ref}
        pagination={{ paramsType: 'data' }}
        name="file-manager-list"
        columns={[
          ...getColumns({ preview, getUrl, formatMessage }),
          {
            name: 'options',
            renderType: 'options',
            title: formatMessage({ id: 'Operation' }),
            fixed: 'right',
            getValueOf: item => {
              return [
                {
                  children: formatMessage({ id: 'Update' }),
                  buttonComponent: Upload.Field,
                  renderTips: () => null,
                  accept: ['*'],
                  showUploadList: false,
                  maxLength: 1,
                  ossUpload: ({ file }) => {
                    return ajax.postForm({
                      url: apis.fileManager.replaceFile.url,
                      params: { id: item.id },
                      data: { file }
                    });
                  },
                  onChange: () => {
                    message.success(formatMessage({ id: 'FileUpdateSuccess' }));
                    ref.current.reload();
                  }
                },
                {
                  children: formatMessage({ id: 'Rename' }),
                  onClick: () => {
                    const formModalApi = formModal({
                      title: formatMessage({ id: 'Rename' }),
                      size: 'small',
                      formProps: {
                        data: { filename: item.filename },
                        onSubmit: async data => {
                          const { data: resData } = await ajax(
                            Object.assign({}, apis.fileManager.renameFile, {
                              data: { id: item.id, filename: data.filename }
                            })
                          );

                          if (resData.code !== 0) {
                            return;
                          }
                          message.success(formatMessage({ id: 'RenameSuccess' }));
                          formModalApi.close();
                          ref.current.reload();
                        }
                      },
                      children: <FormInfo column={1} list={[<Input name="filename" label={formatMessage({ id: 'Filename' })} rule="REQ" />]} />
                    });
                  }
                },
                {
                  children: formatMessage({ id: 'Delete' }),
                  confirm: true,
                  onClick: async () => {
                    const { data: resData } = await ajax(
                      Object.assign({}, apis.fileManager.deleteFiles, {
                        data: { ids: [item.id] }
                      })
                    );
                    if (resData.code !== 0) {
                      return;
                    }
                    message.success(formatMessage({ id: 'DeleteSuccess' }));
                    ref.current.reload();
                  }
                }
              ];
            }
          }
        ]}
        rowSelection={rowSelection}
        selectedRows={selectedRows}
        batchActions={[
          {
            key: 'batch-add-filesystem',
            label: formatMessage({ id: 'BatchAddToFileSystem' }),
            onClick: handleBatchAddToFileSystem
          },
          {
            key: 'batch-download',
            label: formatMessage({ id: 'BatchDownloadZip' }),
            onClick: handleBatchDownload
          },
          {
            key: 'batch-delete',
            label: formatMessage({ id: 'BatchDelete' }),
            onClick: handleBatchDelete
          }
        ]}
        buttonGroup={{
          list: [
            {
              type: 'primary',
              children: formatMessage({ id: 'AddFile' }),
              onClick: () => {
                const modalApi = modal({
                  title: formatMessage({ id: 'AddFile' }),
                  children: <FileUpload />,
                  onClose: () => {
                    ref.current.reload();
                    modalApi.close();
                  },
                  footer: null
                });
              }
            }
          ]
        }}
        page={{
          ...pageProps,
          title: pageProps.title || formatMessage({ id: 'PageTitle' }),
          menuFixed: pageProps.menuFixed !== undefined ? pageProps.menuFixed : false,
          menu: pageProps.menu || <Menu items={menuItems} defaultCurrentKey="list" />
        }}
      />
    );
  })
);

export default List;
