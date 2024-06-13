import http from 'http';
import {DeepEqualConfig, FilterItem, UrlProps} from '../../external';

/**
 * RequestConfig for Mock compare
 */
export interface RequestConfig<T = any> extends UrlProps {
  method?: string;
  data?: T;
}

interface CompareConfig {
  ignore?: boolean;
  includeObjectKeys?: DeepEqualConfig['includeObjectKeys'];
  excludeObjectKeys?: DeepEqualConfig['excludeObjectKeys'];
}
export interface MockFileContent<ResData = any> {
  /** Ignore this mock file */
  ignore?: boolean;
  queryCompare?: CompareConfig;
  payloadCompare?: CompareConfig;
  requestConfig: RequestConfig;
  resHeaders: http.IncomingHttpHeaders;
  resData: ResData;
}

export interface ParamsForFindMockInfoInDir {
  ingore?: boolean;
  targetDir: string;
  options?: {
    /** relative path */
    includedFileList?: FilterItem[];
    excludedFileList?: FilterItem[];
    debugCompare?: boolean;
  };
}

export type MockFileFinder = (
  targetRequestConfig: RequestConfig
) => MockFileContent & {relativePath?: string};
