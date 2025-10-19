-- Cleanup Script: Remove Duplicate Google Accounts
-- Run this to fix any orphaned or duplicate accounts
-- First, let's see what we have:
SELECT a.userId,
    a.provider,
    a.providerAccountId,
    a.expires_at,
    to_timestamp(a.expires_at) as expires_readable,
    a.access_token IS NOT NULL as has_access_token,
    a.refresh_token IS NOT NULL as has_refresh_token,
    u.email,
    u.name,
    CASE
        WHEN u.id IS NULL THEN '❌ ORPHANED (no user)'
        WHEN a.userId = 'a643c668-ca90-433a-909a-78d974c3b467' THEN '✓ YOUR CURRENT USER'
        ELSE '⚠️  OTHER USER'
    END as account_status
FROM "Account" a
    LEFT JOIN "User" u ON a.userId = u.id
WHERE a.provider = 'google'
ORDER BY a.expires_at DESC;
-- If you see orphaned accounts or duplicates, run this to delete them:
-- (Uncomment the lines below after reviewing the above results)
-- Delete orphaned accounts (accounts without a user):
-- DELETE FROM "Account"
-- WHERE provider = 'google'
-- AND userId NOT IN (SELECT id FROM "User");
-- Delete old accounts that aren't for your current user:
-- DELETE FROM "Account"
-- WHERE provider = 'google'
-- AND providerAccountId = '109134659731296468570'
-- AND userId != 'a643c668-ca90-433a-909a-78d974c3b467';
