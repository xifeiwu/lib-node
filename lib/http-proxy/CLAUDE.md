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
| `onRes2Proxy` | `(info, reqInfo, res) => void` | Called when response received from target |
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

- `handler.test.ts` — Tests streaming vs pre-buffered proxy approaches
- `server.test.ts` — Full proxy server tests (HTTPS targets, hooks, status endpoint)

Run individual test functions by importing and calling them directly — they are exported functions, not a test framework.
