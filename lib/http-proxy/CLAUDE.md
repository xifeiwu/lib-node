# http-proxy

A customizable HTTP/WebSocket reverse proxy built on Node.js core `http`/`https` modules. Inspired by [node-http-proxy](https://github.com/http-party/node-http-proxy) but lighter, TypeScript-native, and with built-in observability.

## Architecture

```
+--------+        originRequest        +-------+        proxyRequest        +--------+
| Origin | --------------------------> | Proxy | -------------------------> | Target |
|        | <--- proxyResInfo --------- |       | <--- targetResInfo ------- |        |
+--------+                             +-------+                           +--------+
```

### Files

- **types.ts** — `HttpProxyConfig` (all config options) and `ProxyStatus` (request tracking)
- **handlers/** — Core proxy logic, split into:
  - **common.ts** — Shared functions: `handleProxyRequestOptions()`, `processProxyResponse()`, `issueRequestWithRedirects()`, `writeHttpResponseInfoToSocket()`, `postResToProxy()`
  - **request.ts** — `proxyHttpRequest()` for HTTP proxying
  - **websocket.ts** — `proxyWebSocketRequest()` for WebSocket proxying
  - **index.ts** — Re-exports `postResToProxy`, `proxyHttpRequest`, `proxyWebSocketRequest`
- **server.ts** — `startProxyServer()` wires handlers into an HTTP server, adds `/api/proxy-status` endpoint
- **utils.ts** — Proxy status management (ID generation, history, logging)
- **external.ts** — Re-exports from parent modules (`../../http`, `../../log`)
- **index.ts** — Public API exports

## Config options (HttpProxyConfig)

### Request options (by priority, highest first)

| Priority | Option | Type | Description |
|----------|--------|------|-------------|
| highest | `xfwd` | `boolean` | Add x-forwarded-for/port/proto/host headers |
| highest | `changeOrigin` | `boolean` | Rewrite Host header to match target |
| highest | `urlRewrite` | `(url: URL) => Promise<URL> \| URL` | Rewrite the resolved URL before sending |
| middle | `handleProxyRequestOptions` | `(info) => info \| void` | Async hook to modify proxy request before sending |
| lowest | `globalRequestOptions` | `Partial<HttpRequestOptions>` | Merged into every proxy request (set `origin` here for the target) |

### Response options (by priority, highest first)

| Priority | Option | Type | Description |
|----------|--------|------|-------------|
| highest | `cookieDomainRewrite` | `string \| Record` | Rewrite Set-Cookie domain attribute |
| highest | `cookiePathRewrite` | `string \| Record` | Rewrite Set-Cookie path attribute |
| highest | `hostRewrite` | `boolean \| string` | Rewrite Location header on redirects |
| highest | `protocolRewrite` | `string` | Force protocol in rewritten Location headers |
| lower | `handleResponseInfoToOrigin` | `(info) => info \| void` | Async hook to modify response before sending to client |

### Other options

| Option | Type | Description |
|--------|------|-------------|
| `originData` | buffer/string | Pre-buffered request body when req stream is already consumed |
| `preProxyReq` | `(status, {href}) => void` | Callback before proxy request starts (logging, status collection) |
| `postResToProxy` | `(response, headerPart, proxyReqInfo) => void` | After response from target is available at the proxy |
| `timeout` | `number` | Incoming request socket idle timeout (ms) |
| `proxyTimeout` | `number` | Outgoing proxy request timeout (ms), destroys on exceed |
| `followRedirects` | `boolean` | Follow redirect chains internally instead of passing through |
| `maxRedirects` | `number` | Max redirects to follow (default: 5) |

### startProxyServer options

`ws` is passed via the second parameter `httpServerConfig`:

```ts
startProxyServer(proxyConfig, {ws: true})  // ws defaults to true
```

## Key internal functions (handlers/common.ts)

### handleProxyRequestOptions(req, config, options)

Prepares the proxy request. Returns `PreparedProxyRequest` with `{proxyStatus, proxyReqInfo, urlInst, requestOptions, data}`.

Execution order (reflects priority):
1. `globalRequestOptions` merge (lowest)
2. `config.handleProxyRequestOptions` hook (middle)
3. URL resolution (`getUrlPropsFromConfig` → `toUrlInstance`)
4. `urlRewrite` (highest)
5. `xfwd` headers (highest)
6. `changeOrigin` (highest)

### processProxyResponse(res2Proxy, config, options)

Processes the target's response. Returns `ProcessedResponse` with `{targetResInfo, proxyResInfo}`.

Execution order (reflects priority):
1. `handleResponseInfoToOrigin` hook (lower)
2. `applyResponseHeaderRewrite` — cookie/host/protocol rewrites (higher)

## Dependencies

All imports are from sibling modules in the parent `lib/node/` tree:

- `../../external` — `toUrlInstance`, `deepClone`, `getUrlPropsFromConfig`, `cookieRewrite`
- `../../stream` — `toReadable`, `getDataByTransform`
- `../../transform` — `toBuffer`
- `../../http` — `mergeHttpRequestOptions`
- `../../log` — `logColorful`
- `../../types` — `HttpRequestOptions`, `HttpResponseInfo`

## Testing

All tests use local target servers (no external dependencies) and clean up via `server.close()` in `finally` blocks. Tests are exported functions — run individually or via `runAllRequestTests()` / `runAllWebSocketTests()` / `runAllServerTests()`.

```bash
cd /Users/wuxifei/code/conviva/Gen6/build/modules/lib/node
npx ts-node --transpile-only -e "import {runAllRequestTests} from './lib/http-proxy/handlers/request.test'; import {runAllWebSocketTests} from './lib/http-proxy/handlers/websocket.test'; (async () => { await runAllRequestTests(); await runAllWebSocketTests(); })();"
```

### handlers/request.test.ts

| Test | Coverage |
|------|----------|
| `twoWayOfProxyPayload` | Streaming vs pre-buffered (`originData`) proxy |
| `testBasicProxy` | GET forwarding, status code, response body |
| `testPostWithBody` | POST with JSON body forwarding |
| `testXForwardedHeaders` | `xfwd` — x-forwarded-for/port/proto/host |
| `testChangeOrigin` | `changeOrigin` — Host header rewrite |
| `testHandleProxyRequestOptions` | Async request hook injects custom header |
| `testHandleResponseInfoToOrigin` | Async response hook adds header |
| `testTargetErrorStatus` | Target 503 forwarded to client |
| `testTargetUnreachable` | ECONNREFUSED → 502 |
| `testProxyTimeout` | `proxyTimeout` → error on slow target |
| `testCookieDomainRewrite` | Set-Cookie domain rewriting |
| `testHostRewrite` | Location header host rewrite on 302 |
| `testProtocolRewrite` | Location header protocol rewrite on 301 |
| `testTargetPathname` | Target pathname prepended to request path |
| `testFollowRedirects` | Follows 302 chain to final response |
| `testFollowRedirectsMaxExceeded` | Redirect loop → 502 |
| `testFollowRedirects303ToGet` | 303 converts POST to GET |
| `testPostResToProxyCallback` | `postResToProxy` callback invocation |

### handlers/websocket.test.ts

| Test | Coverage |
|------|----------|
| `testWebSocketProxy` | Bidirectional WebSocket upgrade + echo |
| `testWebSocketProxyHooks` | Request/response hooks with WebSocket |

### server.test.ts

| Test | Coverage |
|------|----------|
| `proxyToBaidu` | Manual test proxying to external HTTPS target |
| `test443Port` | Manual test on port 443 |
| `testProxyServerWithStatus` | Proxy + `/api/proxy-status` history tracking |
| `testProxyStatusFilterById` | `?id=` query parameter filter |
| `testProxyServerHooks` | Both request/response hooks via `startProxyServer` |
| `testProxyServerWebSocket` | WebSocket via `startProxyServer` with `ws: true` |
| `testProxyServerErrorInStatus` | ECONNREFUSED error recorded in proxy status |
