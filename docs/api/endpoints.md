# API Endpoints

## Client

- `POST /api/client/challenge.php`
- `POST /api/client/activate.php`
- `POST /api/client/verify.php`
- `POST /api/client/heartbeat.php`
- `POST /api/client/trial_start.php`
- `POST /api/client/trial_status.php`
- `POST /api/client/rebind_request.php`

## Admin

- `POST /api/admin/auth/login.php`
- `POST /api/admin/auth/mfa_verify.php`
- `GET /api/admin/dashboard/platform_overview.php`
- `GET /api/admin/dashboard/product_overview.php?productId=desktop-pro`
- `GET /api/admin/dashboard/trends.php`
- `GET /api/admin/products/list.php`
- `GET /api/admin/licenses/list.php`
- `GET /api/admin/policies/get.php?productId=desktop-pro`
- `POST /api/admin/policies/save.php`
- `GET /api/admin/security-profiles/get.php?productId=desktop-pro`
- `POST /api/admin/security-profiles/save.php`
- `GET /api/admin/risk/events.php`
- `GET /api/admin/risk/rules/list.php?productId=desktop-pro`
- `POST /api/admin/risk/rules/save.php`
- `GET /api/admin/approvals/list.php`
- `POST /api/admin/approvals/decision.php`
- `GET /api/admin/audit/list.php`
