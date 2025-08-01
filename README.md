# Intro

A cluster of commonly-used small-granularity logic based on nodejs native modules, the logic not depend on any third party modules.

# Notice

1. To avoid use dependency of `@types/node` on `lib/fe`, unit test case of `lib/fe` is located in dir `fe.test`.
2. Take case about export format: export * from './file'. When using this format, when tsc will compile all logic and the logic they referred. As this module is a common module that used widely, so index.ts should export as less logic as possible.

# Folder Structure

1. Functions are categorized by the nodejs native module it mainly based on, if it's not very clear which category it belongs to, it can be placed in dir other first.
2. For the basic function not depends on any other function, and used across many functions, it should be placed in file of dir service
3. For the function that based many other functions, and implement a commonly-used loigc, it should be placed in file of dir util

Category by node native module
.
├── REAME.md
├── child-process
├── config
├── constants.ts
├── crypto
├── external.ts
├── fe
├── fs.test.ts
├── fs.ts
├── general.ts
├── http
├── index.ts
├── lib
├── log.test.ts
├── log.ts
├── mime
├── net
├── node_modules
├── package.json
├── path.test.ts
├── path.ts
├── process
├── service                 Basic logic used by other function
├── stream
├── test.test.ts
├── test.ts
├── transform
├── tsconfig.json
├── types
├── utils                   A group of frequently used logic based on other basic logics
└── yarn.lock

# Dependencies

fe/modules/libs

# TODO

1. dir net need refactor