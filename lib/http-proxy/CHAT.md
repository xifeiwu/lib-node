# Chat Q&A

## Why `req.socket.setTimeout(timeout)` instead of `req.setTimeout(timeout)`?

`req.socket.setTimeout(timeout)` sets the idle timeout on the incoming request's TCP socket. When the socket has no data transfer (read or write) for `timeout` ms, Node.js fires a `'timeout'` event. The HTTP server's default behavior is to call `socket.destroy()` on timeout.

**Use case**: Client sends request headers but stalls on sending the body (slowloris attack or network stall). Without this timeout, the connection holds resources indefinitely.

**Difference from `proxyTimeout`**:
- `req.socket.setTimeout(timeout)` — controls the **client → proxy** connection idle timeout
- `proxyReq.setTimeout(proxyTimeout)` — controls the **proxy → target** connection timeout

## Why set timeout on `req.socket` but on `proxyReq` (the request object)?

Because of where they are in the connection lifecycle:

- **`req` (IncomingMessage)** — the client has already connected, `req.socket` is guaranteed to exist, so we can operate on the socket directly.
- **`proxyReq` (ClientRequest)** — this is a freshly created outbound request. **The socket may not exist yet** (TCP connection to target hasn't been established — could be in DNS resolution, waiting for connection pool, etc.). If you access `proxyReq.socket` at this point, it may be `null`.

`ClientRequest.setTimeout()` handles this internally — it waits for the socket to be assigned before setting the timeout. Roughly equivalent to:

```js
if (this.socket) {
  this.socket.setTimeout(ms);
} else {
  this.on('socket', (socket) => {
    socket.setTimeout(ms);
  });
}
```

Additionally, `ClientRequest.setTimeout(ms, callback)` accepts a callback directly, which is more convenient than listening for the `'timeout'` event separately.
