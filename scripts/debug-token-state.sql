-- Debug Script: Check Google Account Token State
-- Run this after reconnection to see what's actually stored
-- Replace 'YOUR_USER_ID' with your actual user ID from the error logs
SELECT userId,
    provider,
    providerAccountId,
    -- Token Status
    CASE
        WHEN access_token IS NULL THEN '❌ NULL'
        WHEN LENGTH(access_token) < 10 THEN '⚠️  SHORT'
        ELSE '✓ OK'
    END as access_token_status,
    CASE
        WHEN refresh_token IS NULL THEN '❌ NULL'
        WHEN LENGTH(refresh_token) < 10 THEN '⚠️  SHORT'
        ELSE '✓ OK'
    END as refresh_token_status,
    -- Expiry Info
    expires_at as expires_at_unix,
    to_timestamp(expires_at) as expires_at_readable,
    CASE
        WHEN expires_at IS NULL THEN '❌ NULL'
        WHEN to_timestamp(expires_at) < NOW() THEN '❌ EXPIRED'
        WHEN to_timestamp(expires_at) < NOW() + INTERVAL '5 minutes' THEN '⚠️  EXPIRING SOON'
        ELSE '✓ VALID'
    END as expiry_status,
    -- Scope Check
    CASE
        WHEN scope IS NULL THEN '❌ NULL'
        WHEN scope LIKE '%analytics.readonly%' THEN '✓ HAS ANALYTICS'
        ELSE '❌ MISSING ANALYTICS'
    END as scope_status,
    scope,
    -- Timestamps
    updated_at as last_updated,
    EXTRACT(
        EPOCH
        FROM (NOW() - updated_at)
    ) as seconds_since_update
FROM "Account"
WHERE provider = 'google' -- AND userId = 'YOUR_USER_ID'  -- Uncomment and replace with your user ID
ORDER BY updated_at DESC
LIMIT 5;
-- Additional check: Count duplicate accounts
SELECT userId,
    COUNT(*) as google_account_count,
    ARRAY_AGG(providerAccountId) as provider_ids
FROM "Account"
WHERE provider = 'google'
GROUP BY userId
HAVING COUNT(*) > 1;
