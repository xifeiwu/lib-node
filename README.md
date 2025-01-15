## Intro

Commonly used logic based on native node runtime, and not depend on any third party modules.

## Notice

1. To avoid dependency of `@types/node` on `lib/fe`, unit test case of `lib/fe` is located in dir `fe.test`.

## Structure

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

## Dependencies

fe/modules/libs