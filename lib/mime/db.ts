/**
 * data of this file refer from https://github.com/jshttp/mime-db/blob/master/db.json, it only pick common type
 */

export default {
  'application/json': {
    source: 'iana',
    charset: 'UTF-8',
    compressible: true,
    extensions: ['json', 'map'],
  },
  'text/html': {
    source: 'iana',
    compressible: true,
    extensions: ['html', 'htm', 'shtml'],
  },
  'text/css': {
    source: 'iana',
    charset: 'UTF-8',
    compressible: true,
    extensions: ['css'],
  },
  'text/javascript': {
    source: 'iana',
    charset: 'UTF-8',
    compressible: true,
    extensions: ['js', 'mjs'],
  },
  'text/jsx': {
    compressible: true,
    extensions: ['jsx'],
  },
  'text/less': {
    compressible: true,
    extensions: ['less'],
  },
  'text/markdown': {
    source: 'iana',
    compressible: true,
    extensions: ['md', 'markdown'],
  },
  'image/jpeg': {
    source: 'iana',
    compressible: false,
    extensions: ['jpeg', 'jpg', 'jpe'],
  },
  'image/png': {
    source: 'iana',
    compressible: false,
    extensions: ['png'],
  },
  'image/webp': {
    source: 'iana',
    extensions: ['webp'],
  },
  'application/octet-stream': {
    source: 'iana',
    compressible: false,
    extensions: [
      'bin',
      'dms',
      'lrf',
      'mar',
      'so',
      'dist',
      'distz',
      'pkg',
      'bpk',
      'dump',
      'elc',
      'deploy',
      'exe',
      'dll',
      'deb',
      'dmg',
      'iso',
      'img',
      'msi',
      'msp',
      'msm',
      'buffer',
    ],
  },
};
