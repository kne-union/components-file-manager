import {createWithRemoteLoader} from '@kne/remote-loader';
import getColumns from './getColumns';
import {Space, Button, App} from "antd";
import {useRef, useState} from 'react';

const FileListPage = createWithRemoteLoader({
    modules: ['components-core:Layout@TablePage', 'components-core:Filter', 'components-core:Global@usePreset', 'components-core:FormInfo', 'components-core:FileList@FileUpload', 'components-core:Modal@useModal']
})(({remoteModules}) => {
    const [TablePage, Filter, usePreset, FormInfo, FileUpload, useModal] = remoteModules;
    const {apis, ajax} = usePreset();
    const modal = useModal();
    const {SearchInput, getFilterValue} = Filter;
    const {InputFilterItem, NumberRangeFilterItem} = Filter.fields;
    const ref = useRef();
    const [filter, setFilter] = useState([]);
    const {message} = App.useApp();
    const formModal = FormInfo.useFormModal();
    const {Input} = FormInfo.fields;
    return (
        <TablePage {...Object.assign({}, apis.fileManager.getFileList, {
            params: Object.assign({}, {filter: getFilterValue(filter)})
        })} ref={ref} columns={[...getColumns(), {
            name: 'options',
            type: 'options',
            title: '操作',
            valueOf: (item) => {
                return [
                    {
                        children: '更新'
                    },
                    {
                        children: '重命名',
                        onClick: () => {
                            const formModalApi = formModal({
                                title: '重命名',
                                size: 'small',
                                formProps: {
                                    data: {filename: item.filename},
                                    onSubmit: async (data) => {
                                        const {data: resData} = await ajax(Object.assign({}, apis.fileManager, {
                                            data: {id: item.id, filename: data.filename}
                                        }));

                                        if (resData.code !== 0) {
                                            return;
                                        }
                                        message.success('修改成功');
                                        formModalApi.close();
                                        ref.current.reload();
                                    }
                                },
                                children: <FormInfo column={1} list={[
                                    <Input name="filename" label="文件名" rule="REQ"/>
                                ]}/>
                            });
                        }
                    },
                    {
                        children: '删除',
                        confirm: true,
                        onClick: async () => {
                            const {data: resData} = await ajax(Object.assign({}, apis.fileManager.deleteFile, {
                                data: {id: item.id}
                            }));
                            if (resData.code !== 0) {
                                return;
                            }
                            message.success('删除成功');
                            ref.current.reload();
                        }
                    }
                ];
            }
        }]} name="file-manager-list" pagination={{paramsType: 'params'}} page={{
            filter: {
                value: filter, onChange: setFilter, list: [
                    [<InputFilterItem name="namespace" label="来源"/>,
                        <NumberRangeFilterItem name="size" label="大小" unit="K"/>]
                ]
            },
            titleExtra: <Space>
                <SearchInput name="filename" label="文件名"/>
                <Button type="primary" onClick={() => {
                    const modalApi = modal({
                        title: '添加文件',
                        children: <FileUpload list={[]} onChange={() => {

                        }}/>,
                        onClose: () => {
                            ref.current.reload();
                            modalApi.close();
                        },
                        footer: null
                    });
                }}>添加文件</Button>
            </Space>
        }}/>
    );
});

export default FileListPage;
