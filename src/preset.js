import React from 'react';
import { preset as fetchPreset } from '@kne/react-fetch';
import { Spin, Empty, message } from 'antd';
import createAjax from '@kne/axios-fetch';
import { preset as remoteLoaderPreset } from '@kne/remote-loader';

window.PUBLIC_URL = window.runtimePublicUrl || process.env.PUBLIC_URL;

export const globalInit = async () => {
  const ajax = createAjax({
    errorHandler: errorMessage => message.error(errorMessage || '请求发生错误'),
    showResponseError: response => {
      if (response.config.showError === false) {
        return false;
      }
      return response.status !== 200;
    },
    getResponseError: response => response?.data?.msg,
    validateStatus: function () {
      return true;
    }
  });
  fetchPreset({
    ajax,
    loading: (
      <Spin
        delay={500}
        style={{
          position: 'absolute',
          left: '50%',
          padding: '10px',
          transform: 'translateX(-50%)'
        }}
      />
    ),
    error: null,
    empty: <Empty />,
    transformResponse: response => {
      const { data } = response;
      response.data = {
        code: data.code === 0 ? 200 : data.code,
        msg: data.msg,
        results: data.data
      };
      return response;
    }
  });
  const registry = {
    url: 'https://uc.fatalent.cn',
    tpl: '{{url}}/packages/@kne-components/{{remote}}/{{version}}/build'
  };

  const componentsCoreRemote = {
    ...registry,
    //url: 'http://localhost:3001',
    //tpl: '{{url}}',
    remote: 'components-core',
    defaultVersion: '0.5.33'
  };
  remoteLoaderPreset({
    remotes: {
      default: componentsCoreRemote,
      'components-core': componentsCoreRemote,
      'components-iconfont': {
        ...registry,
        remote: 'components-iconfont',
        defaultVersion: '0.1.8'
      },
      'components-file-manager':
        process.env.NODE_ENV === 'development'
          ? {
              remote: 'components-file-manager',
              url: '/',
              tpl: '{{url}}'
            }
          : {
              ...registry,
              remote: 'components-file-manager',
              defaultVersion: process.env.DEFAULT_VERSION
            }
    }
  });

  return {
    ajax,
    apis: {
      oss: {
        url: '/api/v1/static/file-url/{id}',
        paramsType: 'urlParams',
        ignoreSuccessState: true
      },
      ossUpload: async ({ file }) => {
        return ajax.postForm({
          url: '/api/v1/static/upload',
          data: { file }
        });
      }
    }
  };
};
