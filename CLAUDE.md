# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

KeyTrialPro is an enterprise-grade multi-product license management platform with:
- **PHP API backend** (static endpoints with shared service layer)
- **React admin console** (Vite + TypeScript)
- **Native C++ x86 DLL** (Windows SDK core)
- **Multi-language SDK wrappers** (E language, Python, C#)
- **Ubuntu deployment** (Nginx, PHP-FPM, MySQL, Redis)

## Architecture

### Runtime Flow
```
Windows Client → SDK Wrapper → C++ DLL → PHP API
                                      ↓
                              MySQL + Redis
                                      ↑
                          React Admin Console
```

### Core Modules
- **Product**: Product registry and security profiles
- **License**: Card keys, licenses, device bindings, trial sessions
- **Fingerprint**: Machine snapshots with encrypted storage
- **Risk**: Rules engine, events, blocking decisions
- **Approval**: Manual review queue and workflow
- **Stats**: Platform/product metrics, daily aggregation
- **Admin**: Local accounts, MFA, role-based access
- **Audit**: Immutable action logs

### Key Principles
- Single platform managing multiple products
- Strict machine binding with per-product policy isolation
- Server-authoritative trial expiration
- Short-window presence tracking for online counts
- Risk engine integrated into every binding lifecycle

## Development Commands

### PHP API

```bash
# Setup
cd apps/php-api
cp .env.example .env
# Edit .env with database credentials

# Import schema
mysql -u root -p < ../../deploy/mysql/schema.sql

# Run with PHP built-in server (development only)
php -S localhost:8000 -t public

# Production: Configure Nginx + PHP-FPM
# Point document root to apps/php-api/public
```

### React Admin Console

```bash
# Install dependencies
npm install

# Development server
npm run dev:admin
# or
cd apps/admin-web && npm run dev

# Production build
npm run build:admin
# or
cd apps/admin-web && npm run build

# Preview production build
cd apps/admin-web && npm run preview
```

### Native C++ DLL

```bash
cd native/win32-core-dll

# Configure
cmake -B build -G "Visual Studio 17 2022" -A Win32

# Build
cmake --build build --config Release

# Output: build/Release/keytrialpro_sdk.dll
```

### SDK Wrappers

**Python:**
```bash
cd sdk/python
pip install -e .

# Run example
python examples/basic_usage.py
```

**C#:**
```bash
cd sdk/csharp
dotnet build
```

**E Language (易语言):**
- Import functions from `keytrialpro_sdk.dll` using `__stdcall` convention
- See `sdk/e32/README.md` for function signatures
- All complex returns are JSON strings for easy parsing

## PHP API Architecture

### Endpoint Structure
- **Static endpoints**: Each endpoint is a standalone PHP file in `public/api/`
- **Shared services**: Business logic in `src/modules/*/` service classes
- **Bootstrap**: `src/bootstrap/endpoint.php` provides helper functions

### Standard Endpoint Pattern
```php
<?php
require_once __DIR__ . '/../../../src/bootstrap/endpoint.php';

['db' => $db, 'redis' => $redis] = api_bootstrap();
$request = api_request();

// Validation
$productId = $request->input('productId');
if (!$productId) {
    api_error('productId is required', 'VALIDATION_ERROR', 400);
}

// Business logic via service
$service = new SomeService($db, $redis);
$result = $service->doSomething($productId);

api_ok($result);
```

### Response Format
All API responses follow this envelope:
```json
{
  "success": true,
  "data": { ... },
  "serverTime": "2026-04-20T12:00:00Z"
}
```

Or on error:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message"
  },
  "serverTime": "2026-04-20T12:00:00Z"
}
```

### Client API Signature Verification
Client endpoints use HMAC signature verification:
1. Client sends: `appKey`, `timestamp`, `nonce`, `signature`
2. Server validates timestamp window (±5 minutes)
3. Server verifies HMAC signature against product's `client_app_key`
4. Server checks nonce for replay protection via `ReplayGuard`

Use `api_verify_client_signature()` helper in client endpoints.

## Native DLL Contract

### Exported Functions
All functions use `__stdcall` convention and return status codes:
- `0` = Success
- `1` = Invalid argument
- `2` = Buffer too small
- `3` = Internal error

### Key Functions
- `KtpInit`: Initialize SDK with product credentials
- `KtpCollectFingerprintJson`: Get machine fingerprint as JSON
- `KtpRequestChallengeJson`: Request server challenge
- `KtpActivateLicenseJson`: Activate license with card key
- `KtpVerifyLicenseJson`: Verify current license status
- `KtpHeartbeatJson`: Send presence heartbeat
- `KtpStartTrialJson`: Start trial session
- `KtpGetTrialStatusJson`: Check trial status
- `KtpRequestRebindJson`: Request device rebinding
- `KtpGetLastError`: Get last error message

### JSON Response Pattern
All `*Json` functions write JSON to a provided buffer. Always allocate sufficient buffer size (2048+ bytes recommended).

## Database Schema

### Core Tables
- `products`: Product registry with client app keys
- `product_security_profiles`: Anti-debug, anti-VM, hook detection settings
- `license_policies`: Max bindings, rebind limits, review requirements
- `trial_policies`: Trial duration, heartbeat intervals
- `licenses`: Card keys and license metadata
- `device_bindings`: Machine fingerprints bound to licenses
- `trial_sessions`: Trial state with expiration tracking
- `risk_rules`: Configurable risk detection rules
- `risk_events`: Detected risk events
- `approval_requests`: Manual review queue
- `audit_logs`: Immutable action history

### Key Relationships
- Products → Security Profiles (1:1)
- Products → License Policies (1:N)
- Products → Trial Policies (1:1)
- Licenses → Device Bindings (1:N based on policy)
- Device Bindings → Trial Sessions (1:1)

## Security Notes

### Secrets Management
- **Never commit** real credentials to `.env` files
- Use `.env.example` as template only
- Required secrets in `.env`:
  - `API_HMAC_KEY`: HMAC signature verification
  - `DATA_ENCRYPTION_KEY`: Fingerprint encryption (32 bytes)
  - `ADMIN_JWT_SECRET`: Admin session tokens
  - `TLS_PINSET_SHA256`: Certificate pinning for client SDK

### Client-Server Security
- All client API calls require HMAC signature
- Timestamp validation prevents replay attacks (±5 min window)
- Nonce tracking via Redis prevents duplicate requests
- Fingerprints stored encrypted in database
- Machine binding enforced server-side

### Admin Security
- JWT-based authentication
- MFA hook points (implementation required)
- Role-based access control (implementation required)
- All admin actions logged to `audit_logs`

## Testing

### PHP
```bash
cd apps/php-api
# Run PHPUnit tests (when added)
vendor/bin/phpunit
```

### TypeScript/React
```bash
cd apps/admin-web
# Run tests (when added)
npm test
```

### C++ DLL
```bash
cd native/win32-core-dll
# Run tests with CTest (when added)
ctest --test-dir build --output-on-failure
```

## Deployment

### Ubuntu Production Setup
1. Install dependencies: Nginx, PHP-FPM 8.1+, MySQL 8.0+, Redis 6.0+
2. Copy `deploy/nginx/keytrialpro.conf` to `/etc/nginx/sites-available/`
3. Copy `deploy/php-fpm/www.conf` to PHP-FPM pool directory
4. Copy `deploy/redis/redis.conf` to Redis config directory
5. Import `deploy/mysql/schema.sql` into MySQL
6. Configure `apps/php-api/.env` with production credentials
7. Point Nginx document root to `apps/php-api/public`
8. Enable Nginx site and restart services

### Admin Console Deployment
```bash
cd apps/admin-web
npm run build
# Deploy dist/ directory to static hosting or serve via Nginx
```

## Code Style

### PHP
- Follow PSR-12 formatting
- Use `declare(strict_types=1);` in all files
- Type hints on all function parameters and returns
- Services use constructor dependency injection
- Immutable DTOs for data transfer

### TypeScript/React
- Explicit types on exported functions and component props
- Use `interface` for object shapes, `type` for unions
- Avoid `any`, use `unknown` for external input
- Immutable updates with spread operator
- No `console.log` in production code

### C++
- Modern C++20 features
- RAII for all resource management
- Use smart pointers, never raw `new`/`delete`
- Follow project's existing naming conventions
- Format with clang-format before committing

## Common Patterns

### Service Layer Pattern (PHP)
```php
class SomeService
{
    public function __construct(
        private Database $db,
        private Redis $redis
    ) {}

    public function doSomething(string $id): array
    {
        // Business logic here
        return ['result' => 'data'];
    }
}
```

### API Client Pattern (C#)
```csharp
var client = new KeyTrialClient(
    productId: "PROD001",
    serverUrl: "https://api.example.com",
    appKey: "app-key-here",
    certPins: "sha256/pin1,sha256/pin2"
);

var fingerprint = client.CollectFingerprint();
var challenge = client.RequestChallenge();
var activation = client.Activate("CARD-KEY-HERE");
```

## Important Notes

- This is an **implementation-grade skeleton** with defined boundaries, contracts, and schemas
- Product-specific business logic should be added on top of this stable base
- The native DLL handles all security-critical operations (fingerprinting, crypto, anti-tamper)
- SDK wrappers are thin layers that call the native DLL and parse JSON responses
- Admin console is a scaffold with placeholder components for metrics visualization
