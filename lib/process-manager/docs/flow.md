# 代码流程

本文档描述 `lib/process-manager` 各核心操作的代码执行路径。

## 1. 完整调用链（消费方 → modules）

以 `pm start my-service` 为例：

```
command.ts          CLI 解析，调用 service 层
  │
  ▼
service.ts          selectConfigById(id) → 得到 LaunchCpConfig
  │                 moduleStartProcess(config)
  ▼
operation.ts        startProcess(config)
  │                 检查 isManagedProcPidAlive → 防止重复启动
  │                 根据 monitorConfig 选择模式
  ▼
detached.ts         launchCpInDetachedMode(config)
或 monitored.ts     launchCpInMonitoredMode(config)
```

## 2. Detached 模式

```
launchCpInDetachedMode(config)              // launch-cp/detached.ts
  │
  ├─ 解析 spawnConfig
  │   └─ string → getSpawnConfigByScript()
  │
  ├─ 注入日志路径到 infoToCp
  │   └─ {logOutPath, logErrPath}
  │
  ├─ spawnInDetachedMode(enriched)
  │   ├─ stdio: ['ignore','ignore','ignore','ipc'], detached: true
  │   ├─ spawnAndTryIpc → spawn + IPC 握手
  │   └─ disconnect + unref
  │
  ├─ 构建 LaunchCpInfo
  │   └─ serializeSpawnResponse → spawnInfo
  │
  └─ RollingSnapshotWriter.save → {cpId}/info/index.json
```

## 3. Monitored 模式

```
launchCpInMonitoredMode(config)             // launch-cp/monitored.ts
  │
  ├─ 解析 spawnConfig
  │   └─ string → getSpawnConfigByScript()
  │
  ├─ validateAndApplyStdio(MONITORED_STDIO)
  │   └─ stdio: ['ignore','pipe','pipe','ipc']
  │
  ├─ 注入日志路径到 infoToCp
  │
  ├─ 创建 writers
  │   ├─ infoWriter: RollingSnapshotWriter → {cpId}/info/index.json
  │   ├─ changesWriter: RollingLogWriter → {cpId}/monitor/changes.log
  │   └─ logCpOut? outWriter + errWriter → {cpId}/log/
  │
  └─ doSpawn()  ←──────────────────────────── 可递归调用（retry）
      │
      ├─ spawnAndTryIpc(enriched)
      ├─ changesWriter.write("spawned pid=...")
      ├─ infoWriter.save(LaunchCpInfo)
      │
      ├─ logCpOut?
      │   ├─ stdout → outWriter
      │   └─ stderr → outWriter + errWriter
      │
      └─ childProcess.once('exit')
          ├─ changesWriter.write("exited code=...")
          ├─ retry 条件满足? → retryCount++ → waitFor(minInterval) → doSpawn()
          └─ retry 耗尽? → end all writers
```

## 4. 操作 API 流程（service/operation.ts）

### startProcess

```
startProcess(config)
  ├─ isManagedProcPidAlive(config.id) → true? throw Error
  └─ monitorConfig? → launchCpInMonitoredMode : launchCpInDetachedMode
```

### killProc

```
killProc(cpId, options?)
  ├─ readProcInfo(cpId) → null? return []
  ├─ 收集存活的 PID（monitor + spawn）
  ├─ killProcessByPid(pids)
  └─ options.cleanUp? → removeProcBaseDir(cpId)
```

### restartProcess

```
restartProcess(config, options?)
  ├─ killProc(config.id, options)
  └─ startProcess(config)
```

### removeProcBaseDir

```
removeProcBaseDir(cpId)
  ├─ isManagedProcPidAlive(cpId) → true? throw Error
  └─ fs.rmSync({cpId}/, recursive)
```

### listProcKeyInfo

```
listProcKeyInfo()
  ├─ 扫描 PROCESS_MANAGER_ROOT_DIR 下所有目录
  └─ 每个目录 → getProcKeyInfo(cpId)
      ├─ readProcInfo → PID、命令
      └─ getProcessInfoByPid → 状态（etime）、内存（rss）
```

## 5. 子进程脚本入口

```
子进程脚本
  │
  ├─ waitInfoFromParent()               // launch-cp/cp-util.ts
  │   └─ waitIpcMessageOnce<InfoToCp>()
  │       └─ 接收 {logOutPath, logErrPath, ...}
  │
  └─ 使用 logOutPath/logErrPath 或其他业务逻辑
```

## 6. 文件结构

```
lib/process-manager/
├── service/
│   ├── operation.ts       核心操作 API（startProcess、killProc、restartProcess 等）
│   ├── file.ts            路径工具（getProcBaseDir 等）、readProcInfo
│   ├── tail-file.ts       tailProcessOutLog、tailProcessErrLog
│   ├── types.ts           类型定义
│   ├── constants.ts       stdio 常量、文件名常量
│   ├── external.ts        跨模块依赖聚合
│   ├── launch-spawn-config.ts  SpawnConfig 解析
│   └── index.ts           公共导出
├── launch-cp/
│   ├── detached.ts        launchCpInDetachedMode：detached spawn + 持久化
│   ├── monitored.ts       launchCpInMonitoredMode：monitored spawn + 日志 + retry
│   ├── cluster.ts         launchCluster：批量启动多个进程
│   ├── cp-util.ts         子进程工具（waitInfoFromParent）
│   ├── detached.test.ts   detached 模式测试
│   └── monitored.test.ts  monitored 模式测试
├── index.ts               公共导出
├── README.md              功能概览
└── docs/
    ├── design.md          设计决策
    ├── flow.md            代码流程（本文件）
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
