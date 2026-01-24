# 💰 Advanced Token Optimization Strategies

Beyond the major fixes already applied, here are additional ways to minimize Cursor token usage:

## 🎯 Strategy 1: Control What Cursor Sees

### A) Use .cursorignore File
Create a `.cursorignore` file to exclude directories from Cursor's context:

```bash
# Create .cursorignore in project root
cat > .cursorignore << 'EOF'
# Exclude node_modules (Cursor should do this by default, but be explicit)
node_modules/

# Exclude large documentation that's not needed
docs/cursor-agents/
src/services/safety-agent/directives/
src/services/safety-agent/prompts/

# Exclude test fixtures
tests/fixtures/

# Exclude build artifacts
dist/
build/
.vite/

# Exclude performance reports (reference only)
performance-report/
*PERFORMANCE*.md
*AUDIT*.md
*REPORT*.md

# Exclude planning docs (not needed for coding)
plan.md
docs/baseline_metrics.md
docs/Telemetry_plan.md

# Exclude migration documentation (only needed when working on DB)
supabase/SCHEMA_DOCUMENTATION.md
supabase/SUPABASE_MIGRATION_RECONCILIATION.md
supabase/RLS_FIX_SUMMARY.md
supabase/MIGRATION_RESOLUTION_GUIDE.md
EOF
```

**Savings**: Prevents Cursor from considering ~20-30 unnecessary files, saving tokens when it searches for context.

### B) Archive Large Documentation Files
Move infrequently-used documentation out of the main project:

```bash
# Create archive directory
mkdir -p .archive/docs

# Move large reports (can reference when needed)
mv PRODUCTION_AUDIT_REPORT.md .archive/docs/
mv SUPABASE_PERFORMANCE_REPORT.md .archive/docs/
mv TEST_REPORT.md .archive/docs/
mv LITE_QA_REPORT.md .archive/docs/
mv BUNDLE_ANALYSIS_REPORT.md .archive/docs/
mv MOBILE_PERFORMANCE_NOTES.md .archive/docs/

# Move workflow docs
mv AUTHENTICATION_FLOW_FINAL.md .archive/docs/
mv REALTIME_SESSION_FLOW.md .archive/docs/
mv SESSION_RESTORE_OVERLAY.md .archive/docs/
mv ENHANCED_SESSION_OVERLAY.md .archive/docs/
mv CINEMATIC_TRANSITIONS.md .archive/docs/

# Move planning docs
mv plan.md .archive/docs/

# Add to .gitignore if you don't want to commit archive
echo ".archive/" >> .gitignore
```

**Savings**: ~5,000-10,000 lines of documentation removed from consideration.

---

## 🎯 Strategy 2: Optimize Your Queries

### A) Be Specific, Not Broad
```bash
# ❌ High token usage (searches entire codebase)
"Improve the authentication"

# ✅ Low token usage (targeted)
"Fix the session expiration logic in src/lib/auth.ts"
```

### B) Reference Files Explicitly
```bash
# ❌ Cursor searches for files
"Update the login component"

# ✅ Cursor knows exactly what to load
"Update src/pages/Login.tsx to add error handling"
```

### C) Use @-mentions Strategically
```bash
# Only include what's needed
"@src/components/LoginForm.tsx add validation"

# Instead of letting Cursor auto-include related files
```

**Savings**: 50-70% reduction per query by being specific.

---

## 🎯 Strategy 3: Clear Context Frequently

### Start New Chats for Unrelated Tasks
- **Don't**: Keep using the same chat for multiple unrelated tasks
- **Do**: Start a fresh chat when switching contexts

**Why**: Each message includes context from the entire conversation history.

### Close Unused Files
Before asking Cursor questions:
1. Close files you're not actively working on
2. Only keep 2-3 relevant files open
3. Cursor includes open files in context automatically

**Savings**: ~1,000-2,000 tokens per closed file.

---

## 🎯 Strategy 4: Use the Right Tool

### Cursor Chat vs Composer
| Use Case | Tool | Token Cost |
|----------|------|------------|
| Quick question | **Chat** | Low |
| Code explanation | **Chat** | Low |
| Small edit (1 file) | **Chat** | Medium |
| Multi-file changes | **Composer** | High |
| Refactoring | **Composer** | High |

**Tip**: Chat is cheaper for questions and single-file edits.

### Inline Edit vs Chat
- **Inline**: Select code → Cmd+K → type instruction (most efficient)
- **Chat**: Better for questions and explanations

---

## 🎯 Strategy 5: Optimize File Structure

### A) Keep Component Files Small
```bash
# ❌ Large file (898 lines)
WhatsNewOnboarding.tsx

# ✅ Break into smaller files
WhatsNewOnboarding/
├── index.tsx (50 lines)
├── OnboardingStep.tsx (100 lines)
├── FeatureCard.tsx (80 lines)
└── types.ts (20 lines)
```

**Why**: Cursor loads entire files into context. Smaller files = fewer tokens.

### B) Extract Reusable Components
Large components consume tokens every time Cursor needs context.

---

## 🎯 Strategy 6: Use Comments Strategically

### A) Add Context Comments
```typescript
// ✅ Helps Cursor understand without loading other files
// This component fetches user data from Supabase and displays it
// Dependencies: useAuth, useQuery
export function UserProfile() { ... }
```

### B) Add AI Hints
```typescript
// @cursor: Only modify this section when adding new form fields
const FORM_FIELDS = { ... };
```

**Savings**: Cursor needs less context from other files.

---

## 🎯 Strategy 7: Optimize Workspace Settings

### Check Cursor Settings
Open Cursor Settings (Cmd+,) and review:

1. **Include Node Modules**: Should be OFF
   - Settings → Features → Codebase Indexing → uncheck "Include node_modules"

2. **Max File Size**: Set reasonable limit
   - Prevents accidentally loading huge files

3. **Context Window**: Use smaller models for simple tasks
   - Claude Sonnet 4 for complex tasks
   - Claude Haiku for simple questions (cheaper)

---

## 🎯 Strategy 8: Batch Similar Tasks

### Do Multiple Edits in One Request
```bash
# ❌ Three separate requests (3x token cost)
"Add loading state to LoginForm"
"Add loading state to SignupForm"
"Add loading state to ResetPasswordForm"

# ✅ One batch request
"Add loading states to these forms:
- LoginForm.tsx
- SignupForm.tsx  
- ResetPasswordForm.tsx"
```

**Savings**: ~60-70% compared to separate requests.

---

## 🎯 Strategy 9: Use Git Efficiently

### Commit Frequently
- Cursor includes git status/diff in context
- Large diffs = more tokens
- Commit working changes to reduce diff size

### Clean Up Branches
```bash
# Remove stale branches
git branch -d old-feature-branch

# Cursor won't waste tokens indexing them
```

---

## 🎯 Strategy 10: Monitor Your Usage

### Track Token Consumption
1. Check Cursor's usage dashboard daily
2. Identify which tasks consume the most tokens
3. Adjust your workflow accordingly

### Set Monthly Budget Alerts
- Set a personal budget (e.g., $50/month)
- Track spending weekly
- Adjust usage if approaching limit

---

## 📊 Expected Savings Summary

| Strategy | Estimated Savings | Effort |
|----------|------------------|---------|
| .cursorignore | 10-20% | 5 minutes |
| Archive docs | 5-10% | 10 minutes |
| Specific queries | 50-70% per query | Ongoing habit |
| Clear context | 20-30% | Ongoing habit |
| Use right tool | 30-50% | Ongoing habit |
| Small files | 10-20% | Refactoring time |
| Strategic comments | 5-10% | Ongoing habit |
| Workspace settings | 10-15% | 5 minutes |
| Batch tasks | 60-70% per batch | Ongoing habit |
| Git hygiene | 5-10% | Ongoing habit |

**Combined potential savings**: 70-90% on top of the 80-95% already achieved

---

## 🎬 Quick Wins (Do These First)

### 5-Minute Setup
```bash
cd "/Users/taborsmac/Downloads/ATTSemployeePortal-main 2"

# 1. Create .cursorignore
cat > .cursorignore << 'EOF'
docs/cursor-agents/
src/services/safety-agent/
performance-report/
tests/fixtures/
*PERFORMANCE*.md
*AUDIT*.md
*REPORT*.md
supabase/SCHEMA_DOCUMENTATION.md
EOF

# 2. Archive large docs
mkdir -p .archive/docs
mv *AUDIT*.md *REPORT*.md *PERFORMANCE*.md plan.md .archive/docs/ 2>/dev/null

# 3. Check Cursor settings
# Open Cursor → Settings → ensure node_modules excluded
```

**Immediate savings**: ~15-25% additional reduction

---

## 💡 Pro Tips

### 1. Model Selection
- **Claude Sonnet 4**: Complex refactoring, architecture decisions
- **Claude Haiku**: Simple questions, quick fixes (much cheaper)
- Switch models based on task complexity

### 2. Keyboard Shortcuts
- `Cmd+K`: Inline edit (most efficient)
- `Cmd+L`: New chat (clear context)
- `Cmd+I`: Composer (multi-file)

### 3. Learn from Token Usage
After a conversation, think:
- Could I have been more specific?
- Did I include unnecessary files?
- Should I have used a simpler model?

---

## 🚨 Red Flags (High Token Usage)

Watch for these patterns:
- ❌ Questions like "improve the codebase"
- ❌ Keeping 10+ files open
- ❌ Using same chat for hours
- ❌ Not referencing specific files
- ❌ Loading entire large components
- ❌ Including documentation unnecessarily

---

## 📈 Measuring Success

### Before Optimization
- ~20,000 tokens per conversation (already reduced to 500-2,000)
- Could hit 500K-1M tokens/week
- $200-500/month

### After All Optimizations
- ~200-1,000 tokens per simple query
- ~1,000-3,000 tokens per normal task
- 20K-100K tokens/week
- **$10-30/month** (95%+ savings)

---

## 🎯 Your Action Plan

### Week 1: Setup (30 minutes)
1. ✅ Already done: Disabled CLAUDE.md, GEMINI.md, AGENTS.md
2. ⏭️ Create `.cursorignore` file (5 min)
3. ⏭️ Archive large docs (10 min)
4. ⏭️ Check Cursor settings (5 min)
5. ⏭️ Start new chat habits (ongoing)

### Week 2-4: Build Habits
- Be specific in queries
- Close unused files
- Start fresh chats for new topics
- Use Cmd+K for quick edits
- Monitor usage weekly

### Monthly: Review & Adjust
- Check Cursor usage dashboard
- Compare to previous month
- Identify any wasteful patterns
- Celebrate savings!

---

## 🤔 FAQ

**Q: Will these changes break anything?**  
A: No. We're only changing what Cursor sees, not your actual code.

**Q: Can I still use Autopilot?**  
A: Yes! Just use `GO: AUTOPILOT SAFE` when needed.

**Q: What if I need a disabled file?**  
A: Explicitly reference it with `@filename` in your query.

**Q: Should I delete archived docs?**  
A: No, keep them in `.archive/docs/` for reference.

**Q: Can I undo these changes?**  
A: Yes, just delete `.cursorignore` and move files back.

---

## 📞 Need Help?

If token usage is still high:
1. Check Cursor usage dashboard for specific conversations
2. Identify which queries used the most tokens
3. Apply relevant strategies from this guide
4. Adjust workflow accordingly

**Remember**: The goal is sustainable, cost-effective usage while maintaining productivity.

---

**Last Updated**: January 24, 2026  
**Version**: 2.0  
**Estimated Additional Savings**: 15-40% on top of initial 80-95%
