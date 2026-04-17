# 与 Claude 的交流记录

记录开发 `lib/process-manager` 过程中与 Claude 的关键讨论和决策。

## 第一轮：日志收集

### 需求

> 添加获取任意指定子进程日志的方法

### 实现

**日志收集**：stdio 设为 `'pipe'`，stdout/stderr 通过 `RollingLogWriter` 写入 `~/.process-management/{cpId}/log/out.log` 和 `err.log`。

### 讨论要点

- **stdio 处理**：只替换 `'ignore'`，不动 debug 模式的 `0`/`1`/`2`（否则会破坏终端直接输出）

---

## 第二轮：重构 — per-cp 持久化 + 文件日志

### 问题分析

第一轮实现存在两个局限：
1. PID 持久化以 Daemon 为粒度，无法独立追踪每个子进程
2. 日志只在内存中，不适合大量日志

### 决策过程

**文件日志的 PID 问题**：spawn 前不知道 PID，无法预先创建以 PID 命名的文件。解决方案：stdio 设为 `pipe`，spawn 后知道 PID 再创建 WriteStream 并 pipe。

### 最终方案

详见 `design.md` 的第 4、5 节。

---

## 第三轮：重构 — RollingSnapshotWriter 状态持久化

### 需求

每次状态变化时，将完整的 `LaunchCpInfo` 持久化到 `{cpId}/info/index.json`。

### 实现

- `changePhase()` 每次调用时触发 `persistInfo()`
- 使用 `RollingSnapshotWriter` 保存为 JSON 格式
- `loadCpInfo()` 使用 `JSON.parse` 加载

---

## 第四轮：重构 — 拆分 launch-cp 为独立函数 + Daemon 整合

### 需求

将 launch-cp 的两种模式（detached 和 monitored）拆分为独立的函数模块，同时让 `LaunchCpConfig.spawnConfig` 支持 `SpawnConfig | string`（脚本路径）。

### 决策过程

1. **独立函数 vs 类**：detached 和 monitored 作为独立函数暴露（`launchCpInDetachedMode`、`launchCpInMonitoredMode`），提供简单的一次性调用入口，不需要实例化类。
2. **Daemon 仍需 LaunchCp 类**：Daemon 需要管理子进程的完整生命周期（start、stop、restart、getInfo），所以 `LaunchCp` 类和 `Daemon` 类合并到同一个 `daemon.ts` 文件中。
3. **MonitorInfo 独立存储**：在 monitored 模式下，子进程状态变化（spawn、exit、retry）通过 `RollingLogWriter` 写入 `{cpId}/monitor/changes.log`，与 LaunchCpInfo 分开。
4. **子进程工具函数**：`cp-util.ts` 提供 `waitInfoFromParent()`，封装 `waitIpcMessageOnce<InfoToCp>`，供子进程脚本使用。

### 主要改动

- 删除 `launch-cp.ts`，逻辑拆分到 `detached.ts`、`monitored.ts`、`daemon.ts`
- `validateAndApplyStdio` 移入 `monitored.ts`
- `LaunchCp` 类及其辅助函数移入 `daemon.ts`
- 新增 `cp-util.ts` 供子进程使用
- `service/file.ts` 新增 `getCpMonitorDir`
- `service/types.ts` 中 `LaunchCpConfig.spawnConfig` 改为 `SpawnConfig | string`
