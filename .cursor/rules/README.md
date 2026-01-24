# Cursor Rules Configuration

This directory contains specialized AI agent rules for the ATTS Employee Portal project.

## 🎯 Current Configuration (Cost-Optimized)

All rules are **disabled by default** to minimize token consumption. Activate them only when needed.

## 📋 Available Rules

### 🤖 Autopilot Governor (`00-autopilot-governor.mdc`)
**Status:** ⚪ Disabled by default  
**Activate with:** `GO: AUTOPILOT SAFE` or `GO: AUTOPILOT FULL`  
**Purpose:** Autonomous recursive codebase improvement system  
**Token Cost:** ~16,000-20,000 tokens per session + execution overhead  
**Use when:** You want autonomous multi-step improvements with verification

### 🎨 UX Specialist (`10-specialist-ux.mdc`)
**Status:** ⚪ Disabled (alwaysApply: false)  
**Activate with:** Explicitly request UX audit  
**Purpose:** Audit UI/UX, accessibility, visual hierarchy, feedback quality  
**Token Cost:** ~2,000 tokens per audit  
**Use when:** Reviewing UI components for quality/accessibility

### 🔄 Workflow Specialist (`11-specialist-workflow.mdc`)
**Status:** ⚪ Disabled (alwaysApply: false)  
**Purpose:** Audit user journeys, task efficiency, automation opportunities  
**Token Cost:** ~1,500 tokens per audit  
**Use when:** Optimizing user workflows and process efficiency

### 🏗️ Architecture Specialist (`12-specialist-architecture.mdc`)
**Status:** ⚪ Disabled (alwaysApply: false)  
**Purpose:** Audit component structure, state management, code patterns  
**Token Cost:** ~1,500 tokens per audit  
**Use when:** Reviewing code organization and architectural patterns

### ⚡ Performance Specialist (`13-specialist-performance.mdc`)
**Status:** ⚪ Disabled (alwaysApply: false)  
**Purpose:** Audit bundle size, render efficiency, query optimization  
**Token Cost:** ~1,500 tokens per audit  
**Use when:** Investigating performance issues or optimizing

### 🧪 QA Specialist (`14-specialist-qa.mdc`)
**Status:** ⚪ Disabled (alwaysApply: false)  
**Purpose:** Audit test coverage, edge cases, error handling  
**Token Cost:** ~1,500 tokens per audit  
**Use when:** Reviewing test quality and coverage

### 🔒 Security Specialist (`15-specialist-security.mdc`)
**Status:** ⚪ Disabled (alwaysApply: false)  
**Purpose:** Audit authentication, authorization, RLS, data protection  
**Token Cost:** ~1,500 tokens per audit  
**Use when:** Security review or before production deployment

## 💰 Token Usage Comparison

### Before Optimization (All rules active)
- Every conversation: ~16,000-20,000 tokens in context
- Autopilot sessions: 50,000-200,000+ tokens per session
- Simple questions: 16,000+ tokens overhead

### After Optimization (Default configuration)
- Normal conversations: ~500-2,000 tokens
- Specialist audits (when requested): +1,500-2,000 tokens each
- Autopilot (when activated): Cost same as before, but opt-in only

**Estimated Savings: 80-95% reduction in token usage**

## 🚀 Usage Examples

### For Normal Development
Just ask questions naturally - no special commands needed:
```
"Fix the loading state in WhatsNewOnboarding.tsx"
"Add error handling to this API call"
"Why is this component re-rendering?"
```

### For Specific Audits
Request the specialist you need:
```
"Run a UX audit on the dashboard components"
"Audit security for the authentication flow"
"Check performance of the equipment logs page"
```

### For Autonomous Improvements
Activate the Autopilot Governor:
```
GO: AUTOPILOT SAFE
```
Then let it run through improvements automatically.

## 🎛️ Re-enabling Rules

If you want to re-enable the always-on behavior (not recommended):

1. **Autopilot Governor:**
   Edit `00-autopilot-governor.mdc` and change `alwaysApply: false` to `alwaysApply: true`

2. **Safety Agent:**
   Rename `AGENTS.md.disabled` back to `AGENTS.md`

3. **Specialists:**
   Edit individual `.mdc` files and change `alwaysApply: false` to `alwaysApply: true`

⚠️ **Warning:** Re-enabling these will significantly increase token consumption.

## 📊 Monitoring Usage

To check if rules are active in a conversation:
- Look for "🤖 AUTOPILOT STATUS" in responses (Governor active)
- Check for specialist report formats (Specialist active)
- Notice verbose structured outputs (Rules loading)

## 🔧 Safety Agent (Disabled)

The Safety Agent system (`AGENTS.md.disabled`) is disabled by default as it's only needed for:
- Developing the safety announcement feature
- Working on compliance notification systems
- Debugging the AI-assisted form defaults

To re-enable: rename back to `AGENTS.md`

## 📝 Notes

- All specialist schemas are preserved and functional
- They activate automatically when the Autopilot Governor is active
- You can still manually request specific audits anytime
- The system is still powerful - just opt-in instead of always-on
