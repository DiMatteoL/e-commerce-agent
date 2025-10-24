# GA4 Data Accuracy Issue: Root Cause Analysis & Recommendations

## Executive Summary

The bot is returning incorrect data because of **inappropriate dimension injection** when querying user-scoped metrics like `activeUsers`. The core issue is in the fallback logic that incorrectly assumes `itemName` is a safe default dimension for all metrics.

## The Specific Problem

### What the Bot Said (Incorrect)
- "14 active users for 'Genouillère Incrediwear - Gris / M'"
- "`activeUsers` is Item-Scoped, Not General!"
- Got 172 when expecting 200

### What Actually Happened
The tool added `itemName` dimension to an `activeUsers` query, causing GA4 to return **per-product active users** instead of **total property-level active users**.

### Why This Is Wrong
`activeUsers` is a **USER-SCOPED** metric, not item-scoped. It should work without any dimensions or with session/user-scoped dimensions (like `date`, `country`, `deviceCategory`, etc.), but NOT with item-scoped dimensions.

---

## Root Causes in the Code

### 1. **Inappropriate Fallback Dimension** (Primary Issue)
**Location:** `src/features/ai-chat/tools/ga4/core.ts` line 213

```typescript
const dimSan = sanitizeFields(dimensions, availableDims, ["itemName"]);
```

**Problem:** When no valid dimensions are provided or they all fail validation, the code falls back to `["itemName"]`. This is applied **regardless of metric type**.

**Impact:**
- User-scoped metrics (`activeUsers`, `totalUsers`, `newUsers`) get forced into item-level reporting
- Session-scoped metrics (`sessions`, `engagedSessions`) get incorrectly scoped
- Results in fragmented data that must be manually aggregated

**Fix Needed:** Remove the `["itemName"]` fallback from general dimension sanitization. Only apply it when querying item-scoped metrics.

---

### 2. **Incomplete Metric Scope Definition**
**Location:** `src/features/ai-chat/tools/ga4/core.ts` lines 160-164

```typescript
export const ITEM_SCOPED_METRICS = new Set<string>([
  "itemRevenue",
  "itemsViewed",
  "itemPurchaseQuantity",
]);
```

**Problem:** This list is incomplete. GA4 has many more item-scoped metrics:
- `itemsPurchased`
- `itemsClickedInList`
- `itemsClickedInPromotion`
- `itemListClickEvents`
- `itemListViewEvents`
- `itemPromotionClickEvents`
- `itemPromotionViewEvents`
- `itemRefundAmount`
- `itemsAddedToCart`
- `itemsCheckedOut`
- `itemsViewed` (already included)

**Impact:** Other item-scoped metrics won't get the proper dimension injection logic.

---

### 3. **Missing User-Scoped and Session-Scoped Metric Definitions**

**Problem:** The code doesn't explicitly define which metrics are user-scoped or session-scoped, making it impossible to validate dimension compatibility.

**Common GA4 Metric Scopes:**

#### User-Scoped Metrics:
- `activeUsers`
- `totalUsers`
- `newUsers`
- `returningUsers`
- `userEngagementDuration`

#### Session-Scoped Metrics:
- `sessions`
- `engagedSessions`
- `bounceRate`
- `sessionConversionRate`
- `averageSessionDuration`

#### Event-Scoped Metrics:
- `eventCount`
- `conversions`
- `totalRevenue` (event-scoped in GA4)
- `purchases`

**Impact:** The bot can't intelligently choose compatible dimensions for metrics.

---

### 4. **Aggressive Fallback Logic Creating Bad Queries**
**Location:** `src/features/ai-chat/tools/ga4/core.ts` lines 307-340

```typescript
catch {
  // Step 1: keep the same metrics, drop dimensions
  warnings.push(
    "FALLBACK_APPLIED due to API error. Retrying with dimensions=[] and same metrics.",
  );
```

**Problem:** While this fallback is good for resilience, it's **masking the real issue** - that the initial query was malformed due to incompatible dimensions.

**Impact:**
- The bot makes 2-3 API calls instead of 1 (slower, more expensive)
- The warning "FALLBACK_APPLIED" is shown to users, eroding confidence
- The bot doesn't learn from the mistake because it just retries

---

### 5. **Insufficient Bot Education About GA4 Scoping**

**Location:** `src/features/ai-chat/prompts/system.ts`

**Problem:** The system prompt doesn't teach the bot about:
- GA4's metric/dimension scope compatibility rules
- Which metrics require which types of dimensions
- How to avoid incompatible metric/dimension combinations

**Impact:** The bot doesn't understand **why** certain combinations fail, so it can't avoid them proactively.

---

## Dimension/Metric Compatibility Rules (GA4 API)

### Core Rule
**You cannot mix dimensions and metrics from incompatible scopes in a single query.**

### Compatibility Matrix

| Metric Scope | Compatible Dimension Scopes | Examples |
|--------------|----------------------------|----------|
| **User** | User, Date, Geography, Technology | `activeUsers` + `date`, `country`, `deviceCategory` ✅ |
| **User** | ❌ Item, Event-specific | `activeUsers` + `itemName` ❌ |
| **Session** | Session, User, Date, Geography | `sessions` + `sessionDefaultChannelGroup` ✅ |
| **Event** | Event, Session, User, Date | `eventCount` + `eventName` ✅ |
| **Item** | **Requires** Item dimension | `itemRevenue` + `itemName` ✅ |
| **Item** | Item + Session/User/Date OK | `itemRevenue` + `itemName` + `date` ✅ |
| **Item** | ❌ Without item dimension | `itemRevenue` alone ❌ |

### Key Insight for Your Case
```
activeUsers + itemName = ❌ INCOMPATIBLE
activeUsers + date = ✅ COMPATIBLE
activeUsers + (no dimensions) = ✅ COMPATIBLE (total)
```

---

## Recommended Fixes

### Priority 1: Fix the Fallback Dimension Logic (CRITICAL)

**File:** `src/features/ai-chat/tools/ga4/core.ts`

**Current Code (line 213):**
```typescript
const dimSan = sanitizeFields(dimensions, availableDims, ["itemName"]);
```

**Fixed Code:**
```typescript
// Don't default to itemName for all queries - only for item-scoped metrics
const dimSan = sanitizeFields(dimensions, availableDims);
```

**And update the item-scoped logic (around line 236):**
```typescript
if (hasItemMetric && !hasItemDim) {
  const inject = pickFirstAvailableItemDimension(availableDims);
  if (inject) {
    keptDimensions = [inject, ...keptDimensions];
    warnings.push(
      `Added '${inject}' dimension to align with item-scoped metrics.`,
    );
  } else {
    // Fallback: swap to property-level metrics if possible
    // ... existing code ...
  }
}
```

---

### Priority 2: Expand Scope Definitions (HIGH)

**File:** `src/features/ai-chat/tools/ga4/core.ts`

**Add comprehensive scope definitions:**
```typescript
export const ITEM_SCOPED_METRICS = new Set<string>([
  "itemRevenue",
  "itemsViewed",
  "itemPurchaseQuantity",
  "itemsPurchased",
  "itemsAddedToCart",
  "itemsCheckedOut",
  "itemsClickedInList",
  "itemsClickedInPromotion",
  "itemListClickEvents",
  "itemListViewEvents",
  "itemPromotionClickEvents",
  "itemPromotionViewEvents",
  "itemRefundAmount",
]);

export const USER_SCOPED_METRICS = new Set<string>([
  "activeUsers",
  "totalUsers",
  "newUsers",
  "returningUsers",
  "userEngagementDuration",
]);

export const SESSION_SCOPED_METRICS = new Set<string>([
  "sessions",
  "engagedSessions",
  "bounceRate",
  "sessionConversionRate",
  "averageSessionDuration",
  "sessionsPerUser",
]);

// User-compatible dimensions (NOT item-scoped)
export const USER_COMPATIBLE_DIMENSIONS = new Set<string>([
  "date",
  "year",
  "month",
  "week",
  "day",
  "country",
  "city",
  "region",
  "deviceCategory",
  "operatingSystem",
  "browser",
  "sessionDefaultChannelGroup",
  "sessionSource",
  "sessionMedium",
  "sessionCampaign",
  "userAgeBracket",
  "userGender",
  "newVsReturning",
]);
```

---

### Priority 3: Add Validation Logic (HIGH)

**File:** `src/features/ai-chat/tools/ga4/core.ts`

**Add validation before building the request:**
```typescript
function validateMetricDimensionCompatibility(
  metrics: string[],
  dimensions: string[],
): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  const hasUserMetric = metrics.some((m) => USER_SCOPED_METRICS.has(m));
  const hasItemMetric = metrics.some((m) => ITEM_SCOPED_METRICS.has(m));
  const hasItemDim = dimensions.some((d) => ITEM_SCOPED_DIMENSIONS.has(d));

  // User metrics + item dimensions = INCOMPATIBLE
  if (hasUserMetric && hasItemDim) {
    warnings.push(
      "WARNING: User-scoped metrics (like activeUsers, totalUsers) are incompatible with item-scoped dimensions (like itemName). This will cause incorrect data. Removing item dimensions."
    );
    return { valid: false, warnings };
  }

  // Item metrics require at least one item dimension
  if (hasItemMetric && !hasItemDim) {
    warnings.push(
      "INFO: Item-scoped metrics require an item dimension (like itemName, itemId). Adding itemName."
    );
    return { valid: false, warnings };
  }

  return { valid: true, warnings };
}
```

---

### Priority 4: Educate the Bot (MEDIUM)

**File:** `src/features/ai-chat/prompts/system.ts`

**Add to the system prompt:**
```markdown
# GA4 METRIC & DIMENSION SCOPING (CRITICAL)

**Core Rule:** You CANNOT mix incompatible metric and dimension scopes in GA4 queries.

**Metric Scopes:**
1. **User-Scoped** (activeUsers, totalUsers, newUsers, returningUsers)
   - Use with: date, country, deviceCategory, sessionSource, etc.
   - ❌ NEVER use with: itemName, itemId, itemBrand (item dimensions)
   - Example: "activeUsers by date" ✅ | "activeUsers by itemName" ❌

2. **Item-Scoped** (itemRevenue, itemsViewed, itemsAddedToCart)
   - MUST include at least one item dimension (itemName, itemId, itemBrand)
   - Can also add date, country, etc.
   - Example: "itemRevenue by itemName" ✅ | "itemRevenue alone" ❌

3. **Session-Scoped** (sessions, engagedSessions, bounceRate)
   - Use with: sessionDefaultChannelGroup, date, country, etc.
   - Can combine with user dimensions
   - ❌ NEVER use with: itemName (unless also querying item metrics)

4. **Event-Scoped** (eventCount, conversions, totalRevenue, purchases)
   - Most flexible - works with most dimension combinations
   - Can work with event, session, or user dimensions

**Common Mistakes to Avoid:**
❌ "Give me activeUsers by product" → This will break down users by product VIEWED, not total users
✅ "Give me activeUsers total" or "activeUsers by date"
✅ "Give me itemRevenue by product (itemName)" for product-level revenue

**When User Asks for Product-Level Data:**
- If they want revenue: use `itemRevenue` + `itemName` ✅
- If they want users: explain you can show "users who viewed each product" but NOT "active users by product" (that's not how user metrics work)

**Tool Selection:**
- `ga_general_report`: For user/session metrics (activeUsers, sessions, totalRevenue)
- `ga_item_report`: For product/item metrics (itemRevenue by itemName)
- `ga_run_report`: Advanced queries, but follow scoping rules!

**Before Every Query, Ask Yourself:**
1. What scope is my primary metric? (user/session/item/event)
2. Are my dimensions compatible with that scope?
3. If mixing scopes, is this a valid GA4 combination?
```

---

### Priority 5: Improve Tool Descriptions (MEDIUM)

**File:** `src/features/ai-chat/tools/ga4/general-report.ts`

**Current:**
```typescript
description: "General (non-item) GA4 report. Defaults to totalRevenue with no dimensions. Safe with session/user/event dimensions like date, country, sessionDefaultChannelGroup.",
```

**Improved:**
```typescript
description: `General (non-item) GA4 report for user and session metrics.

SAFE METRICS: activeUsers, totalUsers, sessions, engagedSessions, totalRevenue, purchases, conversions
SAFE DIMENSIONS: date, country, city, deviceCategory, sessionDefaultChannelGroup, sessionSource, sessionMedium, browser

❌ DO NOT USE with item dimensions (itemName, itemId, itemBrand) - use ga_item_report instead
❌ DO NOT query item-scoped metrics (itemRevenue, itemsViewed) - use ga_item_report instead

Use this for property-level or session/user-level analysis.`,
```

---

### Priority 6: Add Explicit Property-Level Tools (LOW)

Create specific tools for common property-level queries that are foolproof:

**File:** `src/features/ai-chat/tools/ga4/curated.ts`

**Add:**
```typescript
export const gaActiveUsersTool = tool(
  async ({ dateRange }) => {
    return runGaReportCore({
      dimensions: [], // NO dimensions = total property level
      metrics: ["activeUsers"],
      dateRange,
    });
  },
  {
    name: "ga_active_users",
    description: "Get total active users for the property (no dimensions). Returns property-level activeUsers count.",
    schema: z.object({
      dateRange: dateRangeSchema.optional(),
    }),
  },
);

export const gaActiveUsersTrendTool = tool(
  async ({ dateRange }) => {
    return runGaReportCore({
      dimensions: ["date"], // by date for trending
      metrics: ["activeUsers"],
      dateRange,
    });
  },
  {
    name: "ga_active_users_trend",
    description: "Get active users by date (time series). Use for trending activeUsers over time.",
    schema: z.object({
      dateRange: dateRangeSchema.optional(),
    }),
  },
);

export const gaUsersByDeviceTool = tool(
  async ({ dateRange }) => {
    return runGaReportCore({
      dimensions: ["deviceCategory"],
      metrics: ["activeUsers", "totalUsers"],
      dateRange,
    });
  },
  {
    name: "ga_users_by_device",
    description: "Get users broken down by device type (mobile/desktop/tablet). Compatible with user metrics.",
    schema: z.object({
      dateRange: dateRangeSchema.optional(),
    }),
  },
);
```

Then add these to `registry.ts`.

---

## Testing Plan

### Test Case 1: User-Scoped Metrics
```
Query: "How many active users do we have this week?"
Expected: ga_general_report with dimensions=[], metrics=["activeUsers"]
Result: Single number (e.g., 200 active users)
❌ Should NOT add itemName dimension
```

### Test Case 2: User Metrics with Compatible Dimension
```
Query: "Active users by device type"
Expected: ga_general_report with dimensions=["deviceCategory"], metrics=["activeUsers"]
Result: Breakdown by mobile/desktop/tablet
✅ Valid query
```

### Test Case 3: Item-Scoped Metrics
```
Query: "Top products by revenue"
Expected: ga_item_report with dimensions=["itemName"], metrics=["itemRevenue"]
Result: Product list with revenue
✅ Valid query
```

### Test Case 4: Mixed Query (Should Be Split)
```
Query: "Show me total users and top products"
Expected: Bot should explain it needs TWO queries:
  1. ga_general_report for activeUsers (no dimensions)
  2. ga_item_report for itemRevenue by itemName
❌ Should NOT try to combine in one query
```

---

## Expected Improvements

### Data Accuracy
- ✅ `activeUsers` returns total property users, not per-product
- ✅ No more incorrect item-level breakdowns of user metrics
- ✅ Fewer "FALLBACK_APPLIED" warnings

### Performance
- ⚡ 66% reduction in API calls (no fallback retries needed)
- ⚡ Faster response times

### Bot Intelligence
- 🧠 Bot understands which tool to use for which metric type
- 🧠 Bot can explain why certain combinations don't work
- 🧠 Bot proactively chooses correct dimensions for metrics

### User Experience
- 😊 Correct data on first try
- 😊 Clear explanations when queries need to be split
- 😊 No confusing technical warnings

---

## Additional Recommendations

### 1. Add Logging for Scope Violations
Track when the bot tries incompatible combinations to identify learning opportunities:
```typescript
if (hasUserMetric && hasItemDim) {
  console.warn('[GA4] Scope violation prevented:', {
    metrics,
    dimensions,
    reason: 'user-metric-with-item-dimension'
  });
}
```

### 2. Create a GA4 Dimension/Metric Reference
Build a lookup table the bot can query:
```typescript
export const GA4_METRIC_INFO: Record<string, {
  scope: 'user' | 'session' | 'event' | 'item';
  compatibleDimensions: string[];
  description: string;
}> = {
  activeUsers: {
    scope: 'user',
    compatibleDimensions: ['date', 'country', 'deviceCategory', 'sessionSource'],
    description: 'Number of distinct users who had at least one session'
  },
  // ... more metrics
};
```

### 3. Implement Query Planning
Before executing, have the bot "plan" the query and validate it:
```typescript
async function planQuery(intent: string, metrics: string[], dimensions: string[]) {
  // 1. Detect metric scopes
  // 2. Validate dimension compatibility
  // 3. Suggest tool selection
  // 4. Warn about potential issues
  // 5. Return execution plan
}
```

### 4. Add Unit Tests for Scope Logic
```typescript
describe('Metric-Dimension Compatibility', () => {
  it('should reject activeUsers + itemName', () => {
    const result = validateCompatibility(['activeUsers'], ['itemName']);
    expect(result.valid).toBe(false);
  });

  it('should accept activeUsers + date', () => {
    const result = validateCompatibility(['activeUsers'], ['date']);
    expect(result.valid).toBe(true);
  });
});
```

---

## Conclusion

The root cause is **architectural** - the tool doesn't properly model GA4's metric/dimension scoping rules. The quick fix (Priority 1) will solve the immediate issue, but the comprehensive solution requires teaching the bot about GA4's data model through explicit scope definitions and validation.

**Implementation Order:**
1. Fix fallback dimension logic (1 hour) → Immediate impact
2. Add scope definitions (2 hours) → Prevent future issues
3. Enhance bot education (1 hour) → Improve bot intelligence
4. Add validation (3 hours) → Catch errors early
5. Create curated tools (2 hours) → Better UX for common queries

**Total Effort:** ~9 hours for complete solution
**Quick Win:** 1 hour for 80% improvement
