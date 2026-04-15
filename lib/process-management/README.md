# Intro

在后台管理一组长期运行的子进程：启动、停止、重启、查看状态、获取日志。

## 功能

- **后台运行** — Daemon 以 detached 模式在后台独立运行，调用方退出后不影响子进程。
- **多进程管理** — 单个 Daemon 可管理多个子进程，每个子进程有独立 `id`。
- **启停控制** — 通过 Socket 命令 `start` / `stop` / `restart` 控制任意子进程。
- **状态查询** — `ping` 探活 Daemon，`info` 查询 Daemon 或指定子进程的状态、PID、运行历史。
- **日志持久化** — 子进程的 stdout/stderr 写入文件（`~/.process-management/{cpId}/{pid}.out/.error`）。
- **自动重试** — 子进程意外退出后，按配置的 `retry.maxCount` / `retry.minInterval` 自动重启。
- **状态持久化** — 每次状态变化时通过 `RollingSnapshotWriter` 将完整信息写入 `~/.process-management/{cpId}/info/index.js`。

## 使用方式

### 启动 Daemon

```typescript
import {startDetachedDaemon} from './lib/process-management';

const spawnInfo = await startDetachedDaemon({
  id: 'my-daemon',
  cpWrapperConfigList: [
    {
      id: 'my-service',
      retry: {maxCount: 3, minInterval: 5000},
      spawnConfig: {
        command: 'node',
        args: ['./my-service.js'],
        spawnOptions: {stdio: ['ignore', 'ignore', 'ignore', 'ipc']},
      },
    },
  ],
});
```

### 连接并控制

```typescript
import {SocketClientToDaemon} from './lib/process-management';

const client = new SocketClientToDaemon({path: 'my-daemon'});

await client.ping();                          // 探活
await client.info('my-daemon');               // Daemon 整体信息
await client.info('my-service');              // 单个子进程信息
await client.start({id: 'my-service', ...}); // 启动子进程
await client.restart('my-service');           // 重启子进程
await client.stop('my-service');              // 停止子进程
await client.stop('my-daemon');               // 停止整个 Daemon
await client.log('my-service');               // 获取全部日志
await client.log({id: 'my-service', tail: 50}); // 获取最近 50 行
```

## Socket 命令

| `action` | `data` | 返回 |
|----------|--------|------|
| `ping` | — | `{ type: 'pong', data: daemonId }` |
| `info` | daemon id 或 子进程 id | `{ type: 'info', data: DaemonInfo \| CpWrapperInfo }` |
| `start` | `CpWrapperConfig` 对象或子进程 id | `{ type: 'start', data: CpWrapperInfo }` |
| `restart` | 同 `start` | `{ type: 'restart', data: CpWrapperInfo }` |
| `stop` | daemon id 或子进程 id | `{ type: 'stop', data: DaemonInfo \| CpWrapperInfo }` |
| `log` | 子进程 id 或 `{ id, tail? }` | `{ type: 'log', data: { id, lines, total } }` |

## 配置说明

### DaemonConfig

```typescript
{
  id: string;                    // Daemon 标识，也作为默认 socket path
  connection?: {
    socketConfig?: TcpServerConfig; // 自定义 socket 配置，不设则用 id 作为 path
  };
  cpWrapperConfigList?: CpWrapperConfig[]; // 启动时自动拉起的子进程列表
}
```

### CpWrapperConfig

```typescript
{
  id: string;                    // 子进程标识
  retry?: {
    maxCount?: number;           // 最大重试次数
    minInterval?: number;        // 重试间隔（ms）
  };
  spawnConfig?: SpawnConfig;     // spawn 参数（command, args, spawnOptions, infoToCp 等）
}
```

## 日志

子进程的 stdout/stderr 分别写入 `~/.process-management/{cpId}/{pid}.out` 和 `~/.process-management/{cpId}/{pid}.error`。

- 子进程 stdio 中的 `'ignore'` 会被自动替换为 `'pipe'`，其他值不受影响。
- debug 模式下输出直接打印到终端，不经过日志收集。
- CLI 端使用 `tail -f` 实时跟踪日志文件。

## 文件结构

```
lib/process-management/
├── cp-cluster.ts      Daemon 类：Socket 服务、命令路由
├── cp-wrapper.ts      CpWrapper：状态机、spawn/kill、重试、日志、状态持久化
├── types.ts           所有 TypeScript 类型定义
├── service.ts         序列化工具、信息加载函数
├── external.ts        跨模块依赖聚合
├── index.ts           公共导出
├── utils/
│   ├── server.ts      startDetachedDaemon（拉起 Daemon 进程）
│   ├── client.ts      SocketClientToDaemon（Socket 客户端）
│   ├── utils.ts       Socket 活跃性检查工具
│   └── cp-script/
│       └── daemon.ts  Daemon 进程入口脚本
├── README.md          功能说明（本文件）
└── docs/
    ├── design.md       关键 feature 的设计决策
    ├── flow.md         逻辑流程概览
    └── chat.md         与 Claude 的交流记录
```
