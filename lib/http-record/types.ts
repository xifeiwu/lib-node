import {DeepEqualConfig, FilterItem, NormalizedUrlProps} from '../../external';
import {GetFileListInfo, GetFileListOption, HttpResponseInfo, ParseHttpResponseOptions} from '../../types';

/**
 * The request options must follow NormalizedUrlProps interface for compare
 */
export interface RequestOptionsForMock<T = any> extends NormalizedUrlProps {
  method?: string;
  data?: T;
}

export interface RecordHttpOptions extends ParseHttpResponseOptions {
  /** request config for all requestConfig under requestConfigDir */
  defaultRequestOptions?: RequestOptionsForMock;
  /** fullpath have high priority than outputDir + getBasename*/
  fullPath?: string;
  outputDir?: string;
  getBasename?: (requestOptions: RequestOptionsForMock) => string;
  /** content of mock item passed directly from request config file to mock file */
  moreMockItems?: Partial<Omit<HttpRecordContent, 'requestOptions'>>;
  // getBaseName
}

export interface RecordHttpByDirOptions extends Omit<RecordHttpOptions, 'requestOptions'> {
  // targetDir: string;
  targetDirList: Array<GetFileListInfo>;
}

interface CompareConfig {
  ignore?: boolean;
  includeObjectKeys?: DeepEqualConfig['includeObjectKeys'];
  excludeObjectKeys?: DeepEqualConfig['excludeObjectKeys'];
}
export interface HttpRecordContent<ResData = any> {
  /** Ignore this mock file or not */
  ignore?: boolean;
  requestCompare?: {
    query?: CompareConfig;
    payload?: CompareConfig;
  };
  requestOptions: RequestOptionsForMock;
  responseInfo: HttpResponseInfo<ResData>;
}

/**
 * HttpRecordContent and it's related file info, it's useful when get HttpRecordContent from file or dir.
 */
export interface HttpRecordContenttWithPathInfo extends HttpRecordContent {
  fullPath: string;
  relativePath: string;
}

export interface FindRecordFileOptions {
  ingore?: boolean;
  targetDir: string;
  getFileListOptions?: GetFileListOption;
  /** relative path */
  includedFileList?: FilterItem[];
  excludedFileList?: FilterItem[];
  debugCompare?: boolean;
}

export type RecordFileFinder = (
  targetRequestConfig: RequestOptionsForMock
) => HttpRecordContent & {relativePath?: string};
