import {runFuncTestCases, runInstanceTestCase} from './test';

function addOne(v1: number, v2: number) {
  return v1 + v2 + 1;
}
export function howToRunFuncTestCases() {
  runFuncTestCases(addOne, [
    {
      params: [2, 3],
      expected: 6,
    },
  ]);
}

class Model {
  name: string;
  constructor(name) {
    this.name = name;
  }
  getName() {
    return this.name;
  }
}
export function howToRunInstanceTestCase() {
  runInstanceTestCase<Model, 'getName'>('getName', [
    {
      instance: new Model('m1'),
      params: [],
      expected: 'm1',
    },
  ]);
}
