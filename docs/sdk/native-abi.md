# Native ABI

All wrappers call the same DLL exports defined in [`keytrialpro_sdk.h`](/T:/github/KeyTrialPro/native/win32-core-dll/include/keytrialpro_sdk.h).

## Design Rules

- `__stdcall` calling convention for easy E language import
- flat C ABI, no C++ classes across the boundary
- JSON string payloads for complex return values
- stable function list across Python, C#, and E language integrations
- `cert_pins` in `KtpInitOptions` must be a comma-separated list of lowercase SHA-256 leaf certificate pins in hex form

## Active Native Checks

- leaf certificate TLS pinning after WinHTTP receives the server certificate
- HTTPS-only transport enforcement
- debugger detection through `IsDebuggerPresent` and `CheckRemoteDebuggerPresent`
- VM trait detection from BIOS strings
- inline hook inspection on selected Win32 APIs
- DLL `.text` section integrity hash comparison
- suspicious module name scan inside the current process

## Next Production Steps

- replace SHA-256 challenge proof with asymmetric challenge signing
- expand pinning from leaf pin to pinset rotation policy and optional intermediate pinning
- add stronger anti-injection, sandbox, and code-virtualization layers
