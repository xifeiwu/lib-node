# http-proxy

A customizable HTTP/WebSocket reverse proxy built on Node.js core `http`/`https` modules. Inspired by [node-http-proxy](https://github.com/http-party/node-http-proxy) but lighter, TypeScript-native, and with built-in observability.

## Architecture

```
+--------+        originRequest        +-------+        proxyRequest        +--------+
| Origin | --------------------------> | Proxy | -------------------------> | Target |
|        | <--- response2Origin ------ |       | <--- response2Proxy ----- |        |
+--------+                             +-------+                           +--------+
```

### Files

- **types.ts** — `HttpProxyConfig` (all config options) and `ProxyStatus` (request tracking)
- **handler.ts** — Core proxy logic: `proxyHttpRequest()` for HTTP, `proxyWebSocketRequest()` for WebSocket
- **server.ts** — `startProxyServer()` wires handler into an HTTP server, adds `/api/proxy-status` endpoint
- **utils.ts** — Proxy status management (ID generation, history, logging)
- **external.ts** — Re-exports from parent modules (`../../http`, `../../log`)
- **index.ts** — Public API exports

## Config options (HttpProxyConfig)

| Option | Type | Description |
|--------|------|-------------|
| `globalRequestOptions` | `Partial<HttpRequestOptions>` | Merged into every proxy request (set `origin` here for the target) |
| `originData` | buffer/string | Pre-buffered request body when req stream is already consumed |
| `handleProxyRequestOptions` | `(info) => info \| void` | Async hook to modify proxy request before sending |
| `preProxyReq` | `(status, {href}) => void` | Callback before proxy request starts (logging, status collection) |
| `postResToProxy` | `(response, headerPart, proxyReqInfo) => void` | After response from target is available at the proxy |
| `handleResponseInfoToOrigin` | `(info) => info \| void` | Async hook to modify response before sending to client |
| `timeout` | `number` | Incoming request socket idle timeout (ms) |
| `proxyTimeout` | `number` | Outgoing proxy request timeout (ms), destroys on exceed |
| `xfwd` | `boolean` | Add x-forwarded-for/port/proto/host headers |
| `changeOrigin` | `boolean` | Rewrite Host header to match target |
| `cookieDomainRewrite` | `string \| Record` | Rewrite Set-Cookie domain attribute |
| `cookiePathRewrite` | `string \| Record` | Rewrite Set-Cookie path attribute |
| `ws` | `boolean` | Enable WebSocket proxying via upgrade event |
| `hostRewrite` | `boolean \| string` | Rewrite Location header on redirects |
| `protocolRewrite` | `string` | Force protocol in rewritten Location headers |
| `prependPath` | `boolean` | Prepend target pathname to request path (default: true) |
| `followRedirects` | `boolean` | Follow redirect chains internally instead of passing through |
| `maxRedirects` | `number` | Max redirects to follow (default: 5) |

## Dependencies

All imports are from sibling modules in the parent `lib/node/` tree:

- `../../external` — `toUrlInstance`, `deepClone`, `getUrlPropsFromConfig`, `cookieRewrite`, `concatPath`
- `../../stream` — `toReadable`, `getDataByTransform`
- `../../transform` — `toBuffer`
- `../../http` — `mergeHttpRequestOptions`
- `../../log` — `logColorful`
- `../../types` — `HttpRequestOptions`, `HttpResponseInfo`

## Testing

All tests use local target servers (no external dependencies) and clean up via `server.close()` in `finally` blocks. Tests are exported functions — run individually or via `runAllHandlerTests()` / `runAllServerTests()`.

### handler.test.ts

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
| `testPrependPath` | Target pathname prepended to request path |
| `testFollowRedirects` | Follows 302 chain to final response |
| `testFollowRedirectsMaxExceeded` | Redirect loop → 502 |
| `testFollowRedirects303ToGet` | 303 converts POST to GET |
| `testWebSocketProxy` | Bidirectional WebSocket upgrade + echo |
| `testPostResToProxyCallback` | `postResToProxy` callback invocation |

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
