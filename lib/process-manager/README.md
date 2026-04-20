# process-manager

管理长期运行的子进程：启动、停止、重启、查看状态、获取日志。通过文件系统持久化进程状态，无需常驻 daemon。

## 功能

- **后台运行** — detached 模式下子进程独立运行，调用方退出不影响子进程。
- **自动重试** — monitored 模式下，子进程意外退出后按 `retry.maxCount` / `retry.minInterval` 自动重启。
- **状态持久化** — 进程信息持久化到 `~/.process-management/{cpId}/info/index.json`。
- **日志持久化** — stdout/stderr 通过 `RollingLogWriter` 写入 `~/.process-management/{cpId}/log/`。
- **批量管理** — `launchCluster` 批量启动多个子进程。

## 架构分层

本模块提供核心进程管理能力，不包含配置定义和 CLI。消费方（如 busybox）负责：

```
消费方 command 层    CLI 解析、结果展示（logColorful）
消费方 service 层    config/id 选择、委托调用 modules 层
消费方 config 层     定义 LaunchCpConfig、selectConfigById
─────────────────────────────────────────────────────
modules service 层   startProcess、killProc、restartProcess 等
modules launch-cp    launchCpInDetachedMode、launchCpInMonitoredMode
```

消费方 service 层的职责是薄封装：选择 configId（从配置列表）或 procId（从已注册目录），然后调用本模块的函数。所有实际的进程操作（spawn、kill、持久化、日志）都在本模块完成。

## 使用方式

### 启动单个进程

```typescript
import {startProcess} from './service';

const info = await startProcess({
  id: 'my-service',
  spawnConfig: {
    scriptPath: './my-service.ts',
    infoToCp: {port: 3333},
    maxWaitCpResInSec: 6,
  },
  monitorConfig: {retry: {maxCount: 3, minInterval: 5000}},
});
```

### 管理进程

```typescript
import {killProc, restartProcess, listProcKeyInfo, removeProcBaseDir} from './service';

await listProcKeyInfo();                          // 列出所有进程状态
await killProc('my-service');                     // 停止进程
await killProc('my-service', {cleanUp: true});    // 停止并清理文件
await restartProcess(config, {cleanUp: true});    // 重启（先 kill 再 start）
removeProcBaseDir('my-service');                   // 清理持久化文件（需先停止）
```

### 查看日志

```typescript
import {tailProcessOutLog} from './service';

await tailProcessOutLog('my-service');  // tail -f stdout 日志
```

## 配置

### LaunchCpConfig

```typescript
{
  id: string;                    // 进程标识，也是持久化目录名
  spawnConfig: {
    scriptPath: string;          // 脚本路径（.ts → ts-node, .js → node）
    infoToCp?: object;           // 通过 IPC 传递给子进程的数据
    maxWaitCpResInSec?: number;  // 等待子进程 IPC 响应的超时秒数
    spawnOptions?: object;       // Node.js spawn options
  };
  monitorConfig?: {              // 有此字段时使用 monitored 模式
    retry?: {
      maxCount?: number;         // 最大重试次数
      minInterval?: number;      // 重试间隔（ms）
    };
  };
}
```

## 日志

stdout/stderr 通过 `RollingLogWriter` 写入：
- `{cpId}/log/out.log` — stdout + stderr 合并日志
- `{cpId}/log/err.log` — 仅 stderr

文件超过大小限制时自动滚动归档。CLI 端使用 `tail -f` 实时跟踪。

## 文件结构

```
lib/process-manager/
├── service/
│   ├── operation.ts       核心操作：startProcess、killProc、restartProcess、
│   │                      removeProcBaseDir、listProcKeyInfo
│   ├── file.ts            路径工具（getProcBaseDir 等）、readProcInfo
│   ├── tail-file.ts       tailProcessOutLog、tailProcessErrLog
│   ├── types.ts           类型定义
│   ├── constants.ts       stdio 常量、文件名常量
│   ├── external.ts        跨模块依赖聚合
│   ├── launch-spawn-config.ts  SpawnConfig 解析
│   └── index.ts           公共导出
├── launch-cp/
│   ├── detached.ts        launchCpInDetachedMode：spawn + 持久化，父进程断开
│   ├── monitored.ts       launchCpInMonitoredMode：spawn + 日志管道 + 退出重试
│   ├── cluster.ts         launchCluster：批量启动
│   └── cp-util.ts         子进程工具（waitInfoFromParent）
├── index.ts               公共导出
├── README.md              本文件
└── docs/
    ├── design.md          设计决策
    ├── flow.md            代码流程
    └── chat.md            开发记录

运行时数据目录：
~/.process-management/
└── {cpId}/
    ├── info/
    │   └── index.json     运行信息（LaunchCpInfo）
    ├── log/
    │   ├── out.log        stdout + stderr 合并日志
    │   └── err.log        stderr 日志
    └── monitor/
        └── changes.log    状态变化日志（仅 monitored 模式）
```
