# Changelog

## 2026-04-22 — Feature parity with node-http-proxy

Compared modules/lib/node/lib/http-proxy against vendor/node-http-proxy and identified missing features that affect reliability, correctness, and protocol coverage. Added them in three phases:

### Phase 1: Core Reliability

- **`timeout`** — Sets socket timeout on the incoming request. Without this, slow clients can hold connections open indefinitely.
- **`proxyTimeout`** — Sets timeout on the outgoing proxy request and destroys it if exceeded. Prevents hung connections to unresponsive targets from leaking.
- **Request abort handling** — Listens for `req.on('close')` and destroys the proxy request when the client disconnects. Previously, the proxy kept streaming to a dead connection.
- **Granular error responses** — Maps error codes to appropriate HTTP status: `ECONNREFUSED`/`ENOTFOUND`/`EHOSTUNREACH` → 502, `ETIMEDOUT` → 504. Silently discards `ECONNRESET` when the client socket is already destroyed. Previously everything returned 500.

### Phase 2: Standard Proxy Headers

- **`xfwd`** — Adds `x-forwarded-for`, `x-forwarded-port`, `x-forwarded-proto`, `x-forwarded-host` headers. Required for downstream services to identify the real client IP, port, and protocol.
- **`changeOrigin`** — Rewrites the `Host` header to match the target URL. Many servers (virtual hosts, CDNs) reject requests with a mismatched Host.
- **`cookieDomainRewrite` / `cookiePathRewrite`** — Rewrites `Set-Cookie` domain and path attributes using the existing `cookieRewrite` utility. Supports string (replace all) and object (map by original value, `*` as wildcard). Previously the code existed but was commented out.

### Phase 3: Protocol Features

- **WebSocket proxying (`ws`, `proxyWebSocketRequest`)** — Handles HTTP `upgrade` events, pipes bidirectional sockets after 101 Switching Protocols. Falls back to writing raw HTTP response if the target doesn't upgrade. Integrated into `startProxyServer` via the `ws` config flag.
- **`hostRewrite` / `protocolRewrite`** — Rewrites the `Location` header on 301/302/303/307/308 responses. `hostRewrite: true` uses the original request's Host; a string value sets it explicitly. Prevents redirect loops when the proxy's external address differs from the target's.
- **`prependPath`** — Controls whether the target's pathname is prepended to the request path (default true).
- **`followRedirects` / `maxRedirects`** — Follows redirect chains internally (method B, no external dependency). Handles 301/302/303 → GET conversion, strips `authorization` and `cookie` headers on cross-domain redirects, enforces max redirect count to prevent loops.
