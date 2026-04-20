# KeyTrialPro 生产环境部署文档（宝塔面板）

> 本文档适用场景：Ubuntu 22.04+ 服务器，通过宝塔面板（aaPanel）进行可视化运维，**GUI 优先**原则，尽量使用宝塔面板的图形化界面完成操作，仅在绝对必要时提供命令行指令。

---

## 一、技术栈概览

| 组件 | 规格 | 说明 |
|------|------|------|
| **PHP API** | PHP 8.1+ | 许可证核心业务接口 |
| **管理后台** | React 19 + Vite 7 | 前端静态资源，独立部署 |
| **数据库** | MySQL 5.7.43 | 许可证、设备绑定、策略、审计等核心数据 |
| **缓存** | Redis 6.0+ | 会话、Nonce 防重放、短窗口在线追踪 |
| **Web 服务器** | Nginx 1.29+ | 反向代理 + PHP-FPM |
| **PHP-FPM** | 8.4（Unix Socket） | 进程管理，静态池配置 |

---

## 二、环境准备

### 2.1 安装宝塔面板

```bash
# Ubuntu 22.04 执行以下命令安装 aaPanel（宝塔国际版）
wget -O install.sh http://www.aapanel.com/install/install_6.0.sh && sudo bash install.sh aapanel
```

安装完成后，访问面板地址（安装完成后会输出 URL 和默认账号信息），登录后进行以下操作。

### 2.2 安装必要软件（通过宝塔面板 → 软件商店）

在 **软件商店** 中搜索并安装（建议使用编译安装以获得更好性能）：

| 软件 | 版本 | 用途 |
|------|------|------|
| **Nginx** | 1.29+ | Web 服务器、反向代理 |
| **PHP 8.1+** | 8.1 / 8.2 / 8.4 | PHP-FPM 运行 API |
| **MySQL 5.7** | 5.7.43 | 关系型数据库 |
| **Redis** | 6.0+ | 缓存和会话存储 |

**操作步骤（宝塔 GUI）：**

1. 进入 **软件商店** → 搜索"Nginx" → 选择安装（编译版）
2. 进入 **软件商店** → 搜索"PHP" → 选择 8.1 或 8.2 版本安装
3. 进入 **软件商店** → 搜索"MySQL" → 选择 5.7 安装
4. 进入 **软件商店** → 搜索"Redis" → 选择安装

### 2.3 PHP 扩展安装（通过宝塔面板）

PHP 安装完成后，需安装以下扩展：

> **宝塔面板操作**：软件商店 → 找到已安装的 PHP 版本 → 点击 **设置** → **安装扩展** → 勾选以下扩展后点击 **安装**

| 扩展 | 用途 |
|------|------|
| **pdo_mysql** | MySQL 数据库驱动 |
| **redis** | Redis 连接驱动 |
| **mbstring** | 多字节字符串处理 |
| **openssl** | HTTPS 加密 |
| **json** | JSON 解析 |

---

## 三、项目文件上传

### 3.1 创建网站目录

在宝塔面板中创建项目目录：

> **宝塔面板操作**：文件 → 找到 `/www/wwwroot` → 新建文件夹 `keytrialpro`

### 3.2 上传项目文件

将本地 `T:\github\KeyTrialPro` 目录下的 `apps` 目录上传至 `/www/wwwroot/keytrialpro/`。

**上传方式（三选一）：**

| 方式 | 操作步骤 |
|------|----------|
| **宝塔文件管理器** | 打开 `/www/wwwroot/keytrialpro/` → 点击 **上传** → 选择本地 `apps` 文件夹上传 |
| **SFTP** | 使用 WinSCP / FileZilla 连接服务器，SFTP 上传 |
| **Git 拉取** | 命令行：`cd /www/wwwroot && git clone <your-repo-url> .` |

**最终目录结构应为：**
```
/www/wwwroot/keytrialpro/
├── apps/
│   ├── php-api/          # PHP API（public 为入口）
│   │   ├── public/
│   │   │   ├── index.php
│   │   │   └── api/
│   │   ├── src/
│   │   └── .env          # 生产配置（稍后创建）
│   └── admin-web/         # React 管理后台（dist 为产出）
│       └── dist/          # npm run build 产出
```

### 3.3 构建管理后台（Node.js 环境）

如需重新构建管理后台（`apps/admin-web/dist`），需要安装 Node.js：

> **宝塔面板操作**：软件商店 → 搜索 **Node.js 版本管理器** → 安装 → 选择 Node.js 18+ LTS

**重要：构建前必须修改 vite.config.ts**，否则管理后台 JS 资源路径会 404：

修改本地 `apps/admin-web/vite.config.ts`，添加 `base: "/admin/"`：
```ts
export default defineConfig({
  plugins: [react()],
  base: "/admin/",   // 必须设置，JS/CSS 资源才能正确加载
  server: {
    port: 5173,
  },
});
```

然后在本地构建：
```bash
cd apps/admin-web
npm install
npm run build
```

构建完成后，将 `dist` 目录上传至服务器 `/www/wwwroot/keytrialpro/apps/admin-web/`。

---

## 四、数据库配置

### 4.1 创建数据库（宝塔 GUI）

> **宝塔面板操作**：数据库 → 点击 **添加数据库**

| 字段 | 值 |
|------|---|
| **数据库名** | `keytrialpro` |
| **字符集** | `utf8mb4` |
| **编码** | `utf8mb4_unicode_ci` |
| **用户名** | `keytrialpro` |
| **密码** | （生成强随机密码，妥善保存） |

### 4.2 导入数据表结构

> **宝塔面板操作**：点击刚创建的数据库 → 点击 **导入** → 选择文件 `deploy/mysql/schema.sql` 上传

或者通过命令行：
```bash
mysql -u root -p keytrialpro < /www/wwwroot/keytrialpro/deploy/mysql/schema.sql
```

### 4.3 创建应用数据库账号（最小权限原则）

```bash
# 命令行连接 MySQL
mysql -u root -p

# 创建应用专用账号
CREATE USER 'keytrialpro'@'127.0.0.1' IDENTIFIED BY '你的强密码';
GRANT SELECT, INSERT, UPDATE, DELETE ON keytrialpro.* TO 'keytrialpro'@'127.0.0.1';
FLUSH PRIVILEGES;
```

---

## 五、PHP 环境配置

### 5.1 配置 php.ini（宝塔 GUI）

> **宝塔面板操作**：软件商店 → PHP 版本 → 设置 → 配置修改

找到并修改以下参数：

```ini
; 文件上传大小（根据业务调整）
upload_max_filesize = 8M
post_max_size = 8M

; 时区
date.timezone = Asia/Shanghai

; 错误显示（生产环境建议关闭）
display_errors = Off
log_errors = On

; OPcache（生产环境建议开启）
opcache.enable = 1
opcache.memory_consumption = 128
opcache.interned_strings_buffer = 8
opcache.max_accelerated_files = 10000
```

### 5.2 上传 .env 生产配置文件

在 `apps/php-api/` 目录下创建 `.env` 文件：

> **宝塔面板操作**：文件 → 进入 `/www/wwwroot/keytrialpro/apps/php-api/` → 新建文件 `.env` → 粘贴以下内容并修改

```env
APP_ENV=production
APP_URL=https://你的域名.com
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=keytrialpro
DB_USER=keytrialpro
DB_PASSWORD=你的数据库密码
DB_CHARSET=utf8mb4
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
API_HMAC_KEY=生成64位以上的随机密钥
DATA_ENCRYPTION_KEY=生成32字节的随机密钥（base64编码，43字符）
ADMIN_JWT_SECRET=生成64位以上的随机密钥
TLS_PINSET_SHA256=生产环境TLS证书pin值
ADMIN_BOOTSTRAP_EMAIL=admin@example.com
ADMIN_BOOTSTRAP_PASSWORD=仅首次初始化或紧急重置时填写
ADMIN_BOOTSTRAP_DISPLAY_NAME=Platform Administrator
ADMIN_BOOTSTRAP_MFA_ENABLED=true
ADMIN_BOOTSTRAP_MFA_SECRET=
ADMIN_BOOTSTRAP_FORCE_SYNC=false
PRESENCE_WINDOW_SECONDS=300
TRIAL_DEFAULT_HEARTBEAT_SECONDS=180
TRIAL_DEFAULT_OFFLINE_GRACE_MINUTES=5
```

**密钥生成（命令行）：**
```bash
# 生成随机密钥
openssl rand -base64 64   # API_HMAC_KEY / ADMIN_JWT_SECRET
openssl rand -base64 32   # DATA_ENCRYPTION_KEY
```

**管理员账户维护建议：**

- 日常修改管理员邮箱、密码、MFA 开关，请直接在 `/admin/` 后台的“管理员设置”页面操作。
- `.env` 里的 `ADMIN_BOOTSTRAP_*` 仅建议用于首次初始化，或在你无法登录后台时做应急恢复。
- 如果需要强制把 `.env` 中的管理员信息覆盖到数据库，把 `ADMIN_BOOTSTRAP_FORCE_SYNC=true`，完成后请改回 `false` 并重启 PHP-FPM。
- `ADMIN_BOOTSTRAP_MFA_ENABLED` 对应数据库字段 `admins.mfa_enabled`。

---

## 六、Nginx 网站配置（宝塔 GUI）

### 6.1 创建网站

> **宝塔面板操作**：网站 → 添加站点

| 字段 | 值 |
|------|---|
| **域名** | `你的域名.com`（填你想用的域名） |
| **根目录** | `/www/wwwroot/keytrialpro/apps/php-api/public` |
| **PHP 版本** | 选择已安装的 PHP 版本 |
| **备注** | KeyTrialPro API |

### 6.2 配置伪静态

> **宝塔面板操作**：网站 → 找到刚创建的站点 → 点击 **设置** → **伪静态** → 选择 `ThinkPHP` 或粘贴以下规则

```nginx
location / {
    try_files $uri $uri/ /index.php?$query_string;
}

location ~ \.php$ {
    fastcgi_split_path_info ^(.+\.php)(/.+)$;
    include fastcgi_params;
    fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
    fastcgi_index index.php;
}
```

### 6.3 配置 SSL 证书（宝塔 Let's Encrypt）

> **宝塔面板操作**：网站 → 找到站点 → 点击 **设置** → **SSL** → 选择 **Let's Encrypt** → 勾选域名 → 点击 **申请**

申请成功后，Nginx 配置会自动更新。

### 6.4 补充 Nginx 自定义配置

> **注意**：Step 6.3 申请 SSL 证书后，宝塔已自动生成了 SSL 配置，**不要覆盖整个文件**，只需在 `server` 块内做两件事：① 替换 PHP 处理块以修复 `open_basedir` 限制；② 添加管理后台静态资源处理。

#### 6.4.1 替换 PHP 处理块（修复 open_basedir 限制）

> **原因**：宝塔默认的 `open_basedir` 只允许访问 `public/` 目录，PHP 无法加载 `src/` 下的业务代码，会报 `open_basedir restriction in effect` 错误。

找到宝塔生成的 `PHP-INFO-START` 块，将：

```nginx
    #PHP-INFO-START  PHP引用配置，可以注释或修改
    include enable-php-81.conf;
    #PHP-INFO-END
```

**替换为**（用你自己的 PHP 版本替换 socket 路径中的 `81`）：

```nginx
    #PHP-INFO-START  PHP引用配置，请勿删除或修改
    location ~ \.php$ {
        include fastcgi_params;
        fastcgi_split_path_info ^(.+\.php)(/.+)$;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        fastcgi_param PATH_INFO $fastcgi_path_info;
        fastcgi_index index.php;
        # 放开 open_basedir，允许访问整个 php-api 目录
        fastcgi_param PHP_VALUE "open_basedir=/www/wwwroot/keytrialpro/apps/php-api/:/tmp/";
        fastcgi_param PHP_ADMIN_VALUE "open_basedir=/www/wwwroot/keytrialpro/apps/php-api/:/tmp/";
        fastcgi_pass unix:/tmp/php-cgi-81.sock;
    }
    #PHP-INFO-END
```

#### 6.4.2 添加管理后台静态资源处理

将以下内容插入到 `server` 块内（通常放在文件末尾 `access_log` 之前）：

```nginx
    # 管理后台静态资源（^~ 优先匹配，跳过后续正则干扰）
    location ^~ /admin  {
        alias /www/wwwroot/keytrialpro/apps/admin-web/dist/;
        try_files $uri $uri/ /admin/index.html;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
```

**注意事项：**

- `location ^~ /admin` 使用了 `^~` 前缀修饰符，表示优先匹配并跳过所有后续正则 location，避免 `.js` 文件被其他正则规则拦截导致 404
- `location /admin` 不带末尾 `/`，这样 `/admin` 和 `/admin/` 两种路径均能匹配
- 如果后续新增了其他 location，请确保 `location ^~ /admin` 块在它们之前

**确保 PHP-FPM Socket 路径正确：**
> **宝塔面板操作**：软件商店 → PHP 版本 → 设置 → 配置文件 → 搜索 `listen =`，确认 socket 路径（如 `/tmp/php-cgi-81.sock`），替换上述配置中的路径。

---

## 七、Redis 配置

### 7.1 配置 Redis（宝塔 GUI）

> **宝塔面板操作**：软件商店 → 找到 Redis → 点击 **设置** → **配置修改**

确认以下配置（生产环境必须）：
```conf
bind 127.0.0.1          # 仅本地访问
port 6379
protected-mode yes      # 开启保护
requirepass 你的Redis密码
timeout 0
tcp-keepalive 300
maxmemory-policy allkeys-lru
```

**设置 Redis 密码：**
> **宝塔面板操作**：Redis 设置 → 找到 **密码设置** → 输入密码并保存

记得在 `.env` 中更新 `REDIS_PASSWORD`（需确认 PHP 是否支持 Redis 密码认证）。

### 7.2 防火墙放行（如需外部访问）

> **宝塔面板操作**：安全 → 防火墙 → 放行端口 → 添加 `6379`（仅对需要访问的应用放行）

---

## 八、目录权限设置

正确设置目录权限，确保安全：

```bash
# 项目根目录
chown -R www:www /www/wwwroot/keytrialpro

# PHP API 目录（可写目录）
chmod -R 755 /www/wwwroot/keytrialpro/apps/php-api/
chmod -R 775 /www/wwwroot/keytrialpro/apps/php-api/runtime  # 如有 runtime 目录

# 管理后台静态资源
chmod -R 755 /www/wwwroot/keytrialpro/apps/admin-web/dist/

# .env 文件（仅 PHP 可读，禁止外部访问）
chmod 640 /www/wwwroot/keytrialpro/apps/php-api/.env
```

---

## 九、PHP-FPM 进程优化（宝塔 GUI）

> **宝塔面板操作**：软件商店 → PHP 版本 → 设置 → 性能调整

根据服务器内存调整：

| 服务器内存 | pm.max_children | pm.start_servers | pm.min_spare_servers | pm.max_spare_servers |
|-----------|----------------|-----------------|---------------------|---------------------|
| **1GB** | 8 | 2 | 2 | 4 |
| **2GB** | 16 | 4 | 2 | 8 |
| **4GB** | 24 | 4 | 2 | 8 |
| **8GB+** | 32 | 8 | 4 | 16 |

---

## 十、防火墙与安全设置

### 10.1 开放必要端口（宝塔 GUI）

> **宝塔面板操作**：安全 → 防火墙 → 放行以下端口

| 端口 | 用途 | 建议 |
|------|------|------|
| 22 | SSH | 仅限指定 IP 或密钥登录 |
| 80 | HTTP | 开放（Let's Encrypt 续期需要） |
| 443 | HTTPS | 开放 |
| 8888 | 宝塔面板 | 仅限管理 IP 访问 |

### 10.2 宝塔系统加固（推荐）

> **宝塔面板操作**：面板设置 → 开启 **Basic Auth** 或 **IP 限制** → 设置访问控制

### 10.3 禁用 PHP 危险函数（宝塔 GUI）

> **宝塔面板操作**：软件商店 → PHP 版本 → 设置 → 禁用函数 → 添加以下

```
exec, shell_exec, system, passthru, proc_open, popen, curl_exec, curl_multi_exec, parse_ini_file, show_source
```

---

## 十一、验证部署

### 11.1 检查 PHP 是否正常

在浏览器访问：`https://你的域名.com/`

应有响应（即使返回 JSON 错误也比空白页好）。

### 11.2 检查数据库连接

访问 API 端点：`https://你的域名.com/api/admin/dashboard/overview.php`

检查响应中是否有数据库连接错误。

### 11.3 检查 Redis 连接

在服务器上执行：
```bash
redis-cli -a 你的密码 ping
# 应返回：PONG
```

### 11.4 检查管理后台

访问：`https://你的域名.com/admin/`

应能正常加载 React 管理后台页面。

---

## 十二、进程守护与自动启动

### 12.1 Nginx/PHP-FPM 自启动（宝塔默认已配置）

宝塔安装的软件默认已配置 systemd 服务，无需额外配置。

### 12.2 如果使用 Supervisor 守护（可选）

> **宝塔面板操作**：软件商店 → 搜索 **Supervisor** → 安装

添加守护进程（如有定时脚本）：
```ini
[program:keytrialpro-stats]
command=php /www/wwwroot/keytrialpro/apps/php-api/scripts/aggregate_daily_stats.php
autostart=true
autorestart=true
user=www-data
```

---

## 十三、日志查看

### 13.1 Nginx 错误日志（宝塔 GUI）

> **宝塔面板操作**：网站 → 站点 → 设置 → 日志 → 查看 **错误日志**

### 13.2 PHP-FPM 错误日志

默认路径：`/www/server/php/版本号/var/log/error.log`

### 13.3 Redis 日志

> **宝塔面板操作**：软件商店 → Redis → 设置 → 日志

---

## 十四、SSL 证书自动续期

宝塔面板的 Let's Encrypt 证书默认 **自动续期**，无需手动操作。

如需手动续期：
> **宝塔面板操作**：网站 → 站点 → 设置 → SSL → 点击 **续期**

---

## 十五、快速检查清单

部署完成后，逐一检查以下项目：

- [ ] 宝塔面板已安装并可访问
- [ ] Nginx、PHP、MySQL、Redis 已通过面板安装
- [ ] PHP 扩展（pdo_mysql、redis、mbstring、openssl）已安装
- [ ] 数据库 `keytrialpro` 已创建并导入 schema
- [ ] `.env` 文件已配置并设置正确权限
- [ ] 网站已创建，域名已解析
- [ ] SSL 证书已申请并生效
- [ ] Nginx 配置中已禁止访问 `.env`、`*.sql` 等敏感文件
- [ ] `vite.config.ts` 已添加 `base: "/admin/"`，管理后台重新构建并上传
- [ ] Nginx 配置中 `location ^~ /admin` 已添加，`PHP-INFO` 块已替换（open_basedir 已修正）
- [ ] 管理后台 `dist/` 目录已上传（或已构建）
- [ ] 目录权限已设置为 `www:www`
- [ ] Redis 已配置密码
- [ ] PHP 危险函数已禁用
- [ ] 防火墙已放行 80/443 端口
- [ ] 访问 `https://你的域名.com/` 有响应
- [ ] 访问管理后台 `https://你的域名.com/admin/` 有响应

---

## 十六、常见问题排查

| 问题现象 | 可能原因 | 解决方法 |
|---------|---------|---------|
| 空白页面 | PHP 报错未显示 / 数据库连接失败 | 开启 `display_errors`，检查 `.env` 配置 |
| **500 错误：open_basedir restriction** | PHP `open_basedir` 限制了只能访问 `public/` 目录 | 按 6.4.1 节替换 PHP 处理块，将 `open_basedir` 扩大至整个 `php-api/` 目录 |
| 502 Bad Gateway | PHP-FPM 未启动 / Socket 路径错误 | 重启 PHP-FPM，确认 Nginx 配置中的 socket 路径 |
| 数据库连接失败 | 密码错误 / 权限不足 | 检查 `.env` 中数据库密码，使用 phpMyAdmin 测试连接 |
| Redis 连接失败 | 未配置密码 / 未开启扩展 | 检查 Redis 密码配置，确认 PHP redis 扩展已安装 |
| SSL 证书申请失败 | 域名未解析 / 防火墙阻断 80 端口 | 确认域名已解析到服务器，确保 80 端口开放 |
| **管理后台 JS 404 / 页面空白** | `vite.config.ts` 未设置 `base: "/admin/"`，导致 JS 请求到 `/assets/` 而非 `/admin/assets/`；或 Nginx 正则 location 拦截了静态文件 | ① 本地修改 `vite.config.ts` 添加 `base: "/admin/"` 后重新 `npm run build` 并上传；② 按 6.4.2 节确保 `location ^~ /admin` 存在且在最前 |
| 管理后台 /admin 404 | `location /admin/` 末尾多了 `/`，导致 `/admin` 不带斜杠无法匹配 | 确保使用 `location /admin`（不带末尾 `/`），或加 `^~` 前缀修饰符 |

---

*文档版本：v1.0 | 适用系统：Ubuntu 22.04+ | 面板版本：aaPanel (宝塔国际版)*
