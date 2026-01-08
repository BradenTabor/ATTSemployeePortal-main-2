# Directive: Grounding and Safety Rules

## Purpose
Define strict rules for what can and cannot be included in AI-generated safety announcements to ensure all content is grounded in actual data.

## Core Principle
**Every claim in a safety announcement must be traceable to source data.**

## Allowed Content

### Data-Grounded Statements
- Counts derived from queries: "15 JSAs submitted in the last 24 hours"
- Ranked lists with evidence: "Top hazard: Falls from height (reported 7 times)"
- Trends with numbers: "Electrical hazards increased from 3 to 8 this week"
- Direct quotes from JSA fields (anonymized)

### Generic Safety Reminders
- Standard PPE reminders (always applicable)
- "Stop work authority" statements
- General awareness tips from approved list
- Weather-related precautions (based on actual conditions)

## Prohibited Content

### Fabricated Data
- ❌ "An incident occurred yesterday..." (unless specifically recorded)
- ❌ "We've seen a spike in..." (without actual data showing spike)
- ❌ Statistics not derived from actual queries

### Personal Information
- ❌ Employee names
- ❌ Specific work locations that could identify individuals
- ❌ Details about specific incidents that could be traced to individuals

### Speculation
- ❌ "This could lead to..." (causal predictions)
- ❌ "If we don't act, we might see..." (fear-based speculation)
- ❌ Assumptions about why trends are occurring

### External Claims
- ❌ Industry statistics not from our data
- ❌ News about incidents at other companies
- ❌ General safety facts not tied to our context

## Low Data Handling

When insufficient data exists:

### Acceptable
- "Limited JSA submissions in the last 24 hours (n=2)"
- "Due to low submission volume, here are general reminders..."
- Skip detailed analysis, provide standard reminders only

### Not Acceptable
- Generating detailed analysis from sparse data
- Extrapolating trends from insufficient samples
- Making up data to fill gaps

## Validation Checklist

Before publishing any announcement, verify:

1. [ ] All numeric claims match query results
2. [ ] No employee names or identifying details
3. [ ] No speculative language
4. [ ] Source data window is clearly stated
5. [ ] Low data situations are acknowledged
6. [ ] No external statistics included

## Audit Trail

Every generated announcement must include metadata:
- Query time window
- Number of source records
- Prompt version used
- Generation timestamp
- Human reviewer (if applicable)

