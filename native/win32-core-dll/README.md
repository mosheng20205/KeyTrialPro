# Native DLL

This directory contains the stable C ABI for the Windows native SDK core. The implementation now includes:

- exported function surface for E language, Python, and C# wrappers
- WinHTTP transport to the PHP API
- request signing and challenge flow support
- TLS leaf certificate pinning
- baseline anti-debug, anti-VM, anti-hook, suspicious module, and code integrity checks

Production work can still deepen the protection stack with:

- asymmetric challenge signing
- stronger anti-injection and anti-sandbox heuristics
- code virtualization and white-box secret protection
