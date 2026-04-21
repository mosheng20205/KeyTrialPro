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
- `ReportOffline`
- `StartTrial`
- `GetTrialStatus`
- `RequestRebind`

## Trial Expiration

The server always owns the actual expiration decision. The client SDK must:

- refresh its status at startup
- refresh before critical features
- send periodic heartbeats
- report offline during graceful shutdown when possible
- stop relying on local wall-clock time after the short offline grace expires

## Authorization Status

Client applications should not treat `success == true` as equivalent to "licensed".

Recommended authorization semantics:

- `active`: valid paid license is bound to the machine
- `trial_active`: trial is available and not expired
- `trial_expired`: trial record exists but is no longer usable
- `not_licensed`: neither a valid paid license nor a usable trial exists

Recommended client-side allow-list:

- allow when `data.status` is `active` or `trial_active`
- block when `data.status` is `trial_expired` or `not_licensed`

If the server also returns `data.authorized`, treat it as a convenience field, not a replacement for understanding the status values.

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
