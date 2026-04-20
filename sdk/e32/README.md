# 易语言 32 位 SDK 接入

当前仓库提供的是 **易语言兼容的 DLL 导出契约**。易语言端不重复实现机器码逻辑，只导入 `keytrialpro_sdk.dll` 中的标准导出函数。

## 推荐导入函数

- `KtpInit`
- `KtpCollectFingerprintJson`
- `KtpRequestChallengeJson`
- `KtpActivateLicenseJson`
- `KtpVerifyLicenseJson`
- `KtpHeartbeatJson`
- `KtpStartTrialJson`
- `KtpGetTrialStatusJson`
- `KtpRequestRebindJson`
- `KtpGetLastError`

## 约定

- 调用约定：`__stdcall`
- 字符串编码：ANSI 或 UTF-8 缓冲区
- 所有复杂返回值统一为 JSON 字符串，便于易语言直接解析
- 关键安全逻辑仍在 DLL 内，不在易语言层暴露

