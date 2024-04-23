// POST /posts/42/comments HTTP/1.1\r\n
export const httpFirstLineReg = /^(get|post|put|patch|options|delete|head|connect)\s([^\s]+)\s(http\/\d\.\d)(?:\r\n)?$/i;