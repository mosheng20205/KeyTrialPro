# Native ABI

All wrappers call the same DLL exports defined in [`keytrialpro_sdk.h`](/T:/github/KeyTrialPro/native/win32-core-dll/include/keytrialpro_sdk.h).

## Design Rules

- `__stdcall` calling convention for easy E language import
- flat C ABI, no C++ classes across the boundary
- JSON string payloads for complex return values
- stable function list across Python, C#, and E language integrations
- `cert_pins` in `KtpInitOptions` is a comma-separated list of lowercase SHA-256 hex digests. Each entry is matched against either the leaf certificate fingerprint or the SHA-256 of the leaf `subjectPublicKeyInfo` (SPKI DER); a request passes when any configured pin matches. Prefer SPKI pins for long-lived releases because they survive certificate renewal as long as the server keeps the same key pair.

## Current Export Surface

- `KtpInit`
- `KtpCollectFingerprintJson`
- `KtpRequestChallengeJson`
- `KtpActivateLicenseJson`
- `KtpVerifyLicenseJson`
- `KtpHeartbeatJson`
- `KtpReportOfflineJson`
- `KtpStartTrialJson`
- `KtpGetTrialStatusJson`
- `KtpRequestRebindJson`
- `KtpGetLastError`

## Active Native Checks

- leaf certificate TLS pinning after WinHTTP receives the server certificate (leaf fingerprint or SPKI digest)
- HTTPS-only transport enforcement
- debugger detection through `IsDebuggerPresent` and `CheckRemoteDebuggerPresent`
- VM trait detection from BIOS strings
- inline hook inspection on selected Win32 APIs
- DLL `.text` section integrity hash comparison
- suspicious module name scan inside the current process

## Next Production Steps

- replace SHA-256 challenge proof with asymmetric challenge signing
- add optional intermediate/CA pinning on top of the current leaf fingerprint and SPKI matching
- add stronger anti-injection, sandbox, and code-virtualization layers
