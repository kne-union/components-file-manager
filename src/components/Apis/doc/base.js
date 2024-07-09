const { default: Apis } = _Apis;
const BaseExample = () => {
  return <Apis>{({getApis})=>{
    console.log(getApis());
    return null;
  }}</Apis>;
};

render(<BaseExample />);
