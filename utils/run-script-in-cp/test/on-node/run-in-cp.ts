import path from 'path';
import {runScriptInCP} from '../../main';
import {logColorful} from '../../../../log';
import {NodeCpWrapScriptOptions} from '../../types';

export async function testRunScriptExportInCP() {
  const scriptPath = path.join(__dirname, 'scripts/test.ts');
  const result = await runScriptInCP<NodeCpWrapScriptOptions>(scriptPath, {
    spawnWrapperOptions: {
      infoToCp: {runTargetScriptOptions: {runExportedFunc: true, funcParams: [10]}},
    },
  });
  logColorful({}, result);
}
testRunScriptExportInCP();

export async function passFuncNameAndParams() {
  const scriptPath = path.join(__dirname, 'scripts/test.ts');
  const result = await runScriptInCP<NodeCpWrapScriptOptions>(scriptPath, {
    spawnWrapperOptions: {
      infoToCp: {
        runTargetScriptOptions: {runExportedFunc: true, funcName: 'add1', funcParams: [10]},
      },
    },
  });
  logColorful({}, result);
}
// passFuncNameAndParams();
