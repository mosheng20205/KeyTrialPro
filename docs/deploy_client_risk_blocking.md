# 客户端风险信号阻断部署说明

## 本次改动目标

为客户端授权链路增加基于 `riskSignals` 的服务端阻断能力：

1. 新增独立风险上报接口 `public/api/client/risk.php`
2. 在 `verify.php`、`heartbeat.php`、`activate.php` 中接入 `riskSignals`
3. 服务端根据高风险信号返回 `authorized = false`
4. 风险事件写入现有 `risk_events` 表

## 涉及文件

- `apps/php-api/src/modules/Risk/RiskService.php`
- `apps/php-api/public/api/client/verify.php`
- `apps/php-api/public/api/client/heartbeat.php`
- `apps/php-api/public/api/client/activate.php`
- `apps/php-api/public/api/client/risk.php`

## 风险信号字段

客户端可上报如下字段：

```json
{
  "riskSignals": {
    "debuggerAttached": false,
    "systemProxyEnabled": false,
    "systemProxyAddress": "",
    "suspiciousProcesses": [],
    "suspiciousRootCertificates": [],
    "suspiciousModules": [],
    "apiHookDetected": false,
    "vmDetected": false,
    "codeIntegrityOk": true
  }
}
```

## 阻断规则

当前版本命中以下任一情况会返回阻断：

- `debuggerAttached = true`
- `apiHookDetected = true`
- `codeIntegrityOk = false`
- 命中本地代理特征：`127.0.0.1`、`localhost`、`:8888`、`:8080`、`:9090`、`:8000`
- `suspiciousProcesses` 中包含抓包/调试/逆向工具关键字
- `suspiciousRootCertificates` 非空

`vmDetected = true` 当前只记录，不直接阻断。

## 接口返回

高风险时接口会返回：

```json
{
  "success": true,
  "data": {
    "status": "risk_blocked",
    "authorized": false,
    "riskLevel": "critical",
    "blockReason": "检测到抓包、代理或调试环境，请关闭相关工具后重试。"
  }
}
```

## 部署步骤

1. 备份当前 `apps/php-api`
2. 覆盖上传上述 5 个文件
3. 执行 PHP 语法检查：

```bash
php -l apps/php-api/src/modules/Risk/RiskService.php
php -l apps/php-api/public/api/client/risk.php
php -l apps/php-api/public/api/client/verify.php
php -l apps/php-api/public/api/client/heartbeat.php
php -l apps/php-api/public/api/client/activate.php
```

4. 重载 PHP-FPM
5. 重载 Nginx
6. 调用 `POST /api/client/risk.php` 验证正常/高风险返回
7. 检查 `risk_events` 表是否写入事件

## 验证建议

### 正常请求

- `authorized = true`
- `status = ok`
- `riskLevel = low`

### 高风险请求

- `authorized = false`
- `status = risk_blocked`
- `riskLevel = critical`
- `blockReason` 有明确阻断原因

### verify 授权链路

对 `verify.php` 发送合法签名请求并附带高风险 `riskSignals`：

- 应返回 `authorized = false`
- 不应继续进入试用/正式授权放行逻辑

