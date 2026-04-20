# Security Model

## Core Controls

- TLS 1.3 for every client and admin request
- HMAC request signing with product-scoped `client_app_key` and a 5-minute timestamp window
- nonce replay protection with server-side nonce persistence
- Server-authoritative trial expiration
- AES-256-GCM for machine snapshot and sensitive payload storage
- Device presence tracking with a short online window
- Machine-code generation from normalized hardware signals and per-product salt

## Native Protection Strategy

- Stable C ABI for all wrappers, with core logic isolated in the native DLL
- Anti-debug, anti-VM, hook detection, and integrity checks executed in the native layer
- TLS leaf certificate pinning enforced in the native WinHTTP client
- VMProtect and white-box encryption reserved as production hardening layers

## Risk Flow

1. Client captures fingerprint and environment state.
2. Server issues a challenge.
3. Client signs the challenge and submits machine context.
4. Server verifies challenge, fingerprint, policy, and risk rules.
5. On violation, server downgrades the session or opens an approval ticket.
