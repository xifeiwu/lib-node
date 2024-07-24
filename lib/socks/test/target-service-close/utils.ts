import { LogColors } from '../../external';

export const colors: {
  targetServer: LogColors;
  socksServer: LogColors;
  socksClient: LogColors;
  inSocketOfSocks: LogColors;
  outSocketOfSocks: LogColors;
} = {
  targetServer: 'red',
  socksServer: 'yellow',
  socksClient: 'green',
  inSocketOfSocks: 'blue',
  outSocketOfSocks: 'magenta',
};

export const targetServerInfo = {
  host: '127.0.0.1',
  port: 3300,
};
