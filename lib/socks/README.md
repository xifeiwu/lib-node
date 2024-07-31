## Key Point

1. Can get socket conneciton by tcp protocol directly or by http upgrade method.
2. 


## Ref

[SOCKS Protocol Version 5](https://datatracker.ietf.org/doc/html/rfc1928)
[Username/Password Authentication for SOCKS V5](https://datatracker.ietf.org/doc/html/rfc1929)

## Some principles

1. Function imported from external(not under current dir) should be re-export from file `./external.ts`, so we can clearly known which functions are from third-party, and copy them to current project when we want to export socks as a seperate project.
2. Type should seperate from logic to clarify whether it belongs to logic or type.