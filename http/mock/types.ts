import http from 'http';
import {DeepEqualConfig, UrlProps} from '../../external';

/**
 * RequestConfig for Mock compare
 */
export interface RequestConfig<T = any> extends UrlProps {
  method: string;
  data?: T;
}
export interface MockFileContent<ResData = any> {
  /** Ignore this mock file */
  ignore?: boolean;
  includeObjectKeys?: DeepEqualConfig['includeObjectKeys'];
  excludeObjectKeys?: DeepEqualConfig['excludeObjectKeys'];
  ignoreComparePayload?: boolean;
  requestConfig: RequestConfig;
  resHeaders: http.IncomingHttpHeaders;
  resData: ResData;
}

export interface ParamsForFindMockInfoInDir {
  targetDir: string;
  options?: {
    /** relative path */
    allowedFileList?: string[];
    debugCompare?: boolean;
  };
}

export type MockFileFinder = (
  targetRequestConfig: RequestConfig
) => MockFileContent & {relativePath?: string};
