/**
 * Info that can get from asset itself
 */
import fs from 'fs';
import {GoThroughDirOptions, PickPartial} from '../external';

interface Asset {
  /** relative path to root dir, should be used as asset id */
  relativePath: string;
  extname: string;
  /** props from asset stat */
  size: number;
  changeDate: Date;
  modifyDate: Date;
  /** props from calculation */
  sha1: string;
  shortId: string;
  /** props from subjective decision */
  quality: number;
  description: string;
  /** props set by code */
  accessCount: number;
  lastAccessDate: Date;
  deletedAt?: string;
  folderId: number;
}
/**
 * shortId is from basename
 */
export type AssetInfoFull = Pick<
  Asset,
  'relativePath' | 'extname' | 'size' | 'modifyDate' | 'changeDate' | 'sha1' | 'shortId' | 'deletedAt'
>;
export type AssetInfoPartial = PickPartial<AssetInfoFull, 'sha1' | 'shortId'>;

export type ShortIdToAssetInfo = Record<string, AssetInfoFull | AssetInfoFull[]>;
export type Sha1ToAssetInfo = Record<string, AssetInfoFull | AssetInfoFull[]>;

/**
 * @deprecated by ShortIdToAssetInfo
 */
export type IdToAssetInfo = Record<string, AssetInfoPartial | Array<AssetInfoPartial>>;

export interface GetAssetInfoParams {
  /** both rootDir and relativePath should be passed */
  relativePath: string;
  rootDir: string;
  stat?: fs.Stats;
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
