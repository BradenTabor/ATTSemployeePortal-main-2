# Mandatory Checklists

> Use these checklists before merging changes or when autopilot verification is insufficient

---

## Manual UX Walkthrough Checklist

Complete this checklist by manually testing in the browser.

### General UI

- [ ] Page loads without console errors
- [ ] No layout shifts during load
- [ ] Loading states visible for async operations
- [ ] Error states display user-friendly messages
- [ ] Empty states have helpful content
- [ ] Mobile viewport renders correctly
- [ ] Keyboard navigation works (Tab through elements)
- [ ] Focus states visible on interactive elements

### Forms

- [ ] All required fields marked
- [ ] Validation messages appear inline
- [ ] Submit button shows loading state
- [ ] Success confirmation appears after submit
- [ ] Error preserves form data (no data loss)
- [ ] Tab order is logical

### Navigation

- [ ] Back button works correctly
- [ ] Breadcrumbs accurate (if present)
- [ ] Links go to correct destinations
- [ ] Deep links work when shared

### Accessibility Quick Check

- [ ] Text readable without zooming (mobile)
- [ ] Color contrast sufficient (not relying on color alone)
- [ ] Images have alt text
- [ ] Form inputs have labels

---

## Regression Checklist

Complete after any code change, before committing.

### Build Verification

- [ ] `npm run build` succeeds
- [ ] No new TypeScript errors (`npx tsc --noEmit`)
- [ ] No new lint errors (`npm run lint`)
- [ ] Existing tests pass (`npm test`)

### Functional Verification

- [ ] Changed feature still works as expected
- [ ] Related features not broken
- [ ] Data saves correctly
- [ ] Data loads correctly

### Visual Verification

- [ ] Changed UI looks correct
- [ ] No broken layouts
- [ ] No missing styles
- [ ] Responsive design intact

### Edge Cases

- [ ] Works with empty data
- [ ] Works with large data
- [ ] Works with special characters in input
- [ ] Works offline (if applicable)

---

## Anti-Hallucination Sanity Checklist

Use this to verify agent output is grounded.

### Evidence Check

- [ ] Every finding cites specific file:line
- [ ] Code snippets match actual codebase
- [ ] Observed conditions are verifiable
- [ ] Impact claims are measurable

### Scope Check

- [ ] Recommendations fix observed issues only
- [ ] No new features invented
- [ ] No "nice to have" additions
- [ ] Changes are minimal and targeted

### Consistency Check

- [ ] Recommended patterns match existing codebase
- [ ] No unnecessary abstraction
- [ ] No premature optimization
- [ ] Style matches surrounding code

### Safety Check

- [ ] No security downgrade
- [ ] No auth bypass introduced
- [ ] No data exposure risk
- [ ] No breaking changes to APIs

---

## Pre-Merge Checklist

Complete before merging to main branch.

### Code Quality

- [ ] All TypeScript errors resolved
- [ ] All lint errors resolved
- [ ] No `console.log` statements in production code
- [ ] No commented-out code blocks
- [ ] No TODO comments without issue links

### Testing

- [ ] All existing tests pass
- [ ] New functionality has test coverage (if testable)
- [ ] Manual testing completed (UX Walkthrough above)
- [ ] Edge cases tested (Regression checklist above)

### Documentation

- [ ] Changelog entry created
- [ ] Complex logic has comments
- [ ] Public functions have JSDoc (if applicable)

### Scores

- [ ] UX Clarity score >= 90 or improved
- [ ] Workflow Efficiency score >= 90 or improved
- [ ] Correctness score >= 90 or improved
- [ ] No score regression from baseline

### Security

- [ ] No secrets in code
- [ ] No PII exposure
- [ ] Auth checks in place for protected routes
- [ ] RLS policies cover new tables (if any)

### Rollback Plan

- [ ] Rollback command documented in changelog
- [ ] Rollback tested (can be reverted cleanly)

---

## Security Change Review Checklist

**Required for any SEC-* finding before APPROVE**

### Impact Assessment

- [ ] Understand what the change does
- [ ] Understand what could go wrong
- [ ] Understand blast radius if bug introduced

### Auth Changes

- [ ] Auth flow still works end-to-end
- [ ] Token handling correct
- [ ] Session expiration handled
- [ ] Logout clears all state

### RLS Changes

- [ ] Policy syntax correct
- [ ] Policy tested with intended user
- [ ] Policy tested with unauthorized user
- [ ] No overly permissive access
- [ ] Service role usage documented

### Input Validation

- [ ] All user input validated
- [ ] SQL injection not possible
- [ ] XSS not possible
- [ ] File uploads validated (if applicable)

### Data Protection

- [ ] Sensitive data not logged
- [ ] PII not in URLs
- [ ] HTTPS enforced
- [ ] Cookies secure

---

## Schema Migration Checklist

**Required before any database migration**

### Pre-Migration

- [ ] Backup exists (or can be restored from Supabase dashboard)
- [ ] Migration tested on branch/local first
- [ ] Rollback migration prepared
- [ ] Downtime estimated (if any)

### Migration Content

- [ ] SQL syntax correct
- [ ] Data types appropriate
- [ ] Constraints make sense
- [ ] Indexes added for query patterns
- [ ] RLS policies included (if new table)

### Post-Migration

- [ ] Migration ran successfully
- [ ] Data integrity verified
- [ ] Application still works
- [ ] Performance acceptable
- [ ] RLS policies active

---

## Checklist Usage Log

Track which checklists were completed and when.

| Date | Checklist | Completed By | Notes |
|------|-----------|--------------|-------|
| <!-- DATE --> | <!-- CHECKLIST --> | <!-- NAME --> | <!-- NOTES --> |

---

## Creating Custom Checklists

For project-specific checklists, add them below with this template:

```markdown
## [Checklist Name]

**When to use**: [description]

### Section 1

- [ ] Item 1
- [ ] Item 2

### Section 2

- [ ] Item 1
- [ ] Item 2
```
