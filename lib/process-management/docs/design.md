# 设计思想

本文档说明 `lib/process-management` 各关键 feature 的设计思路与决策原因。

## 对process做的逻辑

相比直接spawn一个process，process-management都做了哪些额外工作：

cp-wrapper:

- config.id, 每一个通过cp-wrapper启动的child process应该包含一个id，来唯一标识这个process。
- 保存cp的状态，支持spwan失败后，再次尝试spawn。
- 提供处理cp stdout/stderr的输出，写入日志文件。

- process-management的主要目的
- 统一存储process的相关信息。可以方便查询进程的运行状态，避免重复启动服务。
- 统一的日志输出方式
- 

## 1. 三层进程架构

```
调用方（CLI）  ──spawn+IPC──▶  Daemon 进程  ──spawn+IPC──▶  业务子进程
               一次性传配置      常驻后台         可多个，各自独立
```

**为什么是三层而非两层？**

如果 CLI 直接 spawn 子进程，CLI 退出后子进程就失去了控制面。引入一个常驻的 Daemon 进程作为中间层，既能让子进程在后台独立运行，又能通过 Socket 随时控制它们。

## 2. 两阶段通信

### IPC 阶段：启动时的一次性配置传递

`startDetachedDaemon` 通过 `spawnAndTryIpc` 拉起 Daemon 进程，把完整的 `DaemonConfig`（包含所有子进程配置）作为 IPC 消息传入。Daemon 收到后调用 `startAsCp` 完成初始化。

非 debug 模式下，父进程拿到首包响应后 `disconnect` + `unref`，Daemon 从此独立运行。

**设计选择**：IPC 只用一次，避免长期维护 IPC 通道的复杂性。

### Socket 阶段：运行时的命令控制

Daemon 启动 `startOneChatSocketServer`，采用"一问一答"模式：每个 Socket 连接收一帧 JSON `Command`，返回 `DaemonResponse` 后关闭连接。

**为什么用 one-chat 而非长连接？**

命令都是短操作（查状态、启停），无需保持长连接。one-chat 避免了连接管理、心跳、断线重连等复杂度。

**Socket path 默认策略**：未配置 `connection.socketConfig` 时，直接用 `config.id` 作为 socket path，保证"至少一条连接通道"的约束。

## 3. CpWrapper 状态机

单个子进程的生命周期通过有限状态机管理，防止乱序调用：

```
init → toStart → toSpawn → running → toKill → onExit → exited
                                                  ↓
                                              toRestart → toSpawn → ...
```

`statusConvertRule` 定义合法迁移路径，`changeStatus` 会校验。

**关键决策**：

- `lastAction` 记录最近一次用户意图（`start`/`stop`/`restart`），`onExit` 时据此判断是否自动重试。只有 `lastAction === 'start'` 且未超 `maxCount` 时才重启。
- `stop` 和 `restart` 导致的退出不会触发自动重试，因为退出是预期的。
- `retryCount` 在每次 `start` 时重置为 0。

## 4. 日志

子进程的 stdout/stderr 分别写入 `~/.process-management/{cpId}/{pid}.out` 和 `~/.process-management/{cpId}/{pid}.error`。用 `fs.createWriteStream` + `pipe`。

**为什么用 pipe 而非 fd？** spawn 前不知道 PID（PID 是 spawn 后才有的），无法预先创建以 PID 命名的文件。所以 stdio 设为 `pipe`，spawn 后再创建 WriteStream 并 pipe 过去。

CLI 端用 `spawn('tail', ['-f', ...])` 实现实时跟踪。

### stdio 处理

`prepareStdioForLogging` 将 stdio 中的 `'ignore'` 替换为 `'pipe'`，其他值（如 debug 模式的 `0`/`1`/`2`）不动。debug 模式下 `childProcess.stdout` 为 `null`，日志收集自动跳过。

## 5. 状态持久化

每次 `changeStatus()` 时，CpWrapper 通过 `RollingSnapshotWriter` 将完整的 `CpWrapperInfo` 写入 `~/.process-management/{cpId}/info/index.js`（CommonJS 格式）。

`scanAllInfoRecords()` 扫描所有 `~/.process-management/{cpId}/info/index.js`，用 `require()` 加载并返回 `status='running'` 的记录。

**RollingSnapshotWriter**：每次写入时将旧文件重命名为带时间戳的归档文件，再写入新内容。通过 promise chain 串行化并发写入。

## 6. 错误隔离

- 多个子进程的启停互不影响：`startAllCp` 和 `stopDaemon` 中，单个 CP 失败只 `console.error`，不阻断其他 CP。
- 状态持久化失败不阻断主流程。
- `handleCommand` 外层 try/catch，任何命令执行失败都返回 `{ type: 'error' }` 而非让 Daemon 崩溃。
