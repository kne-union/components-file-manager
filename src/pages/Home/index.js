import {createWithRemoteLoader} from '@kne/remote-loader';
import getColumns from './getColumns';

const Home = createWithRemoteLoader({
    modules: ['Layout@TablePage','']
})(({remoteModules}) => {
    const [TablePage] = remoteModules;
    return (
        <TablePage columns={[...getColumns(), {
            name: 'options',
            type: 'options',
            title: '操作',
            valueOf: (item) => {
                return [
                    {
                        children: '删除',
                        confirm: true
                    }
                ];
            }
        }]}/>
    );
});

export default Home;
