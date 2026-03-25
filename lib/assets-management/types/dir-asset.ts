/**
 * Describe all asset info of dir in tree format
 */

import {AssetInfoFull} from '.';

export type AssetTree = {
  relativePath: string;
  children?: Array<AssetTree | AssetInfoFull>;
};

export interface AssetTreeMeta extends AssetTree {
  rootDir: string;
}

export interface AssetListMeta {
  rootDir: string;
  assetInfoList: AssetInfoFull[];
}

export type AssetMeta = AssetTreeMeta | AssetListMeta;
