# KeyTrialPro 宝塔生产更新：许可证到期与首次激活计时

适用更新：修复过期许可证仍可授权的问题，并新增“永久 / 固定到期 / 首次激活后计时”三种卡密有效期模式。

## 1. 更新前备份

在宝塔面板进入 **数据库**，选择 `keytrialpro`，点击 **备份**。确认备份文件生成后再继续。

也可以用命令行备份：

```bash
mysqldump -u root -p keytrialpro > /www/backup/keytrialpro-before-license-expiry.sql
```

## 2. 上传代码并构建后台

把本次更新后的项目文件上传到：

```text
/www/wwwroot/keytrialpro/
```

在服务器或本地构建管理后台：

```bash
cd /www/wwwroot/keytrialpro
npm install
npm run build:admin
```

如果你习惯本地构建，也可以只上传 `apps/admin-web/dist/` 和 PHP 代码变更。

## 3. 执行数据库迁移

在宝塔面板进入 **数据库** -> `keytrialpro` -> **导入**，导入：

```text
deploy/mysql/2026-05-12-license-activation-duration.sql
```

或使用命令行：

```bash
mysql -u root -p keytrialpro < /www/wwwroot/keytrialpro/deploy/mysql/2026-05-12-license-activation-duration.sql
```

迁移效果：

- `expires_at IS NULL` 的旧卡密会标记为 `permanent`。
- `expires_at IS NOT NULL` 的旧卡密会标记为 `fixed`。
- 旧卡密不会自动转换成首次激活计时卡，避免改变已售权益。

## 4. 重载服务

在宝塔面板中重载：

- **Nginx** -> 重载
- **PHP** -> 重载或重启当前 PHP-FPM 版本

命令行方式：

```bash
/etc/init.d/nginx reload
/etc/init.d/php-fpm-81 reload
```

如果 PHP 版本不是 8.1，把 `php-fpm-81` 替换成宝塔中实际版本。

## 5. 验证

在管理后台 `/admin/` 做三组检查：

1. 创建“永久”卡密，激活后验证接口应返回 `authorized=true`，`expiresAt=null`。
2. 创建“固定到期时间”为未来日期的卡密，激活后验证应授权。
3. 创建“首次激活后计时”卡密，例如 1 小时；激活前库存显示“首次激活后 1 小时”，激活后显示最终 `expires_at`。

过期拦截验证：

```sql
UPDATE licenses
SET expires_at = DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 MINUTE)
WHERE license_key = '你的测试卡密';
```

再次调用客户端 `verify.php` 或 `heartbeat.php`，应返回：

```json
{
  "status": "license_expired",
  "authorized": false
}
```

验证完成后删除测试卡密或恢复测试数据。
