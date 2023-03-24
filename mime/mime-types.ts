/**
 * refer from https://github.com/jshttp/mime-types/blob/master/index.js
 */

/*!
 * mime-types
 * Copyright(c) 2014 Jonathan Ong
 * Copyright(c) 2015 Douglas Christopher Wilson
 * MIT Licensed
 */

'use strict';

/**
 * Module dependencies.
 * @private
 */

import db from './db.json';
import {extname} from 'path';

/**
 * Module variables.
 * @private
 */

var EXTRACT_TYPE_REGEXP = /^\s*([^;\s]*)(?:;|\s|$)/;
var TEXT_TYPE_REGEXP = /^text\//i;

/**
 * Module
 * @public
 */

export const extensions = Object.create(null);
export const types = Object.create(null);

// Populate the extensions/types maps
populateMaps(extensions, types);

/**
 * Get the default charset for a MIME type.
 *
 * @param {string} type
 * @return {boolean|string}
 */

export function charset(type) {
  if (!type || typeof type !== 'string') {
    return false;
  }

  // TODO: use media-typer
  var match = EXTRACT_TYPE_REGEXP.exec(type);
  var mime = match && db[match[1].toLowerCase()];

  if (mime && mime.charset) {
    return mime.charset;
  }

  // default text/* to utf-8
  if (match && TEXT_TYPE_REGEXP.test(match[1])) {
    return 'UTF-8';
  }

  return false;
}

/**
 * Create a full Content-Type header given a MIME type or extension.
 *
 * @param {string} mimeTypeOrExtName
 * @return {boolean|string}
 */

export function contentType(mimeTypeOrExtName) {
  // TODO: should this even be in this module?
  if (!mimeTypeOrExtName || typeof mimeTypeOrExtName !== 'string') {
    return false;
  }

  var mimeType = mimeTypeOrExtName.indexOf('/') === -1 ? lookup(mimeTypeOrExtName) : mimeTypeOrExtName;

  if (!mimeType) {
    return false;
  }

  // TODO: use content-type or other module
  if (mimeType.indexOf('charset') === -1) {
    var _charset = charset(mimeType);
    if (_charset) mimeType += '; charset=' + _charset.toLowerCase();
  }

  return mimeType;
}

/**
 * Get the default extension for a MIME type.
 *
 * @param {string} mimeTypeOrContentType
 * @return {boolean|string}
 */
export function extension(mimeTypeOrContentType) {
  if (!mimeTypeOrContentType || typeof mimeTypeOrContentType !== 'string') {
    return false;
  }

  // TODO: use media-typer
  var match = EXTRACT_TYPE_REGEXP.exec(mimeTypeOrContentType);

  // get extensions
  var exts = match && extensions[match[1].toLowerCase()];

  if (!exts || !exts.length) {
    return false;
  }

  return exts[0];
}

/**
 * Lookup the MIME type for a file path/extension.
 *
 * @param {string} extName
 * @return {boolean|string}
 */
export function lookup(extName: string): string | false {
  if (!extName || typeof extName !== 'string') {
    return false;
  }

  // get the extension ("ext" or ".ext" or full path)
  var extension = extname('x.' + extName)
    .toLowerCase()
    .slice(1);

  if (!extension) {
    return false;
  }

  return types[extension] || false;
}

/**
 * Checks if a type is compressible.
 *
 * @param {string} type
 * @return {Boolean} compressible
 * @public
 */
const COMPRESSIBLE_TYPE_REGEXP = /^text\/|\+(?:json|text|xml)$/i;
export function compressible(contentTypeOrMimeTypeOrExtName?: string): boolean {
  if (!contentTypeOrMimeTypeOrExtName || typeof contentTypeOrMimeTypeOrExtName !== 'string') {
    return false;
  }

  let mimeType: string | boolean = contentTypeOrMimeTypeOrExtName;
  if (contentTypeOrMimeTypeOrExtName.indexOf('/') === -1) {
    mimeType = lookup(contentTypeOrMimeTypeOrExtName);
    if (!mimeType) {
      return false;
    }
  } else {
    var match = EXTRACT_TYPE_REGEXP.exec(contentTypeOrMimeTypeOrExtName);
    mimeType = match && match[1].toLowerCase();
  }

  // strip parameters
  if (!mimeType) {
    return false;
  }
  var data = db[mimeType];

  // return database information
  if (data && data.compressible !== undefined) {
    return data.compressible;
  }

  // fallback to regexp or unknown
  return COMPRESSIBLE_TYPE_REGEXP.test(mimeType);
}

/**
 * Populate the extensions and types maps.
 */
function populateMaps(extensions, types) {
  // source preference (least -> most)
  var preference = ['nginx', 'apache', undefined, 'iana'];

  Object.keys(db).forEach(function forEachMimeType(type) {
    var mime = db[type];
    var exts = mime.extensions;

    if (!exts || !exts.length) {
      return;
    }

    // mime -> extensions
    extensions[type] = exts;

    // extension -> mime
    for (var i = 0; i < exts.length; i++) {
      var extension = exts[i];

      if (types[extension]) {
        var from = preference.indexOf(db[types[extension]].source);
        var to = preference.indexOf(mime.source);

        if (
          types[extension] !== 'application/octet-stream' &&
          (from > to || (from === to && types[extension].slice(0, 12) === 'application/'))
        ) {
          // skip the remapping
          continue;
        }
      }

      // set the extension -> mime
      types[extension] = type;
    }
  });
}
