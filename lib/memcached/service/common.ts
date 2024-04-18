import {CommandName} from './types';

export const firstLineReg = /^(set|add|replace|append|prepend|cas|get|gets|VALUE|END)( .*?)?(?: ?\r\n)?$/;

export function getCommand(chunk: Buffer): CommandName {
  const index = chunk.findIndex((it, index) => {
    return it === 0x0d && chunk[index + 1] === 0x0a;
  });
  const firstLine = chunk.subarray(0, index).toString('utf-8');
  const execRes = firstLineReg.exec(firstLine);
  if (!execRes) {
    throw new Error(`Error getCommand, format of first line command is not corrrect: ${firstLine}`);
  }
  return execRes[1] as CommandName;
}
