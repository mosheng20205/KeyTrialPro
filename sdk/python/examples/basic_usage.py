from pathlib import Path

from keytrialpro import KeyTrialClient


client = KeyTrialClient(
    dll_path=Path("../../native/win32-core-dll/build/keytrialpro_sdk.dll"),
    product_id="desktop-pro",
    server_url="https://licenses.example.com",
)

print(client.collect_fingerprint())
print(client.request_challenge())
print(client.start_trial())
print(client.get_trial_status())

