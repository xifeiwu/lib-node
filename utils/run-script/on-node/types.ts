import {RunScriptInCPOptions, RunTargetScriptOptions} from '../../../types';

export interface RunScriptInCpParams {
  scriptPath: string;
  runScriptOptions: RunTargetScriptOptions;
  preScript?: RunScriptInCPOptions['preScript'];
}
