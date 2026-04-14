# 代码流程

本文档描述 `lib/daemon` 各核心操作的代码执行路径。

## 1. 启动 Daemon

```
CLI: src/daemon/command.ts  "daemon start"
  │
  ▼
src/daemon/service.ts  start(id)
  │
  ├─ id === daemonId → runDetachedDaemon()
  │   │
  │   ├─ detectAndHandleOrphans()
  │   │   ├─ scanAllPidInfoRecords()           // service.ts: 扫描 ~/.process-management/{cpId}/info.json
  │   │   ├─ process.kill(pid, 0)              // 检查存活
  │   │   └─ selectOption(Adopt / Kill)        // 用户交互
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
Daemon.startAsCp(config)                       // daemon.ts
  │
  ├─ 1. 收养孤儿进程
  │   └─ config.orphans?.forEach → CpWrapper.createOrphan(cpId, pid)
  │      └─ 加入 cpWrapperMap
  │
  ├─ 2. startConnectionServer()
  │   └─ startOneChatSocketServer(handleData, socketConfig)
  │
  └─ 3. startAllCp()
      └─ cpConfigList.forEach → startCp(cpConfig)
          └─ handleCommand({action: 'start', data: cpConfig})
              └─ getCpWrapper(cpConfig) → new CpWrapper(config)
                  └─ cpWrapper.start(config) → trySpawn()
```

## 2. 子进程 spawn 流程（CpWrapper.trySpawn）

```
trySpawn()
  │
  ├─ isOrphan? → return null
  │
  ├─ prepareStdioForLogging(spawnConfig)
  │   └─ stdio 中 'ignore' → 'pipe'
  │
  ├─ spawnAndTryIpc(config)
  │   └─ spawn 子进程 + 可选 IPC 握手
  │
  ├─ changeStatus('running')
  │
  ├─ 按 logMode 分支：
  │   ├─ 'memory' → setupLogCapture(stdout, stderr)
  │   │   └─ stream.on('data') → 行缓冲 → pushLog → logBuffer
  │   ├─ 'socket' → setupLogSocket(stdout, stderr)
  │   │   └─ net.createServer → broadcast to clients
  │   └─ 'file'   → setupLogFile(stdout, stderr)
  │       └─ createWriteStream → stdout.pipe / stderr.pipe
  │
  ├─ persistPidInfo()
  │   └─ savePidInfo(cpId, record)  →  ~/.process-management/{cpId}/info.json
  │
  └─ childProcess.once('exit') → onExit()
```

## 3. 子进程退出流程（CpWrapper.onExit）

```
onExit()
  │
  ├─ changeStatus('onExit')
  ├─ cleanupLogResources()
  │   ├─ socket server close + clients destroy
  │   ├─ WriteStream end
  │   └─ socket file unlink
  ├─ updatePidInfoOnExit()
  │   └─ savePidInfo(status: 'exited', exitAt: ...)
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
  │   └─ cpWrapper.getLog(logOptions)
  │       ├─ orphan → {mode:'memory', lines:['no log'], total:1}
  │       ├─ memory → {mode:'memory', lines, total}
  │       ├─ socket → {mode:'socket', socketPath}
  │       └─ file   → {mode:'file', outFile, errorFile}
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
      │   ├─ orphan: killProcessByPid + updatePidInfoOnExit
      │   └─ normal: killProcessByPid + waitExitComplete
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

根据 response.data.mode:
  │
  ├─ 'memory'
  │   └─ 逐行 console.log(line)
  │      "--- N of M lines ---"
  │
  ├─ 'socket'
  │   └─ startSocketClient({path: socketPath})
  │      socket.pipe(process.stdout)      // 实时流，长驻运行
  │
  └─ 'file'
      └─ spawn('tail', ['-f', outFile, errorFile], {stdio: 'inherit'})
         // 实时跟踪，长驻运行
```

## 6. 文件结构

```
lib/daemon/
├── daemon.ts              Daemon 类：Socket 服务、命令路由、orphan 收养
├── cp-wrapper.ts          CpWrapper：状态机、spawn/kill、重试、三种日志模式、PID 持久化
├── types.ts               所有 TypeScript 类型定义
├── service.ts             序列化工具、per-CpWrapper 持久化函数
├── external.ts            跨模块依赖聚合
├── index.ts               公共导出
├── utils/
│   ├── server.ts          startDetachedDaemon
│   ├── client.ts          SocketClientToDaemon
│   ├── utils.ts           Socket 活跃性检查工具
│   └── cp-script/
│       └── daemon.ts      Daemon 进程入口脚本
└── docs/
    ├── 设计思想.md          关键 feature 的设计决策
    ├── 代码流程.md          逻辑流程概览（本文件）
    └── chat.md             与 Claude 的交流记录

运行时数据目录：
~/.process-management/
├── sockets/               Daemon 控制 socket
│   └── {daemonId}.socket
└── {cpWrapperId}/          每个 CpWrapper 独立目录
    ├── info.json       运行信息（PID、状态、日志模式）
    ├── {pid}.sock          日志 socket（socket 模式）
    ├── {pid}.out           stdout 日志（file 模式）
    └── {pid}.error         stderr 日志（file 模式）
```
