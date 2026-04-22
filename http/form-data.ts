import fs from 'fs';
import path from 'path';
import {mime} from '../external';
import {toBuffer} from '../transform';
import {getDataFromReadable} from '../stream';
import {Readable} from 'stream';
import {CanConvertToBuffer} from '../types';
export class FormFile {
  contentType: string;
  filename: string;
  fullname: string;
  constructor(fullname: string) {
    if (!fs.existsSync(fullname)) {
      throw new Error(`Error, file ${fullname} not exist`);
    }
    this.fullname = fullname;
    const ext = path.extname(fullname);
    const basename = path.basename(fullname);
    this.contentType = mime.lookup(ext);
    this.filename = basename;
  }
  getReader() {
    return fs.createReadStream(this.fullname);
  }
}
export type FormValue = CanConvertToBuffer | FormFile;
export type NodeFormData = {
  [name: string]: Array<FormValue> | FormValue;
};

const ALPHA = 'abcdefghijklmnopqrstuvwxyz';
const DIGIT = '0123456789';
const ALPHA_DIGIT = ALPHA + ALPHA.toUpperCase() + DIGIT;
const BOUNDARY_ALPHABET = ALPHA_DIGIT + '-_';
const generateString = (size = 16, alphabet = ALPHA_DIGIT) => {
  let str = '';
  const {length} = alphabet;
  while (size--) {
    str += alphabet[(Math.random() * length) | 0];
  }
  return str;
};
const CRLF = '\r\n';
const CRLF_BYTES = Buffer.from(CRLF);
const CRLF_BYTES_COUNT = 2;

function escapeName(name) {
  return String(name).replace(
    /[\r\n"]/g,
    match =>
      ({
        '\r': '%0D',
        '\n': '%0A',
        '"': '%22',
      }[match])
  );
}
async function getFormPart(confg: {
  name: string;
  value: FormValue;
  boundaryBytes: Buffer;
  chunkedTransfer: boolean;
}) {
  const {name, value, boundaryBytes, chunkedTransfer} = confg;
  const bufferList: Buffer[] = [];
  bufferList.push(boundaryBytes);
  bufferList.push(toBuffer(`Content-Disposition: form-data; name="${escapeName(name)}"`));
  if (value instanceof FormFile) {
    bufferList.push(toBuffer(`; filename="${escapeName(value.filename)}"`));
  }
  bufferList.push(CRLF_BYTES);
  if (value instanceof FormFile) {
    bufferList.push(toBuffer(`Content-Type: ${value.contentType || 'application/octet-stream'}${CRLF}`));
  }
  bufferList.push(CRLF_BYTES);
  if (chunkedTransfer) {
    return Readable.from([
      Buffer.concat(bufferList),
      value instanceof FormFile ? value.getReader() : toBuffer([value, CRLF_BYTES]),
    ]);
  } else {
    bufferList.push(
      value instanceof FormFile ? await getDataFromReadable(value.getReader()) : toBuffer(value)
    );
    bufferList.push(CRLF_BYTES);
    return Buffer.concat(bufferList);
  }
}
export async function formDataToBuffer(
  formData: NodeFormData,
  options?: {
    tag?: string;
    size?: number;
    boundary?: string;
    chunkedTransfer?: boolean;
  }
) {
  const {
    tag = 'form-data-boundary',
    size = 25,
    boundary = tag + '-' + generateString(size, BOUNDARY_ALPHABET),
    chunkedTransfer: chunkedTransferPassed,
  } = options ?? {};
  const formItems = Object.entries(formData).reduce<Array<{name: string; value: FormValue}>>(
    (sum, [name, formValue]) => {
      if (Array.isArray(formValue)) {
        return [
          ...sum,
          ...formValue.map(it => {
            return {
              name,
              value: it,
            };
          }),
        ];
      } else {
        return [...sum, {name, value: formValue}];
      }
    },
    []
  );
  let chunkedTransfer: boolean = chunkedTransferPassed;
  if (chunkedTransferPassed === undefined) {
    chunkedTransfer = formItems.some(it => it.value instanceof FormFile);
  }

  if (boundary.length < 1 || boundary.length > 70) {
    throw Error('boundary must be 10-70 characters long');
  }
  const boundaryBytes = Buffer.from('--' + boundary + CRLF);
  const footerBytes = Buffer.from('--' + boundary + '--' + CRLF + CRLF);
  let contentLength = footerBytes.byteLength;

  const formPartList: Array<Buffer> | Array<Readable> = [];
  for (const formItem of formItems) {
    const formPart = (await getFormPart({
      ...formItem,
      boundaryBytes,
      chunkedTransfer,
    })) as Buffer;
    if (!chunkedTransfer) {
      contentLength += formPart.byteLength;
    }
    (formPartList as Buffer[]).push(formPart);
  }
  if (formItems.length > 0) {
    (formPartList as Buffer[]).push(footerBytes);
  }

  const headers = {
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
  };
  if (!chunkedTransfer) {
    headers['Content-Length'] = contentLength;
  } else {
    headers['Transfer-Encoding'] = 'chunked';
  }
  return {
    headers,
    reader: chunkedTransfer ? Readable.from(formPartList) : Buffer.concat(formPartList as Buffer[]),
  };
}
