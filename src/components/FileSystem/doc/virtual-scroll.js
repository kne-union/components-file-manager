const { default: FileSystem } = _FileSystem;
const { default: mockPreset, folderRequestBus } = _mockPreset;
const { createWithRemoteLoader } = remoteLoader;
const { useEffect, useState } = React;

const formatTime = ts => {
  const d = new Date(ts);
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map(n => String(n).padStart(2, '0'))
    .join(':')
    .concat('.')
    .concat(String(d.getMilliseconds()).padStart(3, '0'));
};

const formatRange = range => (Array.isArray(range) && range.length === 2 ? `${range[0]}–${range[1]}` : '-');

const RequestLogPanel = () => {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    if (!folderRequestBus || typeof folderRequestBus.addEventListener !== 'function') {
      return undefined;
    }
    const onRequest = event => {
      const detail = event.detail;
      if (!detail || detail.api !== 'folder/list') {
        return;
      }
      setLogs(prev => {
        const next = prev.slice();
        const index = next.findIndex(item => item.requestId && item.requestId === detail.requestId);
        if (index >= 0) {
          next[index] = Object.assign({}, next[index], detail);
        } else {
          next.unshift(detail);
        }
        return next.slice(0, 24);
      });
    };
    folderRequestBus.addEventListener('request', onRequest);
    return () => folderRequestBus.removeEventListener('request', onRequest);
  }, []);

  const pendingCount = logs.filter(item => item.phase === 'start').length;

  return (
    <div
      style={{
        flex: '0 0 360px',
        height: '100%',
        overflow: 'auto',
        border: '1px solid #d9d9d9',
        borderRadius: 8,
        padding: 12,
        background: '#fafafa',
        fontSize: 12,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>分页加载时间线</div>
      <div style={{ color: '#666', marginBottom: 8, lineHeight: 1.5 }}>
        mock 模拟真实 RTT：首包约 0.5–0.8s，翻页越往后越慢。看左侧 skeleton，右侧看
        <code> start → done </code>。
      </div>
      <div style={{ marginBottom: 12, color: pendingCount ? '#d46b08' : '#52c41a' }}>
        {pendingCount > 0 ? `进行中 ${pendingCount} 个请求…` : '空闲'}
      </div>
      {logs.length === 0 ? <div style={{ color: '#999' }}>暂无请求：双击进入「大目录-虚拟滚动」，再慢慢向下滚</div> : null}
      {logs.map(item => {
        const req = item.request || {};
        const res = item.response || {};
        const loading = item.phase === 'start';
        return (
          <div
            key={item.requestId || `${item.at}`}
            style={{
              marginBottom: 10,
              padding: 8,
              borderRadius: 6,
              background: loading ? '#e6f4ff' : item.isBulk ? '#fff7e6' : '#fff',
              border: `1px solid ${loading ? '#91caff' : item.isBulk ? '#ffd591' : '#eee'}`
            }}
          >
            <div style={{ marginBottom: 6, fontWeight: 600 }}>
              {loading ? '⏳ 请求中' : '✅ 已返回'} · page {req.currentPage}
              {item.isBulk ? ' · bulk' : ''}
            </div>
            <div style={{ marginBottom: 4, color: '#666' }}>
              {formatTime(item.at)} · {item.parentName || '(root)'}
            </div>
            <div style={{ lineHeight: 1.6 }}>
              <div>
                body: type={String(req.type)} parentId={String(req.parentId)} perPage={String(req.perPage)}
              </div>
              {loading ? (
                <div>
                  预计返回条目 {formatRange(res.expectedRange)} / 共 {res.totalHint}，模拟延迟 ~{item.latencyMs}ms
                </div>
              ) : (
                <div>
                  实际返回 {res.pageDataLength} 条（{formatRange(res.range)}）/ 共 {res.totalCount}
                  {res.hasMore ? '，还有更多' : '，本目录已到末页'}
                  <br />
                  耗时 {item.durationMs}ms
                  {res.pageNames?.length ? ` · 例: ${res.pageNames.join(', ')}` : ''}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const BaseExample = createWithRemoteLoader({
  modules: ['components-core:Global@PureGlobal', 'components-core:Layout']
})(({ remoteModules }) => {
  const [PureGlobal, Layout] = remoteModules;
  return (
    <PureGlobal preset={mockPreset}>
      <Layout navigation={{ isFixed: false }}>
        <div style={{ padding: 16, height: 640, display: 'flex', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0, height: '100%' }}>
            {/*
              列表视图更容易看到行级 skeleton；大目录滚动时右侧时间线会显示 start→done。
            */}
            <FileSystem type="demo" title="演示文件库（虚拟滚动）" defaultView="list" propertiesPanel />
          </div>
          <RequestLogPanel />
        </div>
      </Layout>
    </PureGlobal>
  );
});

render(<BaseExample />);
