import {AssetInfoFull} from './asset';

export enum IgnoreReason {
  IS_LINK = 'Not support add link file',
  IS_EXIST = 'Source file already exists in rootDir',
}
export interface IgnoredAssets {
  reason: IgnoreReason;
  sourcePath?: string;
  sourceInfo?: AssetInfoFull;
  duplicatedInfo?: AssetInfoFull;
}
export interface OperatedAssets {
  source: AssetInfoFull;
  target: AssetInfoFull;
}
