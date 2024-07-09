import getApis from './getApis';

const Apis = ({ children }) => {
  return children({ getApis });
};

export default Apis;

export { getApis };
