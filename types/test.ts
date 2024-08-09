// export interface TestCase<ParamsType = any, ReturnType = any> {
//   params: ParamsType;
//   expected: ReturnType;
//   description?: string[];
// }

export interface FuncTestCase<FuncType extends (...param: any) => any> {
  params: Parameters<FuncType>;
  expected: ReturnType<FuncType>;
  description?: string[];
}

export interface InstanceTestCase<
  Cls extends  {[key: string]: Function | any},
  Key extends keyof Cls = any
> {
  instance: Cls;
  params: Parameters<Cls[Key]>;
  expected: ReturnType<Cls[Key]>;
  description?: string[];
}
