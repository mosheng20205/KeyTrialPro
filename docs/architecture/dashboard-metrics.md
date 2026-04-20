# Dashboard Metrics

## Metric Definitions

- `totalActivatedCount`: distinct `machine_id` values with an active binding
- `onlineCount`: distinct `machine_id` values seen in `presence_sessions` during the configured presence window
- `trialActiveCount`: trials still active according to server-side `expires_at`
- `approvalBacklogCount`: tickets in `pending` or `under_review`

## Trend Tables

- `daily_product_stats`
- `daily_platform_stats`

These tables store daily rollups so the React console does not scan raw event tables for every chart load.

