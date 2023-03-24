import assert from 'assert';
import { compressible, contentType, extension, lookup } from './mime-types';

/**
 * contentType: text/javascript; charset=utf-8
 * mimeType: text/javascript
 * ext: html, .html, .js
 */

export function extractReg() {
  const EXTRACT_TYPE_REGEXP = /^\s*([^;\s]*)(?:;|\s|$)/;
  let res = [];
  res = EXTRACT_TYPE_REGEXP.exec('text/javascript; charset=utf-8');
  assert.equal(res[0], 'text/javascript;');
  assert.equal(res[1], 'text/javascript');
  res = EXTRACT_TYPE_REGEXP.exec('text/javascript; charset=utf-8');
  assert.equal(res[0], 'text/javascript;');
  assert.equal(res[1], 'text/javascript');
}

export function testContentType() {
  assert.equal(lookup('html'), 'text/html');
  assert.equal(lookup('.html'), 'text/html');
  assert.equal(lookup('..html'), 'text/html');

  assert.equal(contentType('html'), 'text/html; charset=utf-8');
  assert.equal(contentType('.html'), 'text/html; charset=utf-8');
  assert.equal(contentType('..html'), 'text/html; charset=utf-8');

  assert.equal(extension('text/html; charset=utf-8'), 'html');
  assert.equal(extension(' text/html; charset=utf-8'), 'html');
  assert.equal(extension('text/html'), 'html');
  assert.equal(extension('html'), false);

  assert(compressible('text/html'));
  assert(compressible('html'));
}