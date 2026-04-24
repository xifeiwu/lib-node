# Chat Log

## Q: SOCKS server pipe socket 是否会造成 hung socket connection leak？如何避免？

因为根据 SOCKS 协议，server 端会 pipe client socket with remote socket，有没有可能会造成 hung socket connections leak？

### 分析：存在 leak 风险

当前实现（修复前）有以下问题：

#### 1. `socketTimeout` 未生效

`socketTimeout` 作为参数传入 `pipeSocket`，但只用 `setTimeout` destroy 了 `socket2Remote`，没有覆盖 `clientSocket`。如果远端不关闭连接也不发数据，socket 会永久挂在内存里。

#### 2. 半开连接（half-open）处理不完整

`end` 事件处理只调用了对端的 `end()`，但如果对端不响应 FIN（比如网络中断），连接会一直停留在 `FIN_WAIT` 状态，没有 `setTimeout` 兜底。

#### 3. `pipeline` 的 error callback 没有主动清理

`pipeline` 回调中只记了日志，没有调用 `closeBoth()`。虽然 `pipeline` 在 error 时会 destroy source stream，但不保证对端 socket 也被清理。

#### 4. EncryptedSocket (vc1) 的 close 传播不完整

`EncryptedSocket`（`vc1/service.ts`）只监听了内层 socket 的 `error` 和自身的 `close`，没有处理内层 socket 的 `close` 事件。如果内层 socket 被远端关闭，`EncryptedSocket` 不一定会收到通知并 destroy。

### 修复

#### `server.ts` — `pipeSocket`

1. **`socketTimeout` 生效**：用 `socket.setTimeout()` 对两端 socket 都设置空闲超时，超时后 destroy 双方
2. **`pipeline` error 回调加了 `closeBoth()`**：pipe 出错时确保两端都被清理
3. **半开连接兜底**：`end` 事件后启动 30s 定时器（`HALF_OPEN_TIMEOUT`），如果对端没关闭就强制 destroy

#### `service/utils.ts`

- 新增 `connectionTimeout` 状态常量

#### `vc1/service.ts` — `EncryptedSocket`

- 监听内层 socket 的 `close` 事件，确保内层 socket 关闭时 `EncryptedSocket` 也被 destroy，双向传播完整
