# Python SDK

Wrapper around the native DLL so Python 32-bit and 64-bit applications reuse the same machine fingerprint and challenge flow.

## Example

```python
from keytrialpro import KeyTrialClient

client = KeyTrialClient(
    "keytrialpro_sdk.dll",
    "desktop-pro",
    "https://licenses.example.com",
    app_key="desktop-pro-app-key",
    cert_pins="3f2c...aa91",
)
print(client.start_trial())
```

Call `report_offline()` during graceful shutdown if you want the admin console online-count to drop immediately instead of waiting for the heartbeat window to expire.
