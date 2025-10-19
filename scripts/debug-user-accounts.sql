-- Debug Script: Check for User/Account Mismatches
-- This checks if there are multiple users or accounts causing issues
-- Check all users and their Google accounts
SELECT u.id as user_id,
    u.email,
    u.name,
    COUNT(a.provider) as google_account_count,
    ARRAY_AGG(a.providerAccountId) as provider_account_ids,
    MAX(a.expires_at) as latest_token_expiry,
    MAX(to_timestamp(a.expires_at)) as latest_expiry_readable
FROM "User" u
    LEFT JOIN "Account" a ON u.id = a.userId
    AND a.provider = 'google'
GROUP BY u.id,
    u.email,
    u.name
ORDER BY u.email;
-- Check for orphaned Google accounts (accounts without users)
SELECT a.userId,
    a.provider,
    a.providerAccountId,
    a.expires_at,
    to_timestamp(a.expires_at) as expires_readable,
    CASE
        WHEN u.id IS NULL THEN '❌ NO USER FOUND'
        ELSE '✓ User exists'
    END as user_status
FROM "Account" a
    LEFT JOIN "User" u ON a.userId = u.id
WHERE a.provider = 'google'
ORDER BY a.expires_at DESC;
-- Check for duplicate providerAccountIds (same Google account linked to multiple users)
SELECT providerAccountId,
    COUNT(DISTINCT userId) as user_count,
    ARRAY_AGG(DISTINCT userId) as user_ids,
    ARRAY_AGG(
        DISTINCT (
            SELECT email
            FROM "User"
            WHERE id = "Account".userId
        )
    ) as emails
FROM "Account"
WHERE provider = 'google'
GROUP BY providerAccountId
HAVING COUNT(DISTINCT userId) > 1;
