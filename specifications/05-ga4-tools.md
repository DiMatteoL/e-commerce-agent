### Spec 05 – GA4 LangChain Tools

- **Status**: Proposed
- **Owner**: AI/Backend
- **Last Updated**: 2025-08-14
- **Scope**: Tools for LLM

### Summary
Provide GA4 tools callable by the LLM for property discovery and reporting (standard and realtime), built with `@langchain/core/tools` and `zod` schemas.

### Tools
- File: `src/features/ai-chat/tools/google-analytics.ts`
  - `ga_list_properties`
    - Input: `{ pageSize?: number }`
    - Calls Admin API `analyticsadmin.properties.list`.
    - Output: JSON string `{ properties: [{ propertyId, displayName, parent, currencyCode, timeZone }] }`.
  - `ga_run_report`
    - Input: `{ propertyId: string, dimensions?: string[], metrics: string[], dateRange: { startDate: string; endDate: string }, limit?: number, orderBys?: { metric: string; desc?: boolean }[] }`
    - Calls Data API `properties.runReport`.
    - Output: JSON string `{ headers: string[], rows: string[][], rowCount: number }`.
  - `ga_realtime_report`
    - Input: `{ propertyId: string, dimensions?: string[], metrics: string[], limit?: number }`
    - Calls Data API `properties.runRealtimeReport`.
    - Output: JSON string `{ headers: string[], rows: string[][], rowCount: number }`.

### Implementation Notes
- Each tool acquires clients from Spec 04 helpers.
- Validate inputs via `zod`. Return strings only (LangChain contract).
- On missing OAuth, rethrow the typed error from Spec 06 unchanged.
- Keep descriptions precise so the LLM uses tools correctly.

### Acceptance Criteria
- Tools are registered and can be invoked by the LLM.
- Inputs are validated; meaningful error messages for invalid inputs.
- Successful calls return normalized JSON strings consistent with the schemas above.

### Tests
- **Schema validation**: Passing invalid input (e.g., non-string `propertyId`) raises a validation error before API call.
- **List properties**: With a stubbed Admin client, returns a normalized list.
- **Run report**: With a stubbed Data client, maps GA4 rows/headers into the normalized shape.
- **Realtime report**: With a stubbed Data client, returns rows; respects `limit`.
- **Auth missing**: If helper throws `NEEDS_GOOGLE_OAUTH`, the same error bubbles up for the agent loop to handle.
