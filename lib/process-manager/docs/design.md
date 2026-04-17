# 设计思想

本文档说明 `lib/process-manager` 各关键 feature 的设计思路与决策原因。

## process-manager 的核心价值

相比直接 spawn 一个 process，process-manager 提供：

- **统一标识**：每个子进程通过 `config.id` 唯一标识，避免重复启动。
- **状态持久化**：进程信息持久化到文件，可跨进程查询运行状态。
- **统一日志**：stdout/stderr 通过 RollingLogWriter 自动收集和滚动归档。
- **生命周期管理**：支持 spawn 失败重试、stop、restart。

## 1. 两种使用方式

### 独立函数（轻量）

`launchCpInDetachedMode` 和 `launchCpInMonitoredMode` 提供一次性调用入口，不需要实例化类。适合简单场景：启动一个子进程，持久化信息，调用方即可退出（detached）或挂起监控（monitored）。

`spawnConfig` 支持 `SpawnConfig | string`。传入脚本路径时，自动通过 `getSpawnConfigByScript` 推断 command 和 args（.ts → ts-node, .js → node）。

### Daemon 模式（完整编排）

`Daemon` 类管理多个 `LaunchCp` 实例，提供完整的生命周期控制（start、stop、restart、getInfo）。通过 `DaemonSocketServer` 暴露 Socket 接口，支持运行时远程控制。

**LaunchCp 类与独立函数的关系**：独立函数是简化入口，LaunchCp 类提供完整状态机。Daemon 需要持续追踪子进程状态，因此使用 LaunchCp 类。两者合并在 `daemon.ts` 中，因为 LaunchCp 类的唯一消费者是 Daemon。

## 2. 三层进程架构（Daemon 模式）

```
调用方（CLI）  ──spawn+IPC──▶  Daemon 进程  ──spawn+IPC──▶  业务子进程
               一次性传配置      常驻后台         可多个，各自独立
```

**为什么是三层而非两层？**

如果 CLI 直接 spawn 子进程，CLI 退出后子进程就失去了控制面。引入一个常驻的 Daemon 进程作为中间层，既能让子进程在后台独立运行，又能通过 Socket 随时控制它们。

## 3. 两阶段通信（Daemon 模式）

### IPC 阶段：启动时的一次性配置传递

`startDetachedDaemon` 通过 `spawnAndTryIpc` 拉起 Daemon 进程，把完整的 `SocketConfig`（包含所有子进程配置）作为 IPC 消息传入。Daemon 收到后完成初始化。

非 debug 模式下，父进程拿到首包响应后 `disconnect` + `unref`，Daemon 从此独立运行。

**设计选择**：IPC 只用一次，避免长期维护 IPC 通道的复杂性。

### Socket 阶段：运行时的命令控制

Daemon 启动 `startOneChatSocketServer`，采用"一问一答"模式：每个 Socket 连接收一帧 JSON `Command`，返回 `DaemonResponse` 后关闭连接。

**为什么用 one-chat 而非长连接？**

命令都是短操作（查状态、启停），无需保持长连接。one-chat 避免了连接管理、心跳、断线重连等复杂度。

## 4. LaunchCp 状态机

单个子进程的生命周期通过有限状态机管理，防止乱序调用：

```
init → toStart → toSpawn → running → toKill → onExit → exited
                                                  ↓
                                              toRestart → toSpawn → ...
```

`phaseConvertRule` 定义合法迁移路径，`changePhase` 会校验。

**关键决策**：

- `lastAction` 记录最近一次用户意图（`start`/`stop`/`restart`），`onExit` 时据此判断是否自动重试。只有 `lastAction === 'start'` 且未超 `maxCount` 时才重启。
- `stop` 和 `restart` 导致的退出不会触发自动重试，因为退出是预期的。
- `retryCount` 在每次 `startInMonitoredMode` 时重置为 0。

## 5. 日志

### 子进程输出日志

stdout/stderr 通过 `RollingLogWriter` 写入 `{cpId}/log/out.log` 和 `{cpId}/log/err.log`。

- `out.log` 收集 stdout + stderr（合并日志）
- `err.log` 只收集 stderr

文件超过大小限制时自动滚动归档（重命名为带日期的文件名），并根据总大小和文件数量清理旧归档。

**Daemon 模式**：stdio 为 `['ignore','pipe','pipe','ipc']`，always pipe stdout/stderr 并通过 `setupLogPipe` 写入。

**独立函数 monitored 模式**：通过 `MonitorConfig.logCpOut` 控制是否收集日志。为 true 时创建 outWriter/errWriter 并 pipe。

### 监控状态日志（独立函数 monitored 模式）

子进程状态变化（spawned、exited、retry）通过 `RollingLogWriter` 写入 `{cpId}/monitor/changes.log`，格式为 `[ISO时间] event details`。这与 LaunchCpInfo 持久化分开：

- `{cpId}/info/index.json`：当前快照（RollingSnapshotWriter）
- `{cpId}/monitor/changes.log`：变化历史（RollingLogWriter）

### 日志路径传递给子进程

无论哪种模式，`logOutPath` 和 `logErrPath` 都通过 `infoToCp` 传递给子进程。子进程可通过 `waitInfoFromParent()` (cp-util.ts) 接收 `InfoToCp`，获取自己的日志文件路径。

## 6. 状态持久化

每次 `changePhase()` 时，LaunchCp 通过 `RollingSnapshotWriter` 将完整的 `LaunchCpInfo` 写入 `{cpId}/info/index.json`（JSON 格式）。

`loadCpInfo()` 使用 `JSON.parse` 加载。`loadAllCpInfo()` 扫描所有 cpId 目录下的 info 文件。

**RollingSnapshotWriter**：每次写入时将旧文件重命名为带时间戳的归档文件，再写入新内容。通过 promise chain 串行化并发写入。

独立函数模式下同样使用 `RollingSnapshotWriter` 持久化 LaunchCpInfo，保持一致的数据格式。

## 7. 错误隔离

- 多个子进程的启停互不影响：`launchAllCpInConfigList` 和 `stopDaemon` 中，单个 CP 失败只 `console.error`，不阻断其他 CP。
- 状态持久化失败不阻断主流程。
- `handleCommand` 外层 try/catch，任何命令执行失败都返回 `{ type: 'error' }` 而非让 Daemon 崩溃。
