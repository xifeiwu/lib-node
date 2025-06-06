import {runFuncTestCases} from '../external';
import {appendShortIdToFilePath, parseFilePath, removeShortIdInFilePath} from './short-id';

export function testParseFilePath() {
  runFuncTestCases(parseFilePath, [
    {
      params: ['/dir/bar[ciSmd-].ts'],
      expected: {
        dirname: '/dir',
        basename: 'bar[ciSmd-].ts',
        extname: '.ts',
        bareBasename: 'bar[ciSmd-]',
        matched: '[ciSmd-]',
        shortId: 'ciSmd-',
        bareBasenameWithoutShortId: 'bar',
      },
    },
    {
      params: ['./dir/bar[ciSmd-].ts'],
      expected: {
        dirname: './dir',
        basename: 'bar[ciSmd-].ts',
        extname: '.ts',
        bareBasename: 'bar[ciSmd-]',
        matched: '[ciSmd-]',
        shortId: 'ciSmd-',
        bareBasenameWithoutShortId: 'bar',
      },
    },
    {
      params: ['bar[ciSmd-].ts'],
      expected: {
        dirname: '.',
        basename: 'bar[ciSmd-].ts',
        extname: '.ts',
        bareBasename: 'bar[ciSmd-]',
        matched: '[ciSmd-]',
        shortId: 'ciSmd-',
        bareBasenameWithoutShortId: 'bar',
      },
    },
  ]);
}

export function testAppendShortIdToFilePath() {
  runFuncTestCases(
    appendShortIdToFilePath,
    [
      {
        params: ['/dir/bar[ciSmd-].ts', '12S1d-'],
        expected: '/dir/bar[12S1d-].ts',
      },
      {
        params: ['./dir/bar[ciSmd-].ts', '12S1d-'],
        expected: 'dir/bar[12S1d-].ts',
      },
      {
        params: ['bar[ciSmd-].ts', '12S1d-'],
        expected: 'bar[12S1d-].ts',
      },
      {
        params: ['/dir/bar.ts', '12S1d-'],
        expected: '/dir/bar[12S1d-].ts',
      },
      {
        params: ['./dir/bar.ts', '12S1d-'],
        expected: 'dir/bar[12S1d-].ts',
      },
      {
        params: ['bar.ts', '12S1d-'],
        expected: 'bar[12S1d-].ts',
      },
    ],
    {dryRun: false}
  );
}

export function testRemoveShortIdInFilePath() {
  runFuncTestCases(
    removeShortIdInFilePath,
    [
      {
        params: ['/dir/bar[ciSmd-].ts'],
        expected: '/dir/bar.ts',
      },
      {
        params: ['./dir/bar[ciSmd-].ts'],
        expected: 'dir/bar.ts',
      },
      {
        params: ['bar[ciSmd-].ts'],
        expected: 'bar.ts',
      },
      {
        params: ['/dir/bar.ts'],
        expected: '/dir/bar.ts',
      },
      {
        params: ['./dir/bar.ts'],
        expected: './dir/bar.ts',
      },
      {
        params: ['bar.ts'],
        expected: 'bar.ts',
      },
    ],
    {dryRun: false}
  );
}
