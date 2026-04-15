# 代码流程

本文档描述 `lib/process-management` 各核心操作的代码执行路径。

## 1. 启动 Daemon

```
CLI: src/daemon/command.ts  "daemon start"
  │
  ▼
src/daemon/service.ts  start(id)
  │
  ├─ id === daemonId → runDetachedDaemon()
  │   │
  │   └─ startDetachedDaemon(config)           // utils/server.ts
  │       ├─ getSpawnConfigByScript(daemon.ts)  // 指向入口脚本
  │       ├─ spawnAndTryIpc(config)             // spawn 子进程 + IPC 传 DaemonConfig
  │       └─ disconnect + unref                 // 非 debug 模式下脱离父进程
  │
  └─ id !== daemonId → socketClient.start(cpWrapperConfig)
```

### Daemon 进程内部启动流程

```
utils/cp-script/daemon.ts
  │
  ├─ waitIpcMessageOnce<DaemonConfig>()        // 接收 IPC 配置
  │
  ▼
Daemon.startAsCp(config)                       // cp-cluster.ts
  │
  ├─ 1. startConnectionServer()
  │   └─ startOneChatSocketServer(handleData, socketConfig)
  │
  └─ 2. startAllCp()
      └─ cpConfigList.forEach → startCp(cpConfig)
          └─ handleCommand({action: 'start', data: cpConfig})
              └─ getCpWrapper(cpConfig) → new CpWrapper(config)
                  └─ cpWrapper.start(config) → trySpawn()
```

## 2. 子进程 spawn 流程（CpWrapper.trySpawn）

```
trySpawn()
  │
  ├─ prepareStdioForLogging(spawnConfig)
  │   └─ stdio 中 'ignore' → 'pipe'
  │
  ├─ spawnAndTryIpc(config)
  │   └─ spawn 子进程 + 可选 IPC 握手
  │
  ├─ changeStatus('running')          // 触发 persistInfo()
  │   └─ RollingSnapshotWriter.save → ~/.process-management/{cpId}/info/index.js
  │
  ├─ setupLogFile(stdout, stderr)
  │   └─ createWriteStream → stdout.pipe / stderr.pipe
  │
  └─ childProcess.once('exit') → onExit()
```

## 3. 子进程退出流程（CpWrapper.onExit）

```
onExit()
  │
  ├─ changeStatus('onExit')           // 触发 persistInfo()
  ├─ cleanupLogResources()
  │   └─ WriteStream end
  │
  └─ 判断 lastAction:
      ├─ 'stop' / 'restart' → letChildDie()
      │   └─ changeStatus('exited') + resolve exitSignal
      ├─ 'start' + retryCount < maxCount → restartChild()
      │   └─ changeStatus('toRestart') → waitFor(minInterval) → trySpawn()
      └─ else → letChildDie()
```

## 4. Socket 命令处理（Daemon.handleCommand）

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
  │   └─ return {type: 'pong', data: daemonId}
  │
  ├─ action: 'info'
  │   ├─ data === daemonId / undefined → getDaemonInfo()
  │   └─ data === cpId → cpWrapper.getInfo()
  │
  ├─ action: 'log'
  │   ├─ 解析 data → cpId + logOptions
  │   └─ cpWrapper.getLog()
  │       └─ {id, outFile, errorFile}
  │
  ├─ action: 'start'
  │   └─ getCpWrapper(data) → cpWrapper.start()
  │
  ├─ action: 'restart'
  │   └─ getCpWrapper(data) → cpWrapper.restart()
  │       └─ stop() + start()
  │
  └─ action: 'stop'
      ├─ data === cpId → cpWrapper.stop()
      │   └─ killProcessByPid + waitExitComplete
      └─ data === daemonId → stopDaemon()
          └─ forEach cpWrapper.stop() + socket.server.close()
```

## 5. CLI 日志查看流程

```
CLI: "daemon log [id] [-n tail]"
  │
  ▼
log(id, options)
  └─ socketClient.log({id, tail})
      └─ oneChatFromSocketClient → DaemonResponse

根据 response.data:
  │
  └─ spawn('tail', ['-f', outFile, errorFile], {stdio: 'inherit'})
     // 实时跟踪，长驻运行
```

## 6. 文件结构

```
lib/process-management/
├── cp-cluster.ts          Daemon 类：Socket 服务、命令路由
├── cp-wrapper.ts          CpWrapper：状态机、spawn/kill、重试、日志、状态持久化
├── types.ts               所有 TypeScript 类型定义
├── service.ts             序列化工具、信息加载函数
├── external.ts            跨模块依赖聚合
├── index.ts               公共导出
├── utils/
│   ├── server.ts          startDetachedDaemon
│   ├── client.ts          SocketClientToDaemon
│   ├── utils.ts           Socket 活跃性检查工具
│   └── cp-script/
│       └── daemon.ts      Daemon 进程入口脚本
└── docs/
    ├── design.md           关键 feature 的设计决策
    ├── flow.md             逻辑流程概览（本文件）
    └── chat.md             与 Claude 的交流记录

运行时数据目录：
~/.process-management/
├── sockets/               Daemon 控制 socket
│   └── {daemonId}.socket
└── {cpWrapperId}/          每个 CpWrapper 独立目录
    ├── info/
    │   └── index.js        运行信息（CpWrapperInfo，CommonJS 格式）
    ├── {pid}.out           stdout 日志（file 模式）
    └── {pid}.error         stderr 日志（file 模式）
```
