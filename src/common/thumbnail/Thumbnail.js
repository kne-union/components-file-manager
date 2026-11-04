import { useEffect, useState } from 'react';
import classnames from 'classnames';
import style from './style.module.scss';

const isEmptyId = id => id === undefined || id === null || id === '';

/** 加载中、失败或服务端不支持时渲染 fallback */
const Thumbnail = ({ loader, id, fallback = null, size, className }) => {
  const [src, setSrc] = useState(() => (loader && !isEmptyId(id) ? loader.peek(id) : null));

  useEffect(() => {
    if (!loader || isEmptyId(id)) {
      setSrc(null);
      return;
    }
    setSrc(loader.peek(id));
    return loader.request(id, setSrc);
  }, [loader, id]);

  if (!src) {
    return fallback;
  }
  return (
    <img
      className={classnames(style.thumbnail, className)}
      style={size ? { width: size, height: size } : undefined}
      src={src}
      alt=""
      draggable={false}
      onError={() => setSrc(null)}
    />
  );
};

export default Thumbnail;
