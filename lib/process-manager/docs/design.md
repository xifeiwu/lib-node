# 设计思想

本文档说明 `lib/process-manager` 各关键 feature 的设计思路与决策原因。

## 核心价值

相比直接 spawn 一个 process，process-manager 提供：

- **统一标识**：每个子进程通过 `config.id` 唯一标识，避免重复启动（`startProcess` 会检查 PID 是否存活）。
- **状态持久化**：进程信息持久化到文件，可跨进程查询运行状态。
- **统一日志**：stdout/stderr 通过 RollingLogWriter 自动收集和滚动归档。
- **生命周期管理**：支持 spawn 失败重试、stop、restart。

## 1. 分层架构

### modules 层（本模块）

纯逻辑层，只做进程操作和文件系统持久化，不涉及配置来源和用户交互。

- `service/operation.ts` — 高层操作 API：`startProcess`、`killProc`、`restartProcess`、`removeProcBaseDir`、`listProcKeyInfo`
- `launch-cp/` — 底层 spawn 实现：detached 和 monitored 两种模式
- `service/file.ts` — 路径工具和 `readProcInfo`

### 消费方层

消费方（如 busybox）在 modules 层之上叠加三层：

1. **config 层**（`src/2-process/config.ts`）：定义 `LaunchCpConfig` 列表，提供 `selectConfigById` 交互式选择配置。
2. **service 层**（`src/process-manager/service.ts`）：薄封装，职责是选择 configId 或 procId，然后委托 modules 层执行。不包含任何进程操作逻辑。
3. **command 层**（`src/process-manager/command.ts`）：CLI 解析（commander）和结果展示（logColorful）。所有用户可见的输出只在这一层。

**设计原则**：service 层的函数只做两件事 —— 选择 ID 和调用 modules 函数。这样 modules 层可以被任何消费方复用，不绑定特定的配置方式或 CLI 框架。

### 两种 ID 选择方式

- **selectConfigById** — 从配置列表中选择。用于 `start` 和 `restart`，因为需要完整的 `LaunchCpConfig` 来启动进程。
- **selectRunningOrRegisteredId** — 从 `PROCESS_MANAGER_ROOT_DIR` 下已存在的目录中选择。用于 `stop`、`info`、`cleanup`、`log`，因为这些操作只需要 cpId，不需要启动配置。

## 2. 两种启动模式

### Detached 模式

`launchCpInDetachedMode`：spawn 子进程后，父进程 disconnect + unref，子进程独立运行。适合"启动后不管"的场景。

### Monitored 模式

`launchCpInMonitoredMode`：父进程保持运行，pipe stdout/stderr 到日志文件，监听子进程退出事件。退出时根据 `monitorConfig.retry` 决定是否自动重启。

**选择逻辑**：`startProcess` 根据 `config.monitorConfig` 是否存在自动选择模式。有 `monitorConfig` 用 monitored，否则用 detached。

## 3. 进程操作 API（service/operation.ts）

`operation.ts` 是 modules 层的核心 API，基于文件系统状态执行操作：

- **startProcess(config)** — 检查进程是否已在运行（通过持久化的 PID），未运行时启动。
- **killProc(cpId, options?)** — 读取持久化的 PID，kill monitor 和 spawn 进程。`options.cleanUp` 为 true 时顺便删除 baseDir。
- **restartProcess(config, options?)** — `killProc(config.id)` + `startProcess(config)` 的组合。
- **removeProcBaseDir(cpId)** — 删除进程的所有持久化文件（info、log、monitor）。如果进程仍在运行会抛错，强制先 kill。
- **listProcKeyInfo()** — 扫描 `PROCESS_MANAGER_ROOT_DIR` 下所有目录，汇总各进程的关键信息（PID、状态、内存、命令）。

## 4. 日志

### 子进程输出日志

stdout/stderr 通过 `RollingLogWriter` 写入 `{cpId}/log/out.log` 和 `{cpId}/log/err.log`。

- `out.log` 收集 stdout + stderr（合并日志）
- `err.log` 只收集 stderr

文件超过大小限制时自动滚动归档。

### 监控状态日志（monitored 模式）

子进程状态变化（spawned、exited、retry）写入 `{cpId}/monitor/changes.log`，与 info 持久化分开：

- `{cpId}/info/index.json` — 当前快照（RollingSnapshotWriter）
- `{cpId}/monitor/changes.log` — 变化历史（RollingLogWriter）

### 日志路径传递给子进程

`logOutPath` 和 `logErrPath` 通过 `infoToCp` 传递给子进程。子进程可通过 `waitInfoFromParent()`（cp-util.ts）接收。

## 5. 状态持久化

启动时通过 `RollingSnapshotWriter` 将 `LaunchCpInfo` 写入 `{cpId}/info/index.json`。`readProcInfo` 读取该文件获取 spawn PID、monitor PID、命令等信息。

`removeProcBaseDir` 清理整个 `{cpId}/` 目录（info + log + monitor），但要求进程已停止。`killProc` 的 `cleanUp` 选项在 kill 后自动调用 `removeProcBaseDir`。

## 6. 错误隔离

- `launchCluster` 中单个进程启动失败只 `console.error`，不阻断其他进程。
- 状态持久化失败不阻断主流程。
