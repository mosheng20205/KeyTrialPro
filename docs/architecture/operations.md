# Operations

## Daily Stats Aggregation

The dashboard trend widgets read from `daily_product_stats` and `daily_platform_stats`. Run the aggregation script on a schedule:

```bash
php /srv/keytrialpro/apps/php-api/scripts/aggregate_daily_stats.php
```

To backfill a specific UTC day:

```bash
php /srv/keytrialpro/apps/php-api/scripts/aggregate_daily_stats.php 2026-04-18
```

## Suggested Cron

```cron
5 0 * * * php /srv/keytrialpro/apps/php-api/scripts/aggregate_daily_stats.php >> /var/log/keytrialpro-stats.log 2>&1
```

## Runtime Notes

- `heartbeat.php` refreshes online presence.
- `trial_status.php` and `verify.php` transition expired trials from `active` to `expired`.
- `rebind_request.php` creates approval tickets for manual review.
