import fs from 'fs';
import path from 'path';
import {Readable} from 'stream';
import {getFileInfoTree} from '../fs';
import {byteToWord} from '../external';
import {GoThroughDirOptions, HtmlProps, LiProps} from '../types';

export function liItem(item: LiProps) {
  const {href, label, style = {}} = item;
  const finalLabel = label ?? href;
  const styleStr = Object.entries(style)
    .map(([key, value]) => {
      return key + ': ' + value;
    })
    .join(';');
  return [
    '<li',
    styleStr.length > 0 ? ' ' + styleStr : '',
    '>',
    href ? `<a href=${href}>${finalLabel}</a>` : finalLabel,
    '</li>',
  ].join('');
}
export function ulItems(items: Array<LiProps>) {
  return ['<ul>', ...items.map(liItem), '</ul>'].join('');
}

export function toHtml(props?: HtmlProps) {
  const {title = '', body = ''} = props ?? {};
  return `<html>
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <meta name="viewport" content="initial-scale=1, width=device-width, maximum-scale=1, user-scalable=no" />
    <link rel="stylesheet" href="">
    <title>${title}</title>
    <script>
    window.addEventListener('load', function() {
    });
    </script>
    <style>
    </style>
  </head>
  <body>
    ${body}
  </body>
</html>`;
}

export function htmlUlItems(config: {items: Array<LiProps>; htmlProps?: HtmlProps}) {
  const {items, htmlProps} = config;
  const {title = '', body = ''} = htmlProps ?? {};
  return toHtml({
    title,
    body: body + ulItems(items),
  });
}

// return file list in the form of <ul><li></li></ul>
export function ulDirContent(dir: string, options?: GoThroughDirOptions) {
  options = {
    maxDepth: 1,
    ignoreError: true,
    ...(options ?? {}),
  };
  const stat = fs.statSync(dir);
  if (!stat.isDirectory()) {
    throw new Error('not a directory');
  }
  try {
    const {children} = getFileInfoTree(dir, options);
    const liItems = children.map(it => {
      const {
        relativePath,
        stats: {size},
      } = it;
      let label: LiProps['label'] = `${relativePath} [${byteToWord(size)}]`;
      let href: LiProps['href'] = relativePath;
      let style: LiProps['style'];
      try {
        const statInfo = fs.statSync(path.resolve(dir, relativePath));
        if (statInfo.isDirectory()) {
          href = href + '/';
        } else if (statInfo.isFile()) {
        } else {
          style = {
            color: 'red',
          };
        }
      } catch (err) {
        label = label + ' ' + err?.message;
      }
      return {label, href, style};
    });
    return ulItems(liItems);
  } catch (err) {
    return `<div>${err.message}</div>`;
  }
}

export function htmlDirContent(dir: string, options?: GoThroughDirOptions, htmlProps?: HtmlProps) {
  const {title = `content of ${path.basename(dir)}`, body = ''} = htmlProps ?? {};
  return toHtml({
    title,
    body: body + ulDirContent(dir, options),
  });
}

/**
 * response for a file or dir
 */
export function streamFileContent(targetFile: string) {
  if (!targetFile) {
    return null;
  }
  if (!fs.existsSync(targetFile)) {
    return null;
  }
  const statInfo = fs.statSync(targetFile);
  if (statInfo.isDirectory()) {
    const body = htmlDirContent(targetFile);
    return new Readable({
      read() {
        this.push(body);
        this.push(null);
      },
    });
  } else if (statInfo.isFile()) {
    return fs.createReadStream(targetFile);
  }
}
