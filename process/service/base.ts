import {PidToProcessInfo, ProcessInfo} from '../../types';

export function treeInfoList(infoList: ProcessInfo[]) {
  return infoList.reduce<PidToProcessInfo>((sum, it) => {
    const {pid} = it;
    return {
      ...sum,
      [pid]: it,
    };
  }, {});
}
