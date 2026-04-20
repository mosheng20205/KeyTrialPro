# SDK Integration

## Supported Targets

- E language 32-bit via native DLL imports
- Python 32-bit and 64-bit via `ctypes`
- C# 32-bit and 64-bit via `DllImport`

## Shared Contract

- `Init`
- `CollectFingerprint`
- `RequestChallenge`
- `ActivateLicense`
- `VerifyLicense`
- `Heartbeat`
- `StartTrial`
- `GetTrialStatus`
- `RequestRebind`

## Trial Expiration

The server always owns the actual expiration decision. The client SDK must:

- refresh its status at startup
- refresh before critical features
- send periodic heartbeats
- stop relying on local wall-clock time after the short offline grace expires

## Request Signing

The native SDK now signs client requests with the product-scoped `app_key` passed to `Init`. Each signed request includes:

- `appKey`
- `timestamp`
- `nonce`
- `signature`

The PHP API validates the signature before issuing or consuming a challenge.

## TLS Pinning

Pass `cert_pins` to `Init` as a comma-separated SHA-256 pin list for the expected leaf certificate, for example:

```text
3f2c...aa91,7b10...44de
```

The native DLL rejects:

- non-HTTPS endpoints
- HTTPS responses whose leaf certificate SHA-256 hash does not match one of the configured pins
