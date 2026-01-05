import {RunScriptInCPOptions, RunScriptOptions} from '../../../types';

export interface RunScriptInCpParams {
  scriptPath: string;
  runScriptOptions: RunScriptOptions;
  preScript?: RunScriptInCPOptions['preScript'];
}
