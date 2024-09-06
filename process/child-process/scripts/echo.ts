import readline from 'readline';
import {toBuffer, logColorful} from '../../../index';

/**
 * Echo content from ipc channel
 */
function startIpcListener() {
  process.on('message', chunk => {
    process.send(toBuffer(['ipc channel:', chunk]).toString());
  });
}

/**
 * Echo content from process.stdio
 */
export async function loopEcho() {
  const tips = ['to error: starts with e', 'no echo: start with i', 'to output: default'];
  logColorful({color: 'red'}, tips.join('\n'));
  const prefix = 'echo: ';
  const maxConversition = 10;
  let cnt = 0;
  const interact = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  while (cnt++ < maxConversition) {
    await new Promise<string>(res => {
      interact.question('input:', answer => {
        if (answer.startsWith('e')) {
          console.error(`${prefix}${answer}`);
        } else if (!answer.startsWith('i')) {
          console.log(`${prefix}${answer}`);
        }
        res(answer);
      });
    });
  }
  interact.close();
}

if (process.send) {
  startIpcListener();
}
loopEcho();
