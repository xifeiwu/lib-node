export type LogColors = 'red' | 'yellow' | 'green' | 'blue' | 'magenta' | 'cyan' | 'black';
export interface ColorStyle {
  color?: LogColors;
}
export type LoggableContent = object | Buffer | string | number | boolean | Date;

export interface ContentWitStyle {
  content: LoggableContent;
  style?: ColorStyle;
}
