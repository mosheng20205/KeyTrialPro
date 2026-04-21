# C# DLL 对接实践说明

本文基于两个现成 demo 的实际接入经验整理：

- `sdk/csharp/KeyTrialPro.SmokeTest`
- `sdk/csharp/KeyTrialPro.WinFormsTester`

目标读者是后续需要在其他 C# 项目里接入 `keytrialpro_sdk.dll` 的开发者。重点不是解释服务端设计，而是给出一套能直接落地的 DLL 接入方法和排错路径。

## 1. 最小可用结论

如果你要让一个新的 C# 项目接入验证能力，最少需要准备下面 5 个参数：

- `product_code`
- `server_url`
- `client_app_key`
- `cert_pins`
- `card_key`

其中：

- `product_code`：产品编码，例如 `testp3`
- `server_url`：服务端根地址，例如 `https://key.462030.xyz`
- `client_app_key`：该产品对应的客户端签名密钥
- `cert_pins`：服务端 HTTPS 证书叶子证书的 SHA-256 pin，支持多个 pin 用英文逗号分隔
- `card_key`：需要激活或验证的卡密

`软件名称` 不是 DLL 初始化所必需的参数。它可以用于你自己的日志、UI 展示或测试输出，但 DLL 初始化本身不依赖它。

## 2. 推荐使用方式

不要在业务项目里直接自己写 `DllImport`。优先复用仓库里的 C# 包装层：

- `sdk/csharp/KeyTrialPro.Sdk/NativeMethods.cs`
- `sdk/csharp/KeyTrialPro.Sdk/KeyTrialClient.cs`

当前推荐入口是：

```csharp
var client = new KeyTrialClient(productCode, serverUrl, clientAppKey, certPins);
```

然后通过下面这些方法调用 DLL：

- `CollectFingerprint()`
- `Activate(cardKey)`
- `Verify()`
- `Heartbeat()`
- `StartTrial()`
- `GetTrialStatus()`
- `RequestRebind(reason)`

这样做的好处是：

- DLL 初始化参数集中
- 原生错误统一抛出为 C# 异常
- 返回值统一是 JSON，业务层更容易处理

## 3. DLL 放置要求

`keytrialpro_sdk.dll` 必须能被运行中的 C# 进程找到。最稳妥的方式是把 DLL 放到 exe 同目录。

实际项目里建议：

1. 目标平台统一使用 `x64`
2. C# 项目输出目录中包含 `keytrialpro_sdk.dll`
3. `KeyTrialPro.Sdk.dll` 与业务 exe 放在一起

如果平台不一致，常见现象是：

- 程序启动即报找不到 DLL
- 调用时抛 `BadImageFormatException`

## 4. 推荐调用顺序

生产项目里建议按下面顺序接入：

1. 创建 `KeyTrialClient`
2. 调用 `CollectFingerprint()`
3. 激活时调用 `Activate(cardKey)`
4. 日常启动或关键功能前调用 `Verify()`
5. 长时间在线时按策略调用 `Heartbeat()`

最常见的两条链路：

### 4.1 首次激活

```csharp
using var activation = client.Activate(cardKey);
```

你应该解析：

- `success`
- `data.status`
- `data.expiresAt`

### 4.2 启动校验

```csharp
using var verification = client.Verify();
```

你应该解析：

- `success`
- `data.status`
- `data.expiresAt`

## 5. 验收标准怎么判定

从这次两个 demo 的测试经验看，客户端不要只看 HTTP 是否成功，也不要只看 `success=true`。

推荐按下面规则判断：

### 5.1 激活成功

至少同时满足：

- `activation.success == true`
- `activation.data.status` 有值

### 5.2 验证成功

至少同时满足：

- `verification.success == true`
- `verification.data.status` 有值

### 5.3 到期时间

优先读取：

- `verification.data.expiresAt`

如果某些场景服务端返回里没有它，再回退读取：

- `activation.data.expiresAt`

当前建议按下面逻辑处理：

- 有值：说明这是有到期时间的卡
- 空字符串或不存在：说明这是无到期时间的卡

不要自己在客户端猜测到期时间，也不要把本地时间当成最终判定依据。服务端返回才是准确信源。

## 6. 两个 demo 各自适合做什么

## 6.1 SmokeTest

文件：

- `sdk/csharp/KeyTrialPro.SmokeTest/Program.cs`

适合：

- 命令行快速验通
- CI 或手工冒烟测试
- 对比激活和验证返回 JSON

这个 demo 体现了一个很实用的做法：

- 先 `Activate`
- 再 `Verify`
- 统一打印摘要 JSON
- 同时输出 `status` 和 `expiresAt`

如果你在新项目里先不想接 UI，优先照这个模式落地。

## 6.2 WinFormsTester

文件：

- `sdk/csharp/KeyTrialPro.WinFormsTester/MainForm.cs`

适合：

- 让测试或实施同事自己录入参数
- 快速验证 `product_code/server_url/client_app_key/cert_pins/card_key`
- 一键执行“激活并验证”
- 保存本地配置，减少重复输入

这个 demo 额外总结出了两个很有价值的实践：

- 可以在客户端内直接获取 `cert pin`
- 可以把常用接入参数持久化到本地配置文件

## 7. cert_pins 从哪里来

`cert_pins` 本质上是服务端 HTTPS 叶子证书原始证书内容做 SHA-256 后的十六进制小写字符串。

它要这样理解：

- 它不是后台接口动态下发的业务字段
- 它也不是“某个软件专属固定值”
- 它和 `product_code` 没有直接绑定关系
- 它实际绑定的是 `server_url` 当前返回的 HTTPS 叶子证书

换句话说，只要两个产品最终都请求同一个 `https://...` 服务地址，并且握手拿到的是同一张叶子证书，那么它们可以使用同一个 `cert_pins`。

当前项目的原生 DLL 校验规则也是按这个逻辑实现的：

- `cert_pins` 必须是小写十六进制
- 支持多个 pin，用英文逗号分隔
- DLL 会在 TLS 握手后读取服务器叶子证书
- 然后对证书原始二进制做 SHA-256
- 只要结果命中你配置的任意一个 pin，就通过校验

服务端配置里也预留了同一份 pinset 环境变量：

- `apps/php-api/.env.example`
- `TLS_PINSET_SHA256=replace-with-production-pin`

这意味着正式部署时，客户端 SDK 和服务端运维侧都应该清楚当前线上证书对应的 pin 值。

WinForms demo 已经内置了获取方法，逻辑在：

- `sdk/csharp/KeyTrialPro.WinFormsTester/MainForm.cs`

核心流程是：

1. 连接 `server_url`
2. 建立 TLS 握手
3. 读取远端叶子证书
4. 对证书原始二进制做 SHA-256
5. 输出 64 位十六进制字符串

如果你不想自己写代码，最直接的办法就是运行 WinFormsTester，然后点击“获取 Cert Pin”按钮。

如果你想在实施或运维机器上手工获取，也可以直接用下面这段 PowerShell：

```powershell
$serverUrl = "https://your-domain.com"
$uri = [Uri]$serverUrl

$tcp = [System.Net.Sockets.TcpClient]::new()
$tcp.Connect($uri.Host, $(if ($uri.Port -gt 0) { $uri.Port } else { 443 }))

$ssl = [System.Net.Security.SslStream]::new(
    $tcp.GetStream(),
    $false,
    { param($sender, $cert, $chain, $errors) $true }
)

$ssl.AuthenticateAsClient($uri.Host)
$cert = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new($ssl.RemoteCertificate)
$pin = [Convert]::ToHexString([System.Security.Cryptography.SHA256]::HashData($cert.RawData)).ToLowerInvariant()

$ssl.Dispose()
$tcp.Dispose()
$pin
```

注意事项：

- 只能对 `HTTPS` 地址取 pin
- 证书更新后 pin 也会变化
- 如果服务端未来会切证书，建议同时配置多个 pin
- 如果前面接了 CDN、反向代理或云 WAF，要取的是客户端实际访问域名当前返回的证书 pin

示例格式：

```text
29db02907c53989a408e70270d65d001a7e2e3ecf779287c9f46f4eedfdb9026
```

多个 pin：

```text
pin_a,pin_b
```

## 8. 常见坑

### 8.1 `product_code` 和 `product_name` 搞混

DLL 初始化需要的是产品编码，不是产品显示名称。

正确：

```text
testp3
```

错误：

```text
测试微信支付3
```

## 8.2 `client_app_key` 用错产品

`client_app_key` 是按产品绑定的。产品编码对了，但 app key 不是同一个产品的，也会导致签名校验失败。

## 8.3 用 HTTP 地址

当前 pin 校验依赖 HTTPS。`server_url` 必须是 `https://...`

## 8.4 只看 `success`

某些业务场景下，`success=true` 只代表接口调用成功，不等于授权状态符合预期。业务层仍然要看：

- `data.status`
- `data.expiresAt`

## 8.5 忘了把 DLL 带到输出目录

如果你的项目只引用了 `KeyTrialPro.Sdk.dll`，但运行目录没有 `keytrialpro_sdk.dll`，调用时仍然会失败。

## 8.6 证书 pin 过期

服务端更新 HTTPS 证书后，旧的 `cert_pins` 可能立刻失效。这时最直观的现象是：

- 地址能浏览器访问
- 但 DLL 请求失败

这时先重新获取一次 `cert pin`。

## 9. 新项目推荐接入模板

可以直接按下面模式开始：

```csharp
using System.Text.Json;
using KeyTrialPro.Sdk;

var client = new KeyTrialClient(productCode, serverUrl, clientAppKey, certPins);

using var activation = client.Activate(cardKey);
using var verification = client.Verify();

var activationJson = activation.RootElement;
var verificationJson = verification.RootElement;

var activationSuccess = activationJson.GetProperty("success").GetBoolean();
var verificationSuccess = verificationJson.GetProperty("success").GetBoolean();

var status = verificationJson
    .GetProperty("data")
    .GetProperty("status")
    .GetString();

string? expiresAt = null;
if (verificationJson.GetProperty("data").TryGetProperty("expiresAt", out var expiresProperty) &&
    expiresProperty.ValueKind == JsonValueKind.String)
{
    expiresAt = expiresProperty.GetString();
}
```

业务层建议至少输出：

- `product_code`
- `server_url`
- `machineId`
- `activation.success`
- `verification.success`
- `verification.data.status`
- `verification.data.expiresAt`

## 10. 推荐排错顺序

如果其他项目对接失败，建议按下面顺序排查：

1. DLL 是否在 exe 同目录
2. 进程位数和 DLL 位数是否一致
3. `server_url` 是否是 HTTPS
4. `product_code` 是否写成了产品名称
5. `client_app_key` 是否与该产品匹配
6. `cert_pins` 是否与当前证书匹配
7. `card_key` 是否属于该产品
8. 服务端 `verify` 返回里是否包含 `status` / `expiresAt`

## 11. 后续项目建议

如果是正式业务项目，而不是测试工具，建议直接复用以下思路：

- 保留一个最小的命令行 SmokeTest 作为自动化验收工具
- 保留一个参数可视化录入工具给测试人员自助使用
- 在正式业务项目里只保留 `KeyTrialClient` 调用层，不要到处散落 `DllImport`
- 把 `status` 和 `expiresAt` 作为标准字段写入业务日志

这样后续换产品接入时，基本只需要替换 4 个参数：

- `product_code`
- `server_url`
- `client_app_key`
- `cert_pins`

卡密由业务输入即可。
