# SOCKS Library — Architecture & Flow

## Architecture Overview

A modular SOCKS proxy library supporting **SOCKS5** (RFC 1928) and a custom **VC1** protocol (encrypted single-step variant). The core is version-agnostic — protocol-specific logic is plugged in via v5/ and vc1/ directories.

## File Structure

| File | Role |
|------|------|
| `server.ts` | Server-side connection lifecycle: negotiate → handle command → pipe |
| `client.ts` | Client-side: connect to SOCKS server → negotiate → return socket |
| `proxy.ts` | Proxy forwarding: match target against config, chain to remote proxy or connect locally |
| `types/` | Type definitions for base, v5, vc1, client, server |
| `v5/` | SOCKS5 implementation (multi-step handshake) |
| `vc1/` | Custom encrypted protocol (single-step handshake with XOR encryption) |
| `service/` | Utilities, config, protocol detection, socket wrapping |

## Connection Flow

```
CLIENT                    SOCKS SERVER                 TARGET
  |--- TCP Connect -------->|                            |
  |--- Negotiation -------->|  (v5: multi-step,         |
  |<-- Auth/Method Reply ---|   vc1: single encrypted)  |
  |--- Send Target -------->|                            |
  |                    [handleConnectCommand]             |
  |                         |--- proxy or direct ------->|
  |<-- Target Response -----|                            |
  |<====== Bidirectional Data Pipe =====================>|
```

## Key Modules

### `server.ts` — `handleSocksConnection()`

Three phases:

1. **Negotiation** — delegates to version-specific handler (v5 or vc1)
2. **Command handling** — supports `CONNECT` (proxy to target) and `ECHO` (debug)
3. **Piping** — bidirectional socket pipe with 6-hour timeout, error tracking via `stateTracer`

### `proxy.ts` — `handleConnectCommand()`

- Matches target against `proxyConfigList` patterns (string, RegExp, or `{address, port}`)
- If matched → chains through a remote SOCKS server via `connectToSocksServer()`
- Otherwise → connects directly via `connectFromLocal()`

## SOCKS5 vs VC1

| | SOCKS5 | VC1 |
|--|--------|-----|
| Handshake | Multi-step (method → auth → target) | Single encrypted message (auth + target combined) |
| Encryption | None on wire | XOR with random IV; `EncryptedSocket` wraps the socket transparently |
| Auth | Selectable (none / username-password) | Always username-password |

VC1's `EncryptedSocket` extends `Duplex` — after negotiation, the socket is wrapped so all subsequent data is transparently XOR-encrypted/decrypted.

## Design Patterns

- **Strategy pattern** — version-specific negotiation functions implement common interfaces (`NegotiationWithClient<V>`, `NegotiationWithServer<V>`)
- **Socket wrapping** — `getWrapSocketFunc(version)` returns identity for v5, `EncryptedSocket` for vc1
- **State tracing** — `stateTracer` arrays log each step for debugging
- **Proxy chaining** — configuration-driven, supports nested SOCKS proxying
