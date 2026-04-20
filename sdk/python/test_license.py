"""纯 Python SDK - 不依赖 C++ DLL，直接测试卡密激活流程"""

import hashlib
import hmac
import json
import uuid
import time
import requests

SERVER_URL = "https://key.462030.xyz"
PRODUCT_CODE = "testp3"
# IMPORTANT: The server's API_HMAC_KEY must match this value.
# If signature verification fails, check that the server's .env has:
#   API_HMAC_KEY=05eabfa0d3d5dfcb5a11829da9cebde2
APP_KEY = "05eabfa0d3d5dfcb5a11829da9cebde2"
CARD_KEY = "5436-SKDB-E6NP-EWRR"


def collect_fingerprint() -> dict:
    """收集机器指纹（字段名与 PHP FingerprintService 保持一致）"""
    machine_id = hashlib.sha1(str(uuid.getnode()).encode()).hexdigest()[:16]
    cpu_serial = hashlib.md5(b"CPU-Intel-i7-12700").hexdigest()[:16]
    disk_sn = hashlib.md5(b"SSD-Samsung-1TB").hexdigest()[:16]
    mac_raw = machine_id[:6].encode()
    primary_mac = ':'.join(f'{b:02x}' for b in mac_raw)
    bios_ver = hashlib.md5(b"BIOS-UEFI").hexdigest()[:16]

    fingerprint = {
        "machineId": machine_id,
        "cpuSerial": cpu_serial,
        "systemDiskId": disk_sn,
        "primaryMac": primary_mac,
        "biosVersion": bios_ver,
        "osHostname": "TEST-PC",
        "gpuUuid": hashlib.md5(b"GPU-Nvidia-RTX3080").hexdigest()[:16],
        "baseboardSerial": hashlib.md5(b"MB-Asus-Z690").hexdigest()[:16],
    }

    # 计算 summary（与 PHP FingerprintService::summarize 保持一致）
    stable_fields = [
        fingerprint.get('cpuSerial', ''),
        fingerprint.get('systemDiskId', ''),
        fingerprint.get('baseboardSerial', ''),
        fingerprint.get('biosVersion', ''),
        fingerprint.get('gpuUuid', ''),
        fingerprint.get('primaryMac', ''),
    ]
    normalized = '|'.join(f.lower().strip() for f in stable_fields)

    # PHP: hash('sha3-256', normalized)
    machine_hash = hashlib.sha3_256(normalized.encode()).hexdigest()
    # PHP: hash('sha256', normalized) 作为 signatureSubject
    signature_subject = hashlib.sha256(normalized.encode()).hexdigest()

    return {
        "fingerprint": fingerprint,
        "machineHash": machine_hash,
        "signatureSubject": signature_subject,
    }


def sign_payload(payload: str, secret: str) -> str:
    """HMAC-SHA256 签名"""
    return hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()


def api_request(endpoint: str, payload: dict) -> dict:
    """发送 API 请求（带 HMAC 签名）"""
    timestamp = str(int(time.time()))
    nonce = uuid.uuid4().hex[:16]
    # subject 来自 payload["signatureSubject"]，如果存在的话（challenge 用）
    # activate/verify/heartbeat 不传 signatureSubject，subject 保持为空字符串
    subject = payload.get("signatureSubject", "")

    sig_payload = f"{PRODUCT_CODE}|{timestamp}|{nonce}|{subject}"
    signature = sign_payload(sig_payload, APP_KEY)

    params = {
        "appKey": APP_KEY,
        "timestamp": timestamp,
        "nonce": nonce,
        "signature": signature,
        **payload,
    }

    url = f"{SERVER_URL}/api/client/{endpoint}"
    resp = requests.post(url, json=params, timeout=10)
    data = resp.json()

    if not data.get("success"):
        err = data.get("error", {})
        if endpoint == "activate.php":
            print(f"    [DEBUG] sig_payload: {sig_payload}")
            print(f"    [DEBUG] APP_KEY: {APP_KEY}")
            print(f"    [DEBUG] signature: {signature}")
            print(f"    [DEBUG] error: {err}")
        raise RuntimeError(f"API Error: {err.get('message', 'unknown')}")
    return data.get("data", {})


def main():
    print("=" * 60)
    print("KeyTrialPro SDK 测试 - 纯 Python 模拟")
    print("=" * 60)

    # Step 1: 收集机器指纹
    print("\n[1] 收集机器指纹...")
    fp_data = collect_fingerprint()
    print(f"    Machine Hash: {fp_data['machineHash']}")
    print(f"    Signature Subject: {fp_data['signatureSubject']}")

    # Step 2: 请求 Challenge
    print("\n[2] 请求 Challenge...")
    challenge_data = api_request("challenge.php", {
        "productId": PRODUCT_CODE,
        "machineContext": fp_data["fingerprint"],
        "signatureSubject": fp_data["signatureSubject"],
    })
    print(f"    Challenge ID: {challenge_data.get('challengeId')}")
    print(f"    Challenge: {challenge_data.get('challenge')}")

    # Step 3: 激活卡密
    print("\n[3] 激活卡密...")
    print(f"    Card Key: {CARD_KEY}")

    # 生成 challenge 签名（与 PHP LicenseService::consumeChallenge 一致：纯 SHA256）
    challenge_sig_subject = fp_data["signatureSubject"]
    challenge_signature = hashlib.sha256(
        f"{challenge_data['challenge']}|{challenge_sig_subject}".encode()
    ).hexdigest()

    activation_data = api_request("activate.php", {
        "productId": PRODUCT_CODE,
        "cardKey": CARD_KEY,
        "challengeId": challenge_data.get("challengeId"),
        "challengeSignature": challenge_signature,
        "machineContext": fp_data["fingerprint"],
        "sdkVersion": "python-sdk/1.0.0",
    })

    print(f"\n[OK] Activation success!")
    print(f"    License ID: {activation_data.get('licenseId')}")
    print(f"    Machine ID: {activation_data.get('machineId')}")
    print(f"    Expires: {activation_data.get('expiresAt')}")
    print(f"    Online Window: {activation_data.get('onlineWindowSeconds')}s")

    # Step 4: 验证许可证
    print("\n[4] 验证许可证...")
    verify_data = api_request("verify.php", {
        "productId": PRODUCT_CODE,
        "machineFingerprint": fp_data["fingerprint"],
    })
    print(f"    Status: {verify_data.get('status')}")
    print(f"    License ID: {verify_data.get('licenseId')}")

    # Step 5: 发送心跳
    print("\n[5] 发送心跳...")
    heartbeat_data = api_request("heartbeat.php", {
        "productId": PRODUCT_CODE,
        "machineFingerprint": fp_data["fingerprint"],
        "sdkVersion": "python-sdk/1.0.0",
    })
    print(f"    Online Window: {heartbeat_data.get('onlineWindowSeconds')}s")

    print("\n" + "=" * 60)
    print("All tests passed!")
    print("=" * 60)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\n[X] Test failed: {e}")
        import traceback
        traceback.print_exc()