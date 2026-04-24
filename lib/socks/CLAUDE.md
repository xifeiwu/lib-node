# SOCKS Proxy Library

A TypeScript SOCKS proxy library supporting **SOCKS5** (RFC 1928/1929) and a custom **VC1** protocol (encrypted, single-step handshake with XOR encryption). Designed as a Layer 3 library within the `node` module, potentially extractable as a standalone project.

## Architecture

Version-agnostic core with protocol-specific logic plugged in via strategy pattern:

| File/Dir | Role |
|----------|------|
| `server.ts` | Server-side lifecycle: negotiate -> handle command -> pipe sockets |
| `client.ts` | Client-side: connect to SOCKS server -> negotiate -> return usable socket |
| `proxy.ts` | Proxy chaining: match target against config, forward to remote SOCKS or connect directly |
| `v5/` | Standard SOCKS5 implementation (multi-step handshake: method -> auth -> target) |
| `vc1/` | Custom protocol: single encrypted message combining auth + target, XOR-encrypted transport via `EncryptedSocket` |
| `types/` | Type definitions separated from logic (base, v5, vc1, client, server) |
| `service/` | Utilities (`utils.ts`), config (`config.ts`), external re-exports (`external.ts`), common helpers (`common.ts`) |
| `test/` | Test scripts for v5, vc1, proxy chaining, and end-to-end scenarios |

## Key Design Patterns

- **Strategy pattern**: `NegotiationWithClient<V>` and `NegotiationWithServer<V>` interfaces allow version dispatch via `negotiation[socksVersion](...)` maps
- **Socket wrapping**: `getWrapSocketFunc(version)` returns identity for v5, `EncryptedSocket` (XOR Duplex wrapper) for vc1
- **State tracing**: `stateTracer` arrays log each step through the connection lifecycle for debugging
- **External re-exports**: all third-party and cross-module imports go through `service/external.ts`

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

## Supported Commands

- **CONNECT**: proxy TCP connection to target (primary use case)
- **ECHO**: debug mode that echoes data back to client

## SOCKS5 vs VC1

| | SOCKS5 | VC1 |
|--|--------|-----|
| Handshake | Multi-step (method -> auth -> target) | Single encrypted message (auth + target combined) |
| Encryption | None on wire | XOR with random IV; `EncryptedSocket` wraps socket transparently |
| Auth | Selectable (none / username-password) | Always username-password |

## Socket Lifecycle & Leak Prevention

The `pipeSocket` function in `server.ts` manages bidirectional piping between client and remote sockets. Key safeguards:

- **`socketTimeout`**: `socket.setTimeout()` on both sockets; idle connections are destroyed after the configured limit (default 3 min)
- **Pipeline error cleanup**: `pipeline` error callbacks call `closeBoth()` to ensure both sockets are destroyed on any pipe failure
- **`socketHalfOpenTimeout`**: after receiving `end` from either side, force `destroy` if the peer doesn't close within the timeout (default 30s) — prevents connections stuck in `FIN_WAIT`
- **EncryptedSocket (vc1) close propagation**: inner socket `close` event destroys the `EncryptedSocket`, and vice versa — ensures no orphaned wrapper or inner socket

## Import Conventions

- External dependencies must be re-exported through `service/external.ts`
- Types are separated from logic in `types/` directory
- Follow the parent `node` module's layering: Layer 1 utilities only via module-level `external.ts`
