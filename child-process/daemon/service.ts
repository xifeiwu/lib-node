import path from 'path';
export const rootDir  = path.join(process.env.HOME, '.daemon');
export const sockDir = path.join(rootDir, 'socks');