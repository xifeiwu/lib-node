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

## Q: 开启 socket 是比较耗资源的操作吗？

不算特别耗资源，但也不能忽略。主要成本：

1. **文件描述符（fd）**：每个 socket 占一个 fd，OS 有上限（默认通常 1024 或 65535），fd 耗尽后整个进程无法建立任何新连接
2. **内核内存**：每个 TCP 连接在内核中维护发送/接收缓冲区（通常各 ~128KB），加上 TCP 控制块，单个连接大约消耗几百 KB 内核内存
3. **用户态内存**：Node.js 侧的 `Socket` 对象、事件监听器、Buffer 等，单个连接开销相对小

单个 socket 本身不贵，但 **leak 的问题在于累积**。SOCKS server 作为代理，每个客户端请求会同时持有两个 socket（client + remote）。如果 hung connection 不释放，fd 和内存会线性增长，最终导致：
- `EMFILE` / `ENFILE`（fd 耗尽，无法 accept 新连接）
- 内存压力增大，GC 变慢

所以超时机制的主要价值不在于省单个 socket 的资源，而是**防止长时间累积导致资源枯竭**。

## Q: socket 的 end, close, destroy 的关系是什么？

正常流程是 `end` → `destroy` → `close`，但各自角色不同：

### `end`（事件/方法）
- 作为方法：发送 FIN，表示"我这边写完了"
- 作为事件：收到对端 FIN，表示"对端写完了"
- 此时 socket 还活着，fd 未释放，仍可读取剩余数据

### `destroy`（方法）
- 强制销毁 socket，释放 fd，丢弃所有缓冲区数据
- 不需要等对端响应
- 调用后 `socket.destroyed = true`

### `close`（事件）
- socket 的 fd 被释放后触发，是 socket 生命周期的终点
- 只有事件，没有同名方法
- `destroy()` 之后必然触发 `close`

```
正常关闭:  end() → 对端 end → destroy → close 事件
超时兜底:  end() → 等不到对端响应 → destroy → close 事件
异常场景:  error → destroy → close 事件
```

在 `pipeSocket` 中的逻辑就是沿着这条链路设计的：`end` 时先优雅通知，`socketHalfOpenTimeout` 后强制 `destroy`，最终在 `close` 事件里确保两端都被清理。

## Q: end 之后需要等对方回应再 destroy 吗？

不需要主动等。Node.js 的 `Socket` 在双方都 `end()` 之后会自动 destroy 并触发 `close`。

但问题在于**对方可能不回应**（网络中断、对端进程挂了等），这时 socket 就会一直卡在半开状态。所以 `socketHalfOpenTimeout` 就是为这种情况设计的：

```
正常: end() → 对端 end → 自动 destroy → close
异常: end() → 对端无响应 → 30s 后强制 destroy → close
```

`closeBoth()` 里有 `if (!socket.destroyed)` 判断，所以如果正常流程中 socket 已经自动 destroy 了，`setTimeout` 回调就是空操作，不会重复 destroy。
