export interface TestCase<DataType = any, ResultType = any> {
  data: string;
  expected: any;
  description?: string[];
}
