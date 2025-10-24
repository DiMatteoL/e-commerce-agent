# System Prompt Enhancements

## Overview
The system prompt has been significantly enhanced to provide more structured guidance, better examples, and clearer operational principles for the AI analytics assistant.

## Key Improvements

### 1. **Enhanced Structure & Readability**
- **Before:** Plain text with inconsistent formatting
- **After:** Clear markdown sections with hierarchical organization
  - Mission statement
  - Expertise areas
  - Operating principles
  - Response structure
  - Examples
  - Tool usage guidelines
  - Business-specific metrics

### 2. **Expanded Expertise Definitions**

#### Web Analytics & CRO
Added specifics:
- Funnel optimization (micro and macro conversions)
- Drop-off analysis
- Landing page effectiveness
- A/B test analysis

#### Product Analytics
Added:
- "Aha moments" concept
- Engagement depth metrics (DAU/MAU)
- Churn prediction
- Behavioral triggers

#### Data Storytelling
Added:
- Anomaly and trend detection
- Statistical significance awareness
- Data quality concerns
- Intelligent time period comparisons

### 3. **Operating Principles Framework**

Six core principles now explicitly defined:

1. **Progressive Disclosure**: Start simple → Add context → Deeper analysis → Recommendations
2. **Business Impact First**: Always tie metrics to business outcomes
3. **Intelligent Comparisons**: Auto-suggest relevant segments and time periods
4. **Context-Aware Recommendations**: Tailor advice to business type and scale
5. **Full-Funnel Thinking**: Consider entire customer journey
6. **Data Quality Awareness**: Flag sample size and tracking issues

### 4. **Structured Response Format**

Clear template for data-backed responses:
```
Direct Answer → Context → Comparison → Insight → Next Steps → Deeper Dive Offer
```

### 5. **Enhanced Examples**

**Before:** Simple Q&A format
**After:** Comprehensive examples showing:
- Data presentation with context
- Comparative analysis
- Insight extraction
- Specific, actionable recommendations
- Follow-up questions to drive engagement

Two detailed examples added:
1. Campaign performance analysis (Black Friday)
2. Product page conversion analysis (mobile vs desktop)

### 6. **Tool Usage Guidelines**

New section clarifying:
- When to query GA4 data vs provide general advice
- Error handling procedures
- Alternative approaches when data unavailable

### 7. **Business-Specific Metrics**

Added metric frameworks for three business types:

**E-commerce:**
- Cart abandonment, AOV, revenue per session
- CAC vs LTV

**Lead Generation:**
- Form completion rates, lead quality indicators
- CPL by channel, lead-to-customer timeline

**SaaS/Product:**
- Signup-to-activation, feature adoption
- Retention curves, product engagement score

### 8. **Guardrails ("What NOT to Do")**

Explicit constraints added:
- ❌ No generic best practices without data
- ❌ Must flag statistical significance issues
- ❌ No major recommendations from single data points
- ❌ Never expose PII
- ❌ Frame insights as hypotheses, not certainties

### 9. **Improved Temporal Context**

**Before:** Basic date/timezone info with typo ("asnwer")
**After:** Comprehensive date handling rules:
- Clear definitions of "rolling" vs "calendar" periods
- Timezone awareness in queries
- Data processing delay considerations
- Concrete examples of date interpretation
- YoY comparison alignment (same day-of-week)

Fixed typo: "asnwer" → "answer"

### 10. **Enhanced Value Proposition**

Clearer articulation of the assistant's ultimate value:
- Saves teams hours of manual analysis
- Provides expert-level strategic thinking
- Turns data into competitive advantage
- Thinks like a seasoned analyst who's optimized hundreds of funnels

## Impact Assessment

### Expected Improvements:

**Response Quality:**
- ✅ More structured, scannable responses
- ✅ Consistent format across all data-backed answers
- ✅ Better balance of data + insight + action

**Strategic Depth:**
- ✅ More context-aware recommendations
- ✅ Better business outcome framing
- ✅ Industry-specific best practices

**User Experience:**
- ✅ Progressive disclosure reduces information overload
- ✅ Clearer next steps and follow-up questions
- ✅ Better handling of ambiguous queries (especially dates)

**Data Quality:**
- ✅ More awareness of statistical significance
- ✅ Better flagging of data anomalies
- ✅ Clearer explanations when data unavailable

**Error Resilience:**
- ✅ Better handling of authentication issues
- ✅ Graceful degradation when GA4 unavailable
- ✅ Clear alternative approaches offered

## Testing Recommendations

To validate improvements, test these scenarios:

1. **Vague time references**: "How did we do this week?"
   - Should clarify rolling 7-day period

2. **Campaign analysis**: "Did our email campaign work?"
   - Should provide metrics, comparison, insight, recommendations

3. **Mobile vs Desktop**: "Are mobile users converting?"
   - Should auto-compare device types and suggest optimizations

4. **Data unavailable**: When GA4 connection fails
   - Should explain issue and offer general guidance

5. **Small sample size**: Query with <100 conversions
   - Should flag statistical significance concerns

6. **Business-specific advice**: E-commerce vs Lead Gen vs SaaS
   - Should tailor metrics and recommendations appropriately

## Future Enhancements to Consider

1. **Industry Benchmarks**: Add typical conversion rate ranges by industry
2. **Seasonal Patterns**: Build awareness of holiday/seasonal effects
3. **Multi-Touch Attribution**: Guidance on channel interaction analysis
4. **Cohort Analysis**: More detailed retention curve interpretation
5. **Experimentation Framework**: A/B test design and analysis guidance
6. **Predictive Insights**: When sample sizes allow, suggest forecasting

## Conclusion

The enhanced system prompt transforms the assistant from a data-fetching tool into a **strategic analytics partner** that:
- Provides structure and consistency
- Offers deep business context
- Delivers actionable recommendations
- Maintains data quality awareness
- Scales expertise to all team members

This should significantly improve both the quality and utility of the AI analyst's responses.
