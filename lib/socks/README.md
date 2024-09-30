## About Version

1. Protocol v5 is a standard protocol defined in [SOCKS Protocol Version 5](https://datatracker.ietf.org/doc/html/rfc1928)
2. vc is custom version used by self, do best to try to be compitable with v5, but may changed at any time.

## Some principles

1. Function imported from external(not under current dir) should be re-export from file `./external.ts`, so we can clearly known which functions are from third-party, and copy them to current project when we want to export socks as a seperate project.
2. Type should seperate from logic to clarify whether it belongs to logic or type.

## Ref

[SOCKS Protocol Version 5](https://datatracker.ietf.org/doc/html/rfc1928)
[Username/Password Authentication for SOCKS V5](https://datatracker.ietf.org/doc/html/rfc1929)
