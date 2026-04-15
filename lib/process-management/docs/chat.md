# 与 Claude 的交流记录

记录开发 `lib/process-management` 过程中与 Claude 的关键讨论和决策。

## 第一轮：日志收集

### 需求

> 添加获取任意指定子进程日志的方法

### 实现

**日志收集**：在 CpWrapper 中添加内存环形缓冲区（`logBuffer`），`prepareStdioForLogging` 将 stdio 的 `'ignore'` 替换为 `'pipe'`，通过 `setupLogCapture` 监听 stdout/stderr 的 `data` 事件，按行缓冲写入 buffer。

### 讨论要点

- **行缓冲**：`data` 事件的 Buffer 不按行对齐，需要用 partial 变量累积不完整行
- **stdio 处理**：只替换 `'ignore'`，不动 debug 模式的 `0`/`1`/`2`（否则会破坏终端直接输出）
- **日志跨重启保留**：`logBuffer` 在子进程退出后不清空，方便查看崩溃前日志

---

## 第二轮：重构 — per-CpWrapper 持久化 + 两种日志模式

### 问题分析

第一轮实现存在两个局限：
1. PID 持久化以 Daemon 为粒度，无法独立追踪每个子进程
2. 日志只有 memory 模式，不适合大量日志

### 决策过程

**文件模式的 PID 问题**：spawn 前不知道 PID，无法预先创建以 PID 命名的文件。解决方案：stdio 设为 `pipe`，spawn 后知道 PID 再创建 WriteStream 并 pipe。

### 最终方案

详见 `design.md` 的第 4、5 节。

主要改动文件：
- `types.ts` — 新增 `LogMode`，`ResponseLog` 拆为两种模式
- `service.ts` — 持久化函数从 per-Daemon 改为 per-CpWrapper
- `cp-wrapper.ts` — 两种日志模式、自行持久化
- `cp-cluster.ts` — 删除旧 PID 逻辑
- `src/daemon/command.ts` — log 命令支持 file tail

---

## 第三轮：重构 — RollingSnapshotWriter 状态持久化

### 需求

每次 CpWrapper 状态变化时，将完整的 `CpWrapperInfo` 持久化到 `{cpId}/info/index.js`。

### 实现

- `changeStatus()` 每次调用时触发 `persistInfo()`
- 使用 `RollingSnapshotWriter` 保存为 CommonJS 格式
- `loadInfo()` 使用 `require()` + cache clearing 加载
- `scanAllInfoRecords()` 扫描所有 cpId 目录，返回 `status='running'` 的记录
