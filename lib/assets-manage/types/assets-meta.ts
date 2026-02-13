import {AssetInfoFull, AssetInfoPartial} from './asset';

export interface AssetsChangeByReferMeta {
  added: AssetInfoFull[];
  copied: {
    from: AssetInfoFull;
    to: AssetInfoFull;
  }[];
  moved: {
    from: AssetInfoFull;
    to: AssetInfoFull;
  }[];
  modified: {
    from: AssetInfoFull;
    to: AssetInfoFull;
    changed: Partial<AssetInfoFull>;
  }[];
  deleted: AssetInfoFull[];
  isNeedAction: boolean;
}

export interface AssetStateChangeInfo {
  assetInfoListMeta: AssetInfoFull[];
  latestAssetInfoList: AssetInfoPartial[];
  stateChange: AssetsChangeByReferMeta;
}
