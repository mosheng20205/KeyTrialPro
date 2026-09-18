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

Pass `cert_pins` to `Init` as a comma-separated SHA-256 pin list for the expected server certificate, for example:

```text
3f2c...aa91,7b10...44de
```

Each entry is compared against both of these digests of the leaf certificate, and matching any one of them is enough:

- the leaf certificate fingerprint (SHA-256 over the whole certificate DER)
- the leaf `subjectPublicKeyInfo` digest (SHA-256 over the SPKI DER)

Use the SPKI digest for shipped builds: it stays valid across certificate renewals as long as the server keeps the same key pair, while a leaf fingerprint breaks every client on renewal.

```bash
echo | openssl s_client -connect your-domain.com:443 -servername your-domain.com 2>/dev/null \
  | openssl x509 -noout -pubkey | openssl pkey -pubin -outform DER | openssl dgst -sha256 -hex
```

The native DLL rejects:

- non-HTTPS endpoints
- HTTPS responses whose leaf certificate matches none of the configured pins
