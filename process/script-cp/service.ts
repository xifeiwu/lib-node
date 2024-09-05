import {toConsole} from '../../index';

/** For child process */
export function out(value: any) {
  toConsole(value);
  process.send && process.send(value);
}
