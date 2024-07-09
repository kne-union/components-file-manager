const getApis = options => {
  const { prefix } = Object.assign({}, { prefix: '/api/v1/static' }, options);

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
    deleteFiles: {
      url: `${prefix}/delete-files`,
      method: 'POST'
    },
    replaceFile: {
      url: `${prefix}/replace-file`,
      method: 'POST'
    },
    renameFile: {
      url: `${prefix}/rename-file`,
      method: 'POST'
    },
    getFileList: {
      url: `${prefix}/file-list`,
      method: 'POST'
    }
  };
};

export default getApis;
