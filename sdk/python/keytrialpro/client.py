from __future__ import annotations

import json
from ctypes import POINTER, Structure, byref, c_char_p, c_int, cdll, create_string_buffer
from pathlib import Path
from typing import Any


class _KtpInitOptions(Structure):
    _fields_ = [
        ("product_id", c_char_p),
        ("server_url", c_char_p),
        ("app_key", c_char_p),
        ("cert_pins", c_char_p),
    ]


class KeyTrialClient:
    def __init__(self, dll_path: str | Path, product_id: str, server_url: str, app_key: str, cert_pins: str) -> None:
        self._lib = cdll.LoadLibrary(str(dll_path))
        self._configure_signatures()
        options = _KtpInitOptions(
            product_id=product_id.encode("utf-8"),
            server_url=server_url.encode("utf-8"),
            app_key=app_key.encode("utf-8"),
            cert_pins=cert_pins.encode("utf-8"),
        )
        status = self._lib.KtpInit(byref(options))
        if status != 0:
            raise RuntimeError(self.last_error())

    def collect_fingerprint(self) -> dict[str, Any]:
        return self._call_json(self._lib.KtpCollectFingerprintJson)

    def request_challenge(self) -> dict[str, Any]:
        return self._call_json(self._lib.KtpRequestChallengeJson)

    def activate(self, card_key: str) -> dict[str, Any]:
        return self._call_json(self._lib.KtpActivateLicenseJson, card_key.encode("utf-8"))

    def verify(self) -> dict[str, Any]:
        return self._call_json(self._lib.KtpVerifyLicenseJson)

    def heartbeat(self) -> dict[str, Any]:
        return self._call_json(self._lib.KtpHeartbeatJson)

    def start_trial(self) -> dict[str, Any]:
        return self._call_json(self._lib.KtpStartTrialJson)

    def get_trial_status(self) -> dict[str, Any]:
        return self._call_json(self._lib.KtpGetTrialStatusJson)

    def request_rebind(self, reason: str) -> dict[str, Any]:
        return self._call_json(self._lib.KtpRequestRebindJson, reason.encode("utf-8"))

    def last_error(self) -> str:
        buffer = create_string_buffer(512)
        self._lib.KtpGetLastError(buffer, len(buffer))
        return buffer.value.decode("utf-8")

    def _configure_signatures(self) -> None:
        self._lib.KtpInit.argtypes = [POINTER(_KtpInitOptions)]
        self._lib.KtpInit.restype = c_int
        self._lib.KtpCollectFingerprintJson.argtypes = [c_char_p, c_int]
        self._lib.KtpRequestChallengeJson.argtypes = [c_char_p, c_int]
        self._lib.KtpActivateLicenseJson.argtypes = [c_char_p, c_char_p, c_int]
        self._lib.KtpVerifyLicenseJson.argtypes = [c_char_p, c_int]
        self._lib.KtpHeartbeatJson.argtypes = [c_char_p, c_int]
        self._lib.KtpStartTrialJson.argtypes = [c_char_p, c_int]
        self._lib.KtpGetTrialStatusJson.argtypes = [c_char_p, c_int]
        self._lib.KtpRequestRebindJson.argtypes = [c_char_p, c_char_p, c_int]
        self._lib.KtpGetLastError.argtypes = [c_char_p, c_int]

    def _call_json(self, fn: Any, *args: Any) -> dict[str, Any]:
        buffer = create_string_buffer(2048)
        status = fn(*args, buffer, len(buffer))
        if status != 0:
            raise RuntimeError(self.last_error() or f"Native call failed with status {status}")
        return json.loads(buffer.value.decode("utf-8"))
