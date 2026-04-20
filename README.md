# KeyTrialPro

企业级多产品许可证管理平台。

**核心作用：用卡密激活软件 → 绑定电脑 → 服务器授权验证。**

支持机器绑定授权（卡密激活、设备绑定）、试用管理（试用时长、在线心跳）、风险引擎（反调试、反虚拟机、Hook 检测）、手动审核流程（绑定审批队列），可统一管理多个软件产品。

技术栈：PHP API（服务端）+ React 管理后台 + C++ 原生 DLL（核心安全逻辑）+ Python / C# / 易语言 多语言 SDK。

## 目录结构

```
KeyTrialPro/
├── apps/                          # 应用层
│   ├── php-api/                   # PHP API（服务端）
│   │   ├── public/                # Web 入口（nginx 指向此目录）
│   │   │   ├── index.php          # 入口文件
│   │   │   └── api/               # API 端点
│   │   │       ├── admin/         # 管理端接口（认证/仪表盘/产品/许可证/策略/风控/审批/审计）
│   │   │       └── client/        # 客户端接口（挑战/激活/验证/心跳/试用/换机）
│   │   ├── scripts/               # 定时任务脚本（如每日统计聚合）
│   │   └── src/                   # 业务逻辑层
│   │       ├── bootstrap/         # 框架引导（autoload / config / endpoint）
│   │       ├── modules/           # 核心业务模块
│   │       │   ├── Admin/         # 管理员账号
│   │       │   ├── Approval/      # 人工审批
│   │       │   ├── Audit/         # 审计日志
│   │       │   ├── Fingerprint/    # 机器指纹
│   │       │   ├── License/        # 许可证/卡密/绑定
│   │       │   ├── Policy/         # 许可证策略/试用策略
│   │       │   ├── Product/       # 产品管理
│   │       │   ├── Risk/           # 风险规则/事件
│   │       │   ├── SecurityProfile/# 安全配置（反调试/反VM/Hook检测）
│   │       │   └── Stats/          # 平台统计
│   │       └── shared/            # 共享基础设施
│   │           ├── Http/          # HTTP 请求封装
│   │           ├── Persistence/   # 数据库操作
│   │           ├── Security/      # 安全工具（HMAC/加密/Replay防护）
│   │           └── Support/       # 通用工具
│   └── admin-web/                 # React 管理后台（Vite + TypeScript）
│       ├── dist/                  # npm run build 产出（静态资源）
│       └── src/
│           ├── components/        # 通用 UI 组件
│           ├── pages/             # 页面（仪表盘/产品/许可证/策略/风控等）
│           └── styles/            # 样式文件
│
├── native/
│   └── win32-core-dll/           # C++ 原生 DLL（x86/x64）
│       ├── include/               # SDK 头文件（keytrialpro_sdk.h）
│       ├── src/                   # 核心实现
│       │   └── keytrialpro_sdk.cpp  # TLS pinning / 机器指纹 / 反调试 / HMAC
│       └── build/                 # CMake 编译产出
│
├── sdk/                           # 多语言 SDK 封装层
│   ├── python/                    # Python SDK（ctypes 调用原生 DLL）
│   │   ├── keytrialpro/           # SDK 源码
│   │   ├── examples/              # 使用示例
│   │   └── test_license.py       # SDK 激活流程测试脚本（无需 C++ DLL，纯 HTTP 测试）
│   ├── csharp/                    # C# SDK（.NET P/Invoke）
│   │   └── KeyTrialPro.Sdk/       # 项目文件
│   └── e32/                       # 易语言 SDK（__stdcall 调用 DLL）
│
├── deploy/                        # 部署配置文件
│   ├── mysql/schema.sql           # 完整数据库结构（含种子数据）
│   ├── nginx/keytrialpro.conf     # Nginx 反向代理配置
│   ├── php-fpm/www.conf           # PHP-FPM 进程池配置
│   └── redis/redis.conf           # Redis 配置
│
├── docs/                          # 开发文档
│   ├── api/endpoints.md           # API 接口清单
│   ├── architecture/              # 架构文档
│   │   ├── system-design.md       # 系统设计
│   │   ├── dashboard-metrics.md  # 仪表盘指标
│   │   └── operations.md         # 运维手册
│   ├── sdk/                       # SDK 开发文档
│   │   ├── integration.md         # SDK 集成指南
│   │   └── native-abi.md         # 原生 ABI 合约
│   └── security/model.md          # 安全模型
│
├── packages/                      # 共享包（Monorepo 共享代码）
│   ├── api-contracts/             # API 契约定义（JSON Schema）
│   └── shared-docs/               # 共享文档片段
│
├── scripts/                       # 开发辅助脚本（.NET 工具）
│   ├── local-cert-tool/           # 本地 HTTPS 证书生成工具
│   └── local-https-proxy/         # 本地开发 HTTPS 代理
│
├── .local-certs/                  # 本地开发用 SSL 证书
├── CLAUDE.md                      # Claude Code 工作指引
└── README.md                      # 项目说明
```

## Workspace

- `apps/php-api`: static PHP API endpoints with shared service layer
- `apps/admin-web`: React admin console scaffold
- `native/win32-core-dll`: C++ x86 DLL contract and starter implementation
- `sdk`: E language, Python, and C# wrappers
- `deploy`: Ubuntu deployment configs
- `docs`: architecture, security, API, and SDK docs

## Quick Start

1. Copy `apps/php-api/.env.example` to `apps/php-api/.env`.
2. Import `deploy/mysql/schema.sql` into MySQL.
3. Point Nginx and PHP-FPM to `apps/php-api/public`.
4. Install frontend dependencies in `apps/admin-web` and run the dev server.

## SDK 测试（Python）

无需编译 C++ DLL，可直接用 Python 测试完整激活流程：

```bash
cd sdk/python
python test_license.py
```

脚本会自动执行：收集指纹 → 请求 Challenge → 激活卡密 → 验证许可证 → 发送心跳。

使用前修改脚本中的配置：
```python
SERVER_URL = "https://key.462030.xyz"   # 服务器地址
PRODUCT_CODE = "your_product_code"       # 产品编码
APP_KEY = "your_app_key"                # 产品的 client_app_key
CARD_KEY = "XXXX-XXXX-XXXX-XXXX"     # 卡密
```

## Status

This repository is an implementation-grade skeleton. It defines module boundaries, endpoints, schemas, DTOs, deployment files, and SDK contracts so product-specific business logic can be completed on top of a stable base.

