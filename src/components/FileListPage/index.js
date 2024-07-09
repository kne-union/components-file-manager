import { createWithRemoteLoader } from '@kne/remote-loader';
import getColumns from './getColumns';
import { Space, Button, App } from 'antd';
import { useRef, useState } from 'react';

const FileListPage = createWithRemoteLoader({
  modules: [
    'components-core:Layout@TablePage',
    'components-core:Filter',
    'components-core:Global@usePreset',
    'components-core:FormInfo',
    'components-core:FileList@FileUpload',
    'components-core:Modal@useModal',
    'components-core:FilePreview',
    'components-core:File@Download',
    'components-core:Icon',
    'components-core:ConfirmButton'
  ]
})(({ remoteModules }) => {
  const [TablePage, Filter, usePreset, FormInfo, FileUpload, useModal, FilePreview, Download, Icon, ConfirmButton] = remoteModules;
  const { apis, ajax, staticUrl, ajaxPostForm } = usePreset();
  const modal = useModal();
  const { SearchInput, getFilterValue } = Filter;
  const { InputFilterItem, NumberRangeFilterItem } = Filter.fields;
  const ref = useRef();
  const [filter, setFilter] = useState([]);
  const { message } = App.useApp();
  const formModal = FormInfo.useFormModal();
  const { Input, Upload } = FormInfo.fields;
  const [selections, setSelections] = useState([]);

  return (
    <TablePage
      {...Object.assign({}, apis.fileManager.getFileList, {
        data: Object.assign({}, { filter: getFilterValue(filter) })
      })}
      rowSelection={{
        type: 'checkbox',
        columnWidth: 56,
        fixed: true,
        selectedRowKeys: selections.map(item => item.id),
        onChange: (selectedRowKeys, selectedRows) => {
          setSelections(selectedRows);
        }
      }}
      ref={ref}
      columns={[
        ...getColumns({
          preview: item => {
            modal({
              title: (
                <Space>
                  文件预览
                  <Download id={item.id} type="link" originName={item.filename} icon={<Icon type="xiazai" />} />
                </Space>
              ),
              children: <FilePreview id={item.id} originName={item.filename} />,
              footer: null
            });
          },
          getUrl: item => {
            return (
              (staticUrl || '') +
              apis.fileManager.getFileUrl.url.replace(/{([\s\S]+?)}/g, (match, name) => {
                return item[name];
              })
            );
          }
        }),
        {
          name: 'options',
          type: 'options',
          title: '操作',
          fixed: 'right',
          valueOf: item => {
            return [
              {
                children: '更新',
                buttonComponent: Upload.Field,
                renderTips: () => null,
                showUploadList: false,
                maxLength: 1,
                ossUpload: ({ file }) => {
                  return ajaxPostForm(apis.fileManager.replaceFile.url + `?id=${item.id}`, { file });
                },
                onChange: () => {
                  message.success('文件更新成功');
                  ref.current.reload();
                }
              },
              {
                children: '重命名',
                onClick: () => {
                  const formModalApi = formModal({
                    title: '重命名',
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
                        message.success('修改成功');
                        formModalApi.close();
                        ref.current.reload();
                      }
                    },
                    children: <FormInfo column={1} list={[<Input name="filename" label="文件名" rule="REQ" />]} />
                  });
                }
              },
              {
                children: '删除',
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
                  message.success('删除成功');
                  ref.current.reload();
                }
              }
            ];
          }
        }
      ]}
      name="file-manager-list"
      page={{
        filter: {
          value: filter,
          onChange: setFilter,
          list: [[<InputFilterItem name="namespace" label="来源" />, <NumberRangeFilterItem name="size" label="大小" unit="K" />]]
        },
        titleExtra: (
          <Space>
            <SearchInput name="filename" label="文件名" />
            <Button
              type="primary"
              onClick={() => {
                const modalApi = modal({
                  title: '添加文件',
                  children: <FileUpload />,
                  onClose: () => {
                    ref.current.reload();
                    modalApi.close();
                  },
                  footer: null
                });
              }}
            >
              添加文件
            </Button>
            <ConfirmButton
              disabled={selections.length === 0}
              onClick={async () => {
                const { data: resData } = await ajax(
                  Object.assign({}, apis.fileManager.deleteFiles, {
                    data: { ids: selections.map(({ id }) => id) }
                  })
                );
                if (resData.code !== 0) {
                  return;
                }
                message.success('删除成功');
                ref.current.reload();
              }}
            >
              批量删除
            </ConfirmButton>
          </Space>
        )
      }}
    />
  );
});

export default FileListPage;
