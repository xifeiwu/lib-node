/**
 * NOTICE:
 * Should take care of special character for filename, such as /
 */
export function getFileName(headerValue: string) {
  // matches either a quoted-string or a token (RFC 2616 section 19.5.1)
  const m = headerValue.match(/\bfilename=("(.*?)"|([^()<>{}[\]@,;:"?=\s/\t]+))($|;\s)/i);
  if (!m) return null;

  const match = m[2] || m[3] || '';
  let originalFilename = match.substr(match.lastIndexOf('\\') + 1);
  originalFilename = originalFilename.replace(/%22/g, '"');
  originalFilename = originalFilename.replace(/&#([\d]{4});/g, (_, code) => String.fromCharCode(code));

  return originalFilename;
}
