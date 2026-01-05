import path from 'path';
import {runScriptInCP} from '../run-script-in-cp';
import {logColorful} from '../../../log';

export async function testRunScriptExportInCP() {
  const scriptPath = path.join(__dirname, 'scripts/test.ts');
  const result = await runScriptInCP(scriptPath, {
    runScriptOptions: {selectExportedFunc: true, funcParams: [10]},
  });
  logColorful({}, result);
}
testRunScriptExportInCP();

export async function passFuncNameAndParams() {
  const scriptPath = path.join(__dirname, 'scripts/test.ts');
  const result = await runScriptInCP(scriptPath, {
    runScriptOptions: {selectExportedFunc: true, funcName: 'add1', funcParams: [10]},
  });
  logColorful({}, result);
}
// passFuncNameAndParams();
