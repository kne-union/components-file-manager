const getColumns = () => {
    return [
        {
            name: 'filename',
            title: '文件名',
            type: 'mainInfo'
        }, {
            name: 'size',
            title: '文件大小',
            type: 'other',
            valueOf: (item, {name}) => {
                const unit = ['K', 'M', 'G', 'T'];
                for (let index = 0; index < unit.length; index++) {
                    const value = item[name] / Math.pow(1024, index + 1);
                    if (value < 1024 || index === unit.length - 1) {
                        return `${value.toLocaleString()}${unit[index]}`;
                    }
                }
            }
        }, {
            name: 'namespace',
            title: '来源',
            type: 'other'
        }, {
            name: 'mimetype',
            title: '文件类型',
            type: 'other'
        }, {
            name: 'url',
            title: '访问地址',
            type: 'other'
        }, {
            name: 'updatedAt',
            title: '更新时间',
            type: 'datetime'
        }
    ];
};

export default getColumns;
