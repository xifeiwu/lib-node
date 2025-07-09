import path from 'path';
import {runTsScriptInCP} from '../run-in-cp/main';
import {logColorful} from '../../../log';

export async function testRunScriptExportInCP() {
  const scriptPath = path.join(__dirname, 'scripts/test.ts');
  const result = await runTsScriptInCP(scriptPath, {runScriptOptions: {funcParams: [10]}});
  logColorful({}, result);
}
// testRunScriptExportInCP();

export async function passFuncNameAndParams() {
  const scriptPath = path.join(__dirname, 'scripts/test.ts');
  const result = await runTsScriptInCP(scriptPath, {
    runScriptOptions: {selectExportedFunc: true, funcName: 'add1', funcParams: [10]},
  });
  logColorful({}, result);
}
passFuncNameAndParams();
