# C# SDK

`KeyTrialPro.Sdk` wraps the native Windows DLL for both x86 and x64 .NET applications.

## Constructor

```csharp
var client = new KeyTrialClient(
    "desktop-pro",
    "https://licenses.example.com",
    "desktop-pro-app-key",
    "3f2c...aa91");
```

## Surface

- `CollectFingerprint`
- `RequestChallenge`
- `Activate`
- `Verify`
- `Heartbeat`
- `StartTrial`
- `GetTrialStatus`
- `RequestRebind`
