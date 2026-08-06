import { createWithRemoteLoader } from '@kne/remote-loader';
import Fetch from '@kne/react-fetch';
import { useCallback, useMemo, useRef, useState } from 'react';
import { App, Button, Dropdown, Space, Upload } from 'antd';
import { DownOutlined, FolderAddOutlined, MinusSquareOutlined, UploadOutlined } from '@ant-design/icons';
import { useIntl } from '@kne/react-intl';
import withLocale from './withLocale';
import mapTreeToItems from './mapTreeToItems';
import useFolderPageCache from './useFolderPageCache';
import style from './style.module.scss';

// 与 @kne/react-file FilePreview 默认可预览后缀对齐
const PREVIEWABLE_FILE_PATTERN =
  /\.(txt|md|pdf|png|jpg|jpeg|gif|bmp|webp|svg|html|htm|doc|docx|xls|xlsx|ppt|pptx|csv|mp3|wav|ogg|aac|mp4|avi|mov|mkv|flv|zip|rar|7z|tar|gz|json)$/i;

const canPreviewEntry = entry => {
  if (!entry || entry.kind !== 'file' || !entry.fileId) {
    return false;
  }
  return PREVIEWABLE_FILE_PATTERN.test(entry.name || '');
};

const createDefaultFolderApis = ({ ajax, apis, type }) => ({
  listTree: async ({ kind } = {}) => {
    const { data: resData } = await ajax(
      Object.assign({}, apis.fileManager.folderTree, {
        params: Object.assign({ type }, kind ? { kind } : {})
      })
    );
    if (resData.code !== 0) {
      return [];
    }
    return resData.data || [];
  },
  listFolder: async ({ parentId, currentPage = 1, perPage = 40, keyword } = {}) => {
    const { data: resData } = await ajax(
      Object.assign({}, apis.fileManager.folderList, {
        data: {
          type,
          parentId: parentId || undefined,
          currentPage,
          perPage,
          keyword: keyword || undefined
        }
      })
    );
    if (resData.code !== 0) {
      return { pageData: [], totalCount: 0 };
    }
    return resData.data || { pageData: [], totalCount: 0 };
  },
  createFolder: async ({ name, parentId }) => {
    const { data: resData } = await ajax(
      Object.assign({}, apis.fileManager.folderMkdir, {
        data: { type, name, parentId: parentId || undefined }
      })
    );
    return resData;
  },
  uploadFile: async ({ file, parentId }) => {
    return ajax.postForm({
      url: apis.fileManager.folderUpload.url,
      params: { type, parentId: parentId || undefined },
      data: { file }
    });
  },
  remove: async ({ id }) => {
    const { data: resData } = await ajax(
      Object.assign({}, apis.fileManager.folderRemove, {
        data: { type, id }
      })
    );
    return resData;
  },
  move: async ({ ids, parentId }) => {
    const { data: resData } = await ajax(
      Object.assign({}, apis.fileManager.folderMove, {
        data: { type, ids, parentId: parentId || null }
      })
    );
    return resData;
  },
  copy: async ({ ids, parentId }) => {
    const { data: resData } = await ajax(
      Object.assign({}, apis.fileManager.folderCopy, {
        data: { type, ids, parentId: parentId || null }
      })
    );
    return resData;
  },
  rename: async ({ id, name }) => {
    const { data: resData } = await ajax(
      Object.assign({}, apis.fileManager.folderRename, {
        data: { type, id, name }
      })
    );
    return resData;
  }
});

const getTopLevelEntries = entries => {
  const ids = new Set((entries || []).map(item => item.id));
  return (entries || []).filter(item => item.parentId == null || !ids.has(item.parentId));
};

/** 批量下载：优先用选中文件的 fileId；文件夹选中时仅包含已加载子文件 */
const collectSelectedFileIds = (entries, loadedEntries = []) => {
  const selectedIds = new Set((entries || []).map(item => item.id));
  const fileIds = [];

  (entries || []).forEach(item => {
    if (item.kind === 'file' && item.fileId) {
      fileIds.push(item.fileId);
    }
  });

  const selectedFolderPaths = (entries || []).filter(item => item.kind === 'folder').map(item => item.path);
  if (selectedFolderPaths.length) {
    (loadedEntries || []).forEach(item => {
      if (!item || item.kind !== 'file' || !item.fileId) {
        return;
      }
      if (selectedIds.has(item.id)) {
        return;
      }
      if (selectedFolderPaths.some(folderPath => item.path.startsWith(folderPath))) {
        fileIds.push(item.fileId);
      }
    });
  }

  return [...new Set(fileIds)];
};

const collectDescendantIds = (rootId, allItems) => {
  const ids = new Set();
  const walk = parentId => {
    (allItems || []).forEach(item => {
      if (item.parentId === parentId && !ids.has(item.id)) {
        ids.add(item.id);
        walk(item.id);
      }
    });
  };
  walk(rootId);
  return ids;
};

const buildMoveTreeData = (allItems, disabledIds, rootLabel) => {
  const folders = (allItems || []).filter(item => item.kind === 'folder');
  const childrenMap = new Map();
  folders.forEach(folder => {
    const key = folder.parentId || '__root__';
    if (!childrenMap.has(key)) {
      childrenMap.set(key, []);
    }
    childrenMap.get(key).push(folder);
  });

  const walk = parentKey =>
    (childrenMap.get(parentKey) || []).map(folder => ({
      title: folder.name,
      value: folder.id,
      key: folder.id,
      disabled: disabledIds.has(folder.id),
      children: walk(folder.id)
    }));

  return [
    {
      title: rootLabel,
      value: '__root__',
      key: '__root__',
      children: walk('__root__')
    }
  ];
};

const FileSystemPagedBody = ({
  CoreFileSystem,
  folderItems,
  folderApis,
  currentPath,
  setCurrentPath,
  pathToIdRef,
  folderItemsRef,
  entriesRef,
  pageCacheInvalidateRef,
  className,
  title,
  defaultView,
  defaultPath,
  props,
  handleFileOpen,
  handleSelectionChange,
  renderFilePreview,
  canPreviewFile,
  getEntryStatus,
  propertiesActions,
  onPropertiesAction,
  toolbarExtraProp,
  selectedEntries,
  resolveParentId,
  handleReload,
  handleBatchDelete,
  handleBatchDownload,
  handleBatchMove,
  handleBatchCopy,
  handleCreateFolder,
  formatMessage,
  message,
  style: styleMod
}) => {
  folderItemsRef.current = folderItems;
  const pathToId = useMemo(() => {
    const map = new Map();
    folderItems.forEach(item => {
      if (item.kind === 'folder') {
        map.set(item.path, item.id);
      }
    });
    return map;
  }, [folderItems]);
  pathToIdRef.current = pathToId;

  const parentId = currentPath ? pathToId.get(currentPath) || null : null;
  const listFolder = useCallback(params => folderApis.listFolder(params), [folderApis]);
  const { entries, totalCount, loadingIndexes, ready, listings, handleVisibleRangeChange, registerFolder, invalidateAndReload } = useFolderPageCache({
    listFolder,
    parentId,
    parentPath: currentPath || '',
    pathToId,
    enabled: true
  });

  // 文件夹树只有 folder；把已分页加载的文件合并进 items，避免分栏展开列误用 folders-only index
  const indexItems = useMemo(() => {
    const map = new Map();
    (folderItems || []).forEach(item => {
      if (item?.path != null) {
        map.set(item.path, item);
      }
    });
    Object.keys(listings || {}).forEach(key => {
      ((listings[key] && listings[key].entries) || []).forEach(entry => {
        if (entry?.path != null) {
          map.set(entry.path, entry);
        }
      });
    });
    return Array.from(map.values());
  }, [folderItems, listings]);

  entriesRef.current = entries;
  pageCacheInvalidateRef.current = invalidateAndReload;

  return (
    <CoreFileSystem
      {...props}
      className={className}
      title={title}
      defaultView={defaultView}
      defaultPath={defaultPath}
      items={indexItems}
      entries={entries}
      totalCount={totalCount}
      loadingIndexes={loadingIndexes}
      ready={ready}
      columnListings={listings}
      onVisibleRangeChange={handleVisibleRangeChange}
      onRegisterFolder={registerFolder}
      onFileOpen={handleFileOpen}
      onSelectionChange={handleSelectionChange}
      onPathChange={setCurrentPath}
      renderFilePreview={renderFilePreview}
      canPreviewFile={canPreviewFile}
      getEntryStatus={getEntryStatus}
      propertiesActions={propertiesActions}
      onPropertiesAction={onPropertiesAction}
      toolbarExtra={({ clearSelection }) => {
        const hasSelection = selectedEntries.length > 0;
        const extraNode =
          typeof toolbarExtraProp === 'function'
            ? toolbarExtraProp({
                selectedEntries,
                currentPath,
                parentId: resolveParentId(),
                reload: handleReload,
                clearSelection
              })
            : toolbarExtraProp;

        const batchMenuItems = [
          {
            key: 'delete',
            label: formatMessage({ id: 'BatchDelete' }),
            danger: true,
            onClick: () => handleBatchDelete({ clearSelection })
          },
          {
            key: 'download',
            label: formatMessage({ id: 'BatchDownloadZip' }),
            onClick: () => handleBatchDownload()
          },
          {
            key: 'move',
            label: formatMessage({ id: 'MoveTo' }),
            onClick: () => handleBatchMove({ clearSelection })
          },
          {
            key: 'copy',
            label: formatMessage({ id: 'CopyTo' }),
            onClick: () => handleBatchCopy({ clearSelection })
          }
        ];

        return (
          <Space size={8} className={styleMod.toolbarExtra}>
            <Upload
              showUploadList={false}
              customRequest={async ({ file, onSuccess, onError }) => {
                try {
                  const response = await folderApis.uploadFile({
                    file,
                    parentId: resolveParentId()
                  });
                  if (response?.data?.code != null && response.data.code !== 0) {
                    onError?.(new Error('upload failed'));
                    return;
                  }
                  message.success(formatMessage({ id: 'UploadSuccess' }));
                  handleReload();
                  onSuccess?.(response);
                } catch (e) {
                  onError?.(e);
                }
              }}
            >
              <Button size="small" icon={<UploadOutlined />}>
                {formatMessage({ id: 'UploadFile' })}
              </Button>
            </Upload>
            <Button size="small" icon={<FolderAddOutlined />} onClick={handleCreateFolder}>
              {formatMessage({ id: 'CreateFolder' })}
            </Button>
            {hasSelection ? (
              <div className={styleMod.batchActions}>
                <Dropdown menu={{ items: batchMenuItems }} trigger={['click']}>
                  <Button size="small" className={styleMod.batchActionsBtn}>
                    {formatMessage({ id: 'BatchOperationsWithCount' }, { count: selectedEntries.length })}
                    <DownOutlined />
                  </Button>
                </Dropdown>
                <Button
                  size="small"
                  icon={<MinusSquareOutlined />}
                  title={formatMessage({ id: 'CancelSelection' })}
                  aria-label={formatMessage({ id: 'CancelSelection' })}
                  className={styleMod.batchActionsClearBtn}
                  onClick={() => clearSelection?.()}
                />
              </div>
            ) : null}
            {extraNode}
          </Space>
        );
      }}
    />
  );
};

const FileSystem = createWithRemoteLoader({
  modules: [
    'components-core:File@FileSystem',
    'components-core:Global@usePreset',
    'components-core:FormInfo',
    'components-core:FormInfo@useFormModal',
    'components-core:FilePreview',
    'components-core:Modal@useModal',
    'components-core:File@Download',
    'components-core:Icon'
  ]
})(
  withLocale(
    ({
      remoteModules,
      type,
      title,
      folderApis: folderApisProp,
      onFileOpen,
      onSelectionChange,
      className,
      defaultView,
      defaultPath,
      toolbarExtra: toolbarExtraProp,
      propertiesActions,
      onPropertiesAction: onPropertiesActionProp,
      renderFilePreview: renderFilePreviewProp,
      canPreviewFile: canPreviewFileProp,
      getEntryStatus,
      virtualScroll = true,
      ...props
    }) => {
      const [CoreFileSystem, usePreset, FormInfo, useFormModal, FilePreview, useModal, Download, Icon] = remoteModules;
      const { formatMessage } = useIntl();
      const { apis, ajax } = usePreset();
      const { message, modal: confirmModal } = App.useApp();
      const formModal = useFormModal();
      const modal = useModal();
      const { Input, TreeSelect } = FormInfo.fields;
      const fetchRef = useRef(null);
      const itemsRef = useRef([]);
      const folderItemsRef = useRef([]);
      const entriesRef = useRef([]);
      const pathToIdRef = useRef(new Map());
      const pageCacheInvalidateRef = useRef(null);
      const [currentPath, setCurrentPath] = useState(defaultPath || '');
      const [selectedEntries, setSelectedEntries] = useState([]);

      if (!type) {
        throw new Error('FileSystem 需要传入 type（业务域）');
      }

      const folderApis = useMemo(() => {
        return Object.assign({}, createDefaultFolderApis({ ajax, apis, type }), folderApisProp);
      }, [ajax, apis, folderApisProp, type]);

      const resolveParentId = useCallback(() => {
        if (!currentPath) {
          return null;
        }
        return pathToIdRef.current.get(currentPath) || null;
      }, [currentPath]);

      const handleReload = useCallback(() => {
        fetchRef.current?.reload?.();
        if (virtualScroll) {
          pageCacheInvalidateRef.current?.();
        }
      }, [virtualScroll]);

      const handleCreateFolder = useCallback(() => {
        const formModalApi = formModal({
          title: formatMessage({ id: 'CreateFolder' }),
          size: 'small',
          formProps: {
            onSubmit: async data => {
              const resData = await folderApis.createFolder({
                name: data.name,
                parentId: resolveParentId()
              });
              if (resData?.code != null && resData.code !== 0) {
                return;
              }
              message.success(formatMessage({ id: 'CreateFolderSuccess' }));
              formModalApi.close();
              handleReload();
            }
          },
          children: <FormInfo column={1} list={[<Input name="name" label={formatMessage({ id: 'FolderName' })} rule="REQ" />]} />
        });
      }, [FormInfo, Input, folderApis, formModal, formatMessage, handleReload, message, resolveParentId]);

      const handleFileOpen = useCallback(
        entry => {
          if (onFileOpen) {
            onFileOpen(entry);
            return;
          }
          if (!entry?.fileId) {
            return;
          }
          modal({
            title: (
              <Space>
                {formatMessage({ id: 'FilePreview' })}
                <Download id={entry.fileId} type="link" originName={entry.name} icon={<Icon type="xiazai" />} />
              </Space>
            ),
            children: <FilePreview id={entry.fileId} originName={entry.name} />,
            footer: null
          });
        },
        [Download, FilePreview, Icon, formatMessage, modal, onFileOpen]
      );

      const canPreviewFile = useCallback(
        entry => {
          if (typeof canPreviewFileProp === 'function') {
            return canPreviewFileProp(entry);
          }
          return canPreviewEntry(entry);
        },
        [canPreviewFileProp]
      );

      const renderFilePreview = useCallback(
        entry => {
          if (typeof renderFilePreviewProp === 'function') {
            return renderFilePreviewProp(entry);
          }
          if (!entry?.fileId) {
            return null;
          }
          return (
            <div className={style.galleryFilePreview}>
              <FilePreview key={entry.fileId} id={entry.fileId} originName={entry.name} />
            </div>
          );
        },
        [FilePreview, renderFilePreviewProp]
      );

      const handleSelectionChange = useCallback(
        entries => {
          setSelectedEntries(entries || []);
          onSelectionChange?.(entries);
        },
        [onSelectionChange]
      );

      const handleBatchDelete = useCallback(
        ({ clearSelection }) => {
          const targets = getTopLevelEntries(selectedEntries);
          if (!targets.length) {
            return;
          }
          confirmModal.confirm({
            title: formatMessage({ id: 'BatchDelete' }),
            content: formatMessage({ id: 'BatchDeleteConfirm' }, { count: targets.length }),
            onOk: async () => {
              for (const entry of targets) {
                const resData = await folderApis.remove({ id: entry.id });
                if (resData?.code != null && resData.code !== 0) {
                  return;
                }
              }
              message.success(formatMessage({ id: 'DeleteSuccess' }));
              clearSelection?.();
              handleReload();
            }
          });
        },
        [confirmModal, folderApis, formatMessage, handleReload, message, selectedEntries]
      );

      const handleBatchDownload = useCallback(async () => {
        const ids = collectSelectedFileIds(selectedEntries, virtualScroll ? entriesRef.current : itemsRef.current);
        if (!ids.length) {
          message.warning(formatMessage({ id: 'BatchDownloadEmpty' }));
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
      }, [Download, ajax, apis.fileManager.downloadFiles, formatMessage, message, selectedEntries, virtualScroll]);

      const handleBatchMove = useCallback(
        ({ clearSelection }) => {
          const targets = getTopLevelEntries(selectedEntries);
          if (!targets.length) {
            return;
          }
          const treeSource = virtualScroll ? folderItemsRef.current : itemsRef.current;
          const disabledIds = new Set();
          targets.forEach(entry => {
            if (entry.kind === 'folder') {
              disabledIds.add(entry.id);
              collectDescendantIds(entry.id, treeSource).forEach(id => disabledIds.add(id));
            }
          });
          const treeData = buildMoveTreeData(treeSource, disabledIds, formatMessage({ id: 'RootFolder' }));
          const formModalApi = formModal({
            title: formatMessage({ id: 'MoveTo' }),
            size: 'small',
            formProps: {
              data: { targetParentId: '__root__' },
              onSubmit: async data => {
                const resData = await folderApis.move({
                  ids: targets.map(item => item.id),
                  parentId: !data.targetParentId || data.targetParentId === '__root__' ? null : data.targetParentId
                });
                if (resData?.code != null && resData.code !== 0) {
                  return;
                }
                message.success(formatMessage({ id: 'MoveSuccess' }));
                formModalApi.close();
                clearSelection?.();
                handleReload();
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
                  />
                ]}
              />
            )
          });
        },
        [FormInfo, TreeSelect, folderApis, formModal, formatMessage, handleReload, message, selectedEntries, virtualScroll]
      );

      const handleBatchCopy = useCallback(
        ({ clearSelection }) => {
          const targets = getTopLevelEntries(selectedEntries);
          if (!targets.length) {
            return;
          }
          const treeSource = virtualScroll ? folderItemsRef.current : itemsRef.current;
          const disabledIds = new Set();
          targets.forEach(entry => {
            if (entry.kind === 'folder') {
              disabledIds.add(entry.id);
              collectDescendantIds(entry.id, treeSource).forEach(id => disabledIds.add(id));
            }
          });
          const treeData = buildMoveTreeData(treeSource, disabledIds, formatMessage({ id: 'RootFolder' }));
          const formModalApi = formModal({
            title: formatMessage({ id: 'CopyTo' }),
            size: 'small',
            formProps: {
              data: { targetParentId: '__root__' },
              onSubmit: async data => {
                const resData = await folderApis.copy({
                  ids: targets.map(item => item.id),
                  parentId: !data.targetParentId || data.targetParentId === '__root__' ? null : data.targetParentId
                });
                if (resData?.code != null && resData.code !== 0) {
                  return;
                }
                message.success(formatMessage({ id: 'CopySuccess' }));
                formModalApi.close();
                clearSelection?.();
                handleReload();
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
                  />
                ]}
              />
            )
          });
        },
        [FormInfo, TreeSelect, folderApis, formModal, formatMessage, handleReload, message, selectedEntries, virtualScroll]
      );

      const handleRename = useCallback(
        entry => {
          if (!entry?.id) {
            return;
          }
          const formModalApi = formModal({
            title: formatMessage({ id: 'Rename' }),
            size: 'small',
            formProps: {
              data: { name: entry.name },
              onSubmit: async data => {
                const resData = await folderApis.rename({ id: entry.id, name: data.name });
                if (resData?.code != null && resData.code !== 0) {
                  return;
                }
                message.success(formatMessage({ id: 'RenameSuccess' }));
                formModalApi.close();
                handleReload();
              }
            },
            children: <FormInfo column={1} list={[<Input name="name" label={formatMessage({ id: 'EntryName' })} rule="REQ" />]} />
          });
        },
        [FormInfo, Input, folderApis, formModal, formatMessage, handleReload, message]
      );

      const handleReplace = useCallback(
        entry => {
          if (!entry?.fileId) {
            return;
          }
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '*/*';
          input.onchange = async event => {
            const file = event.target?.files?.[0];
            if (!file) {
              message.warning(formatMessage({ id: 'ReplaceEmpty' }));
              return;
            }
            try {
              const response = await ajax.postForm({
                url: apis.fileManager.replaceFile.url,
                params: { id: entry.fileId },
                data: { file }
              });
              if (response?.data?.code != null && response.data.code !== 0) {
                return;
              }
              message.success(formatMessage({ id: 'ReplaceSuccess' }));
              handleReload();
            } catch (e) {
              // ajax 自身会提示
            }
          };
          input.click();
        },
        [ajax, apis.fileManager.replaceFile, formatMessage, handleReload, message]
      );

      const handlePropertiesAction = useCallback(
        (key, { entry, clearSelection }) => {
          if (key === 'view') {
            handleFileOpen(entry);
            return;
          }
          if (key === 'replace') {
            handleReplace(entry);
            return;
          }
          if (key === 'rename') {
            handleRename(entry);
            return;
          }
          if (key === 'download') {
            handleBatchDownload();
            return;
          }
          if (key === 'move') {
            handleBatchMove({ clearSelection });
            return;
          }
          if (key === 'copy') {
            handleBatchCopy({ clearSelection });
            return;
          }
          if (key === 'delete') {
            handleBatchDelete({ clearSelection });
          }
        },
        [handleBatchCopy, handleBatchDelete, handleBatchDownload, handleBatchMove, handleFileOpen, handleRename, handleReplace]
      );

      return (
        <Fetch
          loader={async () => (virtualScroll ? folderApis.listTree({ kind: 'folder' }) : folderApis.listTree())}
          render={({ data, reload, refresh }) => {
            fetchRef.current = { reload: reload || refresh };
            const items = mapTreeToItems(data || []);

            if (virtualScroll) {
              return (
                <FileSystemPagedBody
                  CoreFileSystem={CoreFileSystem}
                  folderItems={items}
                  folderApis={folderApis}
                  currentPath={currentPath}
                  setCurrentPath={setCurrentPath}
                  pathToIdRef={pathToIdRef}
                  folderItemsRef={folderItemsRef}
                  entriesRef={entriesRef}
                  pageCacheInvalidateRef={pageCacheInvalidateRef}
                  className={className}
                  title={title || formatMessage({ id: 'Files' })}
                  defaultView={defaultView}
                  defaultPath={defaultPath}
                  props={props}
                  handleFileOpen={handleFileOpen}
                  handleSelectionChange={handleSelectionChange}
                  renderFilePreview={renderFilePreview}
                  canPreviewFile={canPreviewFile}
                  getEntryStatus={getEntryStatus}
                  propertiesActions={propertiesActions}
                  onPropertiesAction={onPropertiesActionProp || handlePropertiesAction}
                  toolbarExtraProp={toolbarExtraProp}
                  selectedEntries={selectedEntries}
                  resolveParentId={resolveParentId}
                  handleReload={handleReload}
                  handleBatchDelete={handleBatchDelete}
                  handleBatchDownload={handleBatchDownload}
                  handleBatchMove={handleBatchMove}
                  handleBatchCopy={handleBatchCopy}
                  handleCreateFolder={handleCreateFolder}
                  formatMessage={formatMessage}
                  message={message}
                  style={style}
                />
              );
            }

            itemsRef.current = items;
            const pathToId = new Map();
            items.forEach(item => {
              if (item.kind === 'folder') {
                pathToId.set(item.path, item.id);
              }
            });
            pathToIdRef.current = pathToId;

            return (
              <CoreFileSystem
                {...props}
                className={className}
                title={title || formatMessage({ id: 'Files' })}
                defaultView={defaultView}
                defaultPath={defaultPath}
                items={items}
                onFileOpen={handleFileOpen}
                onSelectionChange={handleSelectionChange}
                onPathChange={setCurrentPath}
                renderFilePreview={renderFilePreview}
                canPreviewFile={canPreviewFile}
                getEntryStatus={getEntryStatus}
                propertiesActions={propertiesActions}
                onPropertiesAction={onPropertiesActionProp || handlePropertiesAction}
                toolbarExtra={({ clearSelection }) => {
                  const hasSelection = selectedEntries.length > 0;
                  const extraNode =
                    typeof toolbarExtraProp === 'function'
                      ? toolbarExtraProp({
                          selectedEntries,
                          currentPath,
                          parentId: resolveParentId(),
                          reload: handleReload,
                          clearSelection
                        })
                      : toolbarExtraProp;

                  const batchMenuItems = [
                    {
                      key: 'delete',
                      label: formatMessage({ id: 'BatchDelete' }),
                      danger: true,
                      onClick: () => handleBatchDelete({ clearSelection })
                    },
                    {
                      key: 'download',
                      label: formatMessage({ id: 'BatchDownloadZip' }),
                      onClick: () => handleBatchDownload()
                    },
                    {
                      key: 'move',
                      label: formatMessage({ id: 'MoveTo' }),
                      onClick: () => handleBatchMove({ clearSelection })
                    },
                    {
                      key: 'copy',
                      label: formatMessage({ id: 'CopyTo' }),
                      onClick: () => handleBatchCopy({ clearSelection })
                    }
                  ];

                  return (
                    <Space size={8} className={style.toolbarExtra}>
                      <Upload
                        showUploadList={false}
                        customRequest={async ({ file, onSuccess, onError }) => {
                          try {
                            const response = await folderApis.uploadFile({
                              file,
                              parentId: resolveParentId()
                            });
                            if (response?.data?.code != null && response.data.code !== 0) {
                              onError?.(new Error('upload failed'));
                              return;
                            }
                            message.success(formatMessage({ id: 'UploadSuccess' }));
                            handleReload();
                            onSuccess?.(response);
                          } catch (e) {
                            onError?.(e);
                          }
                        }}
                      >
                        <Button size="small" icon={<UploadOutlined />}>
                          {formatMessage({ id: 'UploadFile' })}
                        </Button>
                      </Upload>
                      <Button size="small" icon={<FolderAddOutlined />} onClick={handleCreateFolder}>
                        {formatMessage({ id: 'CreateFolder' })}
                      </Button>
                      {hasSelection ? (
                        <div className={style.batchActions}>
                          <Dropdown menu={{ items: batchMenuItems }} trigger={['click']}>
                            <Button size="small" className={style.batchActionsBtn}>
                              {formatMessage({ id: 'BatchOperationsWithCount' }, { count: selectedEntries.length })}
                              <DownOutlined />
                            </Button>
                          </Dropdown>
                          <Button
                            size="small"
                            icon={<MinusSquareOutlined />}
                            title={formatMessage({ id: 'CancelSelection' })}
                            aria-label={formatMessage({ id: 'CancelSelection' })}
                            className={style.batchActionsClearBtn}
                            onClick={() => clearSelection?.()}
                          />
                        </div>
                      ) : null}
                      {extraNode}
                    </Space>
                  );
                }}
              />
            );
          }}
        />
      );
    }
  )
);

export default FileSystem;
export { createDefaultFolderApis, mapTreeToItems, getTopLevelEntries, collectSelectedFileIds };
