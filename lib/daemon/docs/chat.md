# 与 Claude 的交流记录

记录开发 `lib/daemon` 过程中与 Claude 的关键讨论和决策。

## 第一轮：日志收集 + 孤儿进程自动清理

### 需求

> 添加获取任意指定子进程日志的方法；daemon 启动的时候，能收集因为 daemon 线程异常退出导致的孤儿进程

### 实现

**日志收集**：在 CpManager 中添加内存环形缓冲区（`logBuffer`），`prepareStdioForLogging` 将 stdio 的 `'ignore'` 替换为 `'pipe'`，通过 `setupLogCapture` 监听 stdout/stderr 的 `data` 事件，按行缓冲写入 buffer。

**孤儿清理**：Daemon 将所有子进程 PID 持久化到 `~/.daemon/{daemonId}/pids.json`，启动时 `cleanupOrphanProcesses` 读取旧记录，检查 PID 存活后批量 kill。

### 讨论要点

- **行缓冲**：`data` 事件的 Buffer 不按行对齐，需要用 partial 变量累积不完整行
- **stdio 处理**：只替换 `'ignore'`，不动 debug 模式的 `0`/`1`/`2`（否则会破坏终端直接输出）
- **日志跨重启保留**：`logBuffer` 在子进程退出后不清空，方便查看崩溃前日志

---

## 第二轮：重构 — per-CpManager 持久化 + 交互式孤儿处理 + 三种日志模式

### 问题分析

第一轮实现存在三个局限：
1. PID 持久化以 Daemon 为粒度，无法独立追踪每个子进程
2. 孤儿进程只能自动 kill，用户没有选择权
3. 日志只有 memory 模式，不适合大量日志或实时流式查看

### 决策过程

**孤儿进程交互**：讨论了三种处理方式 —— 完全收养（获取 ChildProcess 句柄）、仅跟踪 PID、或全自动处理。

> 什么情况下会出现孤儿进程？

分析了四种场景：`kill -9`、OOM、未捕获异常、V8 崩溃。共同点是 Daemon 来不及执行 `stopDaemon()`。

最终选择**仅跟踪 PID + 支持 kill**，因为没有 ChildProcess 句柄就无法做到完全收养（无 exit 事件、无 stdout/stderr、无自动重试）。

**交互位置**：孤儿检测的交互提示必须在 CLI 层（`src/daemon/service.ts`）而非 Daemon 进程中完成，因为 Daemon 进程的 stdio 为 `'ignore'`（非 debug 模式），无法与用户交互。

**日志 socket 实现**：不使用项目已有的 `startSocketServer`（它会通过 `getSocketPath` 强加 `.socket` 后缀），改为直接用 `net.createServer` + `.listen(path)`，路径格式为 `{cpId}/{pid}.sock`。

**文件模式的 PID 问题**：spawn 前不知道 PID，无法预先创建以 PID 命名的文件。解决方案：stdio 设为 `pipe`，spawn 后知道 PID 再创建 WriteStream 并 pipe。

### 最终方案

详见 `设计思想.md` 的第 4、5 节。

主要改动文件：
- `types.ts` — 新增 `LogMode`、`PidInfoRecord`、`OrphanInfo`，`ResponseLog` 拆为三种模式
- `service.ts` — 持久化函数从 per-Daemon 改为 per-CpManager
- `cp-manager.ts` — 三种日志模式、orphan 支持、自行持久化
- `daemon.ts` — 删除旧 PID 逻辑，改为从 config.orphans 收养
- `src/daemon/service.ts` — 新增 `detectAndHandleOrphans` 交互式处理
- `src/daemon/command.ts` — log 命令支持 socket 流/file tail
