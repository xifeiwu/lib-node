# Intro

A cluster of commonly-used small-granularity logic based on nodejs native modules, the logic not depend on any third party modules except:

- modules/lib/fe
- modules/types/fe

# Folder Structure

1. The logic not based on any native module, it should be platform-independent logic, and belongs to lib/fe or service layer of this project.
2. The logic only based on a single native module, it should be placed in the folder named with that native module, they are called single-native-module-based logic
3. The logic based on multiple modules or functions from multiple dirs should be placed in dir utils.
4. The complex logic for some distinct target, like lib/socks, can place in a seperate dir of lib dir.
5. For the logic in utils and lib, they are relative complex and rarely used in most cases, so they are not exported in index.ts, and should be imported independently if want to use them.

# Notice

1. To avoid use dependency of `@types/node` on `lib/fe`, unit test case of `lib/fe` is located in dir `fe.test`.
2. Take care about export format: export * from './file'. When using this format, when tsc will compile all logic and the logic they referred. As this module is a common module that used widely, so index.ts should export as less logic as possible.

# TODO

1. dir net need refactor
