# 代码流程

本文档描述 `lib/process-manager` 各核心操作的代码执行路径。

## 1. 独立函数：Detached 模式

```
launchCpInDetachedMode(config)              // launch-cp/detached.ts
  │
  ├─ 解析 spawnConfig
  │   └─ string → getSpawnConfigByScript()
  │
  ├─ 注入日志路径到 infoToCp
  │   └─ {logOutPath, logErrPath}
  │
  ├─ spwanInDetachedMode(enriched)          // child-process/spawn.ts
  │   ├─ prepareSpawnConfigForDetachedMode
  │   │   └─ stdio: ['ignore','ignore','ignore','ipc'], detached: true
  │   ├─ spawnAndTryIpc → spawn + IPC 握手
  │   └─ disconnect + unref
  │
  ├─ 构建 LaunchCpInfo
  │   └─ serializeSpawnResponse → spawnInfo
  │
  └─ RollingSnapshotWriter.save → {cpId}/info/index.json
```

## 2. 独立函数：Monitored 模式

```
launchCpInMonitoredMode(config, monitorConfig)  // launch-cp/monitored.ts
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

## 3. Daemon 模式（通过 LaunchCp 类）

### 启动 Daemon

```
CLI: src/daemon/command.ts  "daemon start"
  │
  ▼
src/daemon/service.ts  start(id)
  │
  ├─ id === daemonId → runDetachedDaemon()
  │   └─ startDetachedDaemon(config)           // socket/as-cp/start.ts
  │       ├─ getSpawnConfigByScript(script.ts)
  │       ├─ spawnAndTryIpc(config)             // spawn + IPC 传 SocketConfig
  │       └─ disconnect + unref（非 debug 模式）
  │
  └─ id !== daemonId → socketClient.start(cpConfig)
```

### Daemon 进程内部启动流程

```
socket/as-cp/script.ts
  │
  ├─ waitIpcMessageOnce<SocketConfig>()
  │
  ▼
DaemonSocketServer.start()                     // socket/server.ts
  │
  ├─ 1. startConnectionServer()
  │   └─ startOneChatSocketServer(handleData, serverConfig)
  │
  └─ 2. daemon.launchAllCpInConfigList()       // launch-cp/daemon.ts
      └─ entries.forEach → launchCp(entry)
          └─ getLaunchCpInst(cpConfig) → new LaunchCp(config)
              └─ inst.startInMonitoredMode(monitorConfig)
```

### 子进程 spawn 流程（LaunchCp.trySpawn）

```
trySpawn()                              // launch-cp/daemon.ts
  │
  ├─ 解析 spawnConfig
  │   └─ string → getSpawnConfigByScript()
  │
  ├─ prepareSpawnConfig()
  │   ├─ detached: validateAndApplyStdio(DETACHED_STDIO) + detached: true
  │   └─ monitored: validateAndApplyStdio(MONITORED_STDIO)
  │
  ├─ spawnAndTryIpc(prepared)
  │
  ├─ changePhase('running')             // 触发 persistInfo()
  │   └─ RollingSnapshotWriter.save → {cpId}/info/index.json
  │
  └─ afterSpawn()
      ├─ detached: disconnect + unref
      └─ monitored:
          ├─ setupLogPipe(stdout, stderr) → RollingLogWriter
          └─ childProcess.once('exit') → onExit()
```

### 子进程退出流程（LaunchCp.onExit）

```
onExit()                                // launch-cp/daemon.ts
  │
  ├─ changePhase('onExit')             // 触发 persistInfo()
  ├─ cleanupLogWriters()
  │
  └─ handleExitRetry():
      ├─ lastAction 'stop'/'restart' → letChildDie()
      │   └─ changePhase('exited') + resolve exitSignal
      ├─ lastAction 'start' + retryCount < maxCount → restartChild()
      │   └─ changePhase('toRestart') → waitFor(minInterval) → trySpawn()
      └─ else → letChildDie()
```

## 4. Socket 命令处理（DaemonSocketServer.handleCommand）

```
Socket 连接
  │
  ▼
handleData(chunk)
  ├─ fromBuffer(chunk, 'json') → Command
  └─ handleCommand(command) → DaemonResponse

handleCommand 路由:
  │
  ├─ action: 'ping'
  │   └─ return {type: 'pong', data: pid}
  │
  ├─ action: 'info'
  │   ├─ data === undefined → getDaemonInfo()
  │   └─ data === cpId → inst.getInfo()
  │
  ├─ action: 'start'
  │   └─ getLaunchCpInst(data) → inst.startInMonitoredMode()
  │
  ├─ action: 'restart'
  │   └─ getLaunchCpInst(data) → inst.restart()
  │       └─ stop() + startInMonitoredMode/startInDetachedMode
  │
  └─ action: 'stop'
      └─ daemon.stop(cpId) → inst.stop()
          └─ killProcessByPid + waitExitComplete
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
│   ├── types.ts            所有 TypeScript 类型定义
│   ├── file.ts             文件路径工具、信息加载函数
│   ├── constants.ts        stdio 常量、文件名常量
│   ├── external.ts         跨模块依赖聚合
│   └── index.ts            公共导出
├── launch-cp/
│   ├── detached.ts         launchCpInDetachedMode：独立函数，detached spawn + 持久化
│   ├── monitored.ts        launchCpInMonitoredMode：独立函数，monitored spawn + 日志 + retry
│   │                       validateAndApplyStdio：stdio 校验工具
│   ├── daemon.ts           LaunchCp 类（状态机 + 生命周期管理）+ Daemon 类（编排多个 LaunchCp）
│   ├── cp-util.ts          waitInfoFromParent：子进程工具函数
│   ├── detached.test.ts    detached 模式测试
│   └── monitored.test.ts   monitored 模式测试
├── socket/
│   ├── server.ts           DaemonSocketServer：Socket 服务 + handleCommand
│   ├── client.ts           SocketClientToDaemon：Socket 客户端
│   ├── service.ts          Socket 活跃性检查工具
│   └── as-cp/
│       ├── start.ts        startDetachedDaemon：启动 detached daemon
│       └── script.ts       Daemon 进程入口脚本
├── index.ts                公共导出
└── docs/
    ├── design.md           关键 feature 的设计决策
    ├── flow.md             逻辑流程概览（本文件）
    └── chat.md             与 Claude 的交流记录

运行时数据目录：
~/.process-management/
├── sockets/               Daemon 控制 socket
│   └── {daemonId}.socket
└── {cpId}/                 每个子进程独立目录
    ├── info/
    │   └── index.json      运行信息（LaunchCpInfo，JSON 格式）
    ├── log/
    │   ├── out.log         stdout + stderr 合并日志（RollingLogWriter）
    │   └── err.log         stderr 日志（RollingLogWriter）
    └── monitor/
        └── changes.log     子进程状态变化日志（RollingLogWriter，仅 monitored 模式）
```
