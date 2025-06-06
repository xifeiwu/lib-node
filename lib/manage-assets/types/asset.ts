/**
 * Info that can get from asset itself
 */

import {GoThroughDirOptions, PickPartial} from '../external';

interface Asset {
  sha1: string;
  shortId: string;
  relativePath: string;
  quality: number;
  extname: string;
  size: number;
  changeDate: Date;
  modifyDate: Date;
  accessCount: number;
  lastAccessDate: Date;
  description: string;
  folderId: number;
  deletedAt?: string;
}
/**
 * shortId is from basename
 */
export type AssetInfoFull = Pick<
  Asset,
  'sha1' | 'shortId' | 'relativePath' | 'extname' | 'size' | 'modifyDate' | 'changeDate' | 'deletedAt'
>;
export type AssetInfoPartial = PickPartial<AssetInfoFull, 'sha1' | 'shortId'>;

export type ShortIdToAssetInfo = Record<string, AssetInfoFull | AssetInfoFull[]>;

/**
 * @deprecated by ShortIdToAssetInfo
 */
export type IdToAssetInfo = Record<string, AssetInfoPartial | Array<AssetInfoPartial>>;

export interface GetAssetInfoParams {
  /** both rootDir and relativePath should be passed */
  relativePath: string;
  rootDir: string;
  /** recalculate id or not */
  reCalcId?: boolean;
  /** append short id to filename or not */
  appendShortId?: boolean;
  /** as cal sha1 will use a lot of time, a log can show what's in process */
  logging?: boolean;
}
export interface GetDirAssetOptions {
  goThroughDirOptions?: GoThroughDirOptions;
  getAssetInfoParams?: Omit<GetAssetInfoParams, 'rootDir' | 'relativePath'>;
}
