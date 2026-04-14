# 设计思想

本文档说明 `lib/daemon` 各关键 feature 的设计思路与决策原因。

## 对process做的逻辑

相比直接spawn一个process，process-management都做了哪些额外工作：

cp-wrapper:

- config.id, 每一个通过cp-wrapper启动的child process应该包含一个id，来唯一标识这个process。
- 保存cp的状态，支持spwan失败后，再次尝试spawn。
- 提供处理cp stdout/stderr的输出，到文件，或socket。

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

`startDetachedDaemon` 通过 `spawnAndTryIpc` 拉起 Daemon 进程，把完整的 `DaemonConfig`（包含所有子进程配置、orphan 信息）作为 IPC 消息传入。Daemon 收到后调用 `startAsCp` 完成初始化。

非 debug 模式下，父进程拿到首包响应后 `disconnect` + `unref`，Daemon 从此独立运行。

**设计选择**：IPC 只用一次，避免长期维护 IPC 通道的复杂性。

### Socket 阶段：运行时的命令控制

Daemon 启动 `startOneChatSocketServer`，采用"一问一答"模式：每个 Socket 连接收一帧 JSON `Command`，返回 `DaemonResponse` 后关闭连接。

**为什么用 one-chat 而非长连接？**

命令都是短操作（查状态、启停），无需保持长连接。one-chat 避免了连接管理、心跳、断线重连等复杂度。

**Socket path 默认策略**：未配置 `connection.socketConfig` 时，直接用 `config.id` 作为 socket path，保证"至少一条连接通道"的约束。

## 3. CpManager 状态机

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

## 4. 三种日志模式

子进程的 stdout/stderr 支持三种收集模式，通过 `managerConfig.log.mode` 配置：

### memory（默认）

内存环形缓冲区，`maxLines` 行上限。适合轻量场景，日志通过 Socket 命令按需查询。

**行缓冲设计**：`data` 事件的 Buffer 不按行对齐，用 `stdoutPartial`/`stderrPartial` 累积不完整行，遇到 `\n` 才写入 `logBuffer`。`end` 事件刷入剩余内容。

**跨重启保留**：子进程退出后 `logBuffer` 不清空，可查看崩溃前日志。

### socket

Daemon 在 `~/.process-management/{cpId}/{pid}.sock` 启动一个流式 Unix socket server（`net.createServer`），stdout/stderr 数据实时广播给所有连接的客户端。

**为什么不用 `startSocketServer`？** 它会强加 `.socket` 后缀和路径规则。日志 socket 需要自定义路径格式（含 PID），直接用 `net.createServer` 更灵活。

CLI 端 `daemon log` 命令连接后 `socket.pipe(process.stdout)` 实现实时流。

### file

stdout/stderr 分别写入 `~/.process-management/{cpId}/{pid}.out` 和 `~/.process-management/{cpId}/{pid}.error`。用 `fs.createWriteStream` + `pipe`。

**为什么用 pipe 而非 fd？** spawn 前不知道 PID（PID 是 spawn 后才有的），无法预先创建以 PID 命名的文件。所以 stdio 设为 `pipe`，spawn 后再创建 WriteStream 并 pipe 过去。

CLI 端用 `spawn('tail', ['-f', ...])` 实现实时跟踪。

### stdio 处理

`prepareStdioForLogging` 将 stdio 中的 `'ignore'` 替换为 `'pipe'`，其他值（如 debug 模式的 `0`/`1`/`2`）不动。debug 模式下 `childProcess.stdout` 为 `null`，日志收集自动跳过。

## 5. 孤儿进程处理

### 问题场景

Daemon 被 `kill -9`、OOM、未捕获异常等原因异常退出时，子进程变为孤儿（ppid 变为 1）。

### Per-CpManager 持久化

每个 CpManager spawn 后将运行信息写入 `~/.process-management/{cpId}/info.json`：

```json
{
  "pid": 12345,
  "startAt": "2026-01-01T00:00:00.000Z",
  "status": "running",
  "logMode": "memory",
  "daemonId": "busybox-daemon"
}
```

退出时更新 `status` 为 `'exited'`。

**为什么按 CpManager 而非 Daemon 粒度持久化？** 每个子进程独立追踪，跨 Daemon 实例也能发现孤儿，且不依赖 Daemon 的 PID。

### 交互式处理（CLI 层）

孤儿检测在 CLI 层（`src/daemon/service.ts`）而非 Daemon 进程中完成，因为 Daemon 的 stdio 为 `'ignore'`，无法交互。

流程：
1. `scanAllPidInfoRecords()` 扫描所有 `~/.process-management/{cpId}/info.json`，找到 `status='running'` 的记录
2. `process.kill(pid, 0)` 检查是否存活
3. 存活的提示用户选择：**Adopt**（收养到新 Daemon）或 **Kill**（立即终止）
4. Adopt 的进程作为 `OrphanInfo[]` 传入 `DaemonConfig.orphans`，Daemon 启动时用 `CpManager.createOrphan` 创建仅跟踪 PID 的管理器

**Adopt 的限制**：没有 `ChildProcess` 句柄，无法捕获 exit 事件、无法读取 stdout/stderr、不支持自动重试。只能跟踪 PID 并执行 kill。

## 6. 错误隔离

- 多个子进程的启停互不影响：`startAllCp` 和 `stopDaemon` 中，单个 CP 失败只 `console.error`，不阻断其他 CP。
- PID 持久化失败不阻断主流程。
- `handleCommand` 外层 try/catch，任何命令执行失败都返回 `{ type: 'error' }` 而非让 Daemon 崩溃。
