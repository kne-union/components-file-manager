const getApis = (options) => {
    const {prefix} = Object.assign({}, {prefix: '/api/v1/static'}, options);

    return {
        upload: {
            url: `${prefix}/upload`,
            method: 'POST'
        },
        getFileUrl: {
            url: `${prefix}/file-url/{id}`,
            method: 'GET'
        },
        getFile: {
            url: `${prefix}/file-id/{id}`,
            method: 'GET'
        },
        deleteFile: {
            url: `${prefix}/delete-file`,
            method: 'POST'
        },
        getFileList: {
            url: `${prefix}/file-list`,
            method: 'GET'
        }
    };
};

export default getApis;
