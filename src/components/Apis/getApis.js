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
    },
    downloadFiles: {
      url: `${prefix}/download-files`,
      method: 'POST'
    },
    folderTree: {
      url: `${prefix}/folder/tree`,
      method: 'GET'
    },
    folderMkdir: {
      url: `${prefix}/folder/mkdir`,
      method: 'POST'
    },
    folderUpload: {
      url: `${prefix}/folder/upload`,
      method: 'POST'
    },
    folderRemove: {
      url: `${prefix}/folder/remove`,
      method: 'POST'
    },
    folderMove: {
      url: `${prefix}/folder/move`,
      method: 'POST'
    },
    folderCopy: {
      url: `${prefix}/folder/copy`,
      method: 'POST'
    },
    folderRename: {
      url: `${prefix}/folder/rename`,
      method: 'POST'
    },
    folderAddFiles: {
      url: `${prefix}/folder/add-files`,
      method: 'POST'
    }
  };
};

export default getApis;
