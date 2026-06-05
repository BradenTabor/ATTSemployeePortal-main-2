#!/bin/bash

# Advanced Token Optimization - Quick Setup Script
# Run this to implement the easiest token-saving strategies
# Estimated time: 2 minutes
# Estimated additional savings: 15-25%

set -e

cd "$(dirname "$0")"

echo "🚀 Starting Advanced Token Optimization..."
echo ""

# Step 1: Create .cursorignore
echo "📝 Step 1/4: Creating .cursorignore..."
cat > .cursorignore << 'EOF'
# Exclude large documentation directories
docs/cursor-agents/
src/services/safety-agent/directives/
src/services/safety-agent/prompts/

# Exclude test fixtures and artifacts
tests/fixtures/
dist/
build/
.vite/

# Exclude large reports and documentation
performance-report/
*PERFORMANCE*.md
*AUDIT*.md
*REPORT*.md
*FLOW*.md
*OVERLAY*.md

# Exclude migration documentation (load only when needed)
supabase/SCHEMA_DOCUMENTATION.md
supabase/SUPABASE_MIGRATION_RECONCILIATION.md
supabase/RLS_FIX_SUMMARY.md
supabase/MIGRATION_RESOLUTION_GUIDE.md

# Exclude planning documents
plan.md
docs/baseline_metrics.md
docs/Telemetry_plan.md
docs/telemetry.md

# Exclude node_modules (should be default, but be explicit)
node_modules/

# Exclude archived files
.archive/
EOF

echo "✅ .cursorignore created"
echo ""

# Step 2: Create archive directory
echo "📦 Step 2/4: Creating archive directory..."
mkdir -p .archive/docs
echo "✅ Archive directory created"
echo ""

# Step 3: Archive large documentation files
echo "🗂️  Step 3/4: Archiving large documentation files..."

# Function to safely move files
move_if_exists() {
    if [ -f "$1" ]; then
        mv "$1" .archive/docs/
        echo "   Archived: $1"
    fi
}

# Archive reports
move_if_exists "PRODUCTION_AUDIT_REPORT.md"
move_if_exists "SUPABASE_PERFORMANCE_REPORT.md"
move_if_exists "TEST_REPORT.md"
move_if_exists "LITE_QA_REPORT.md"
move_if_exists "BUNDLE_ANALYSIS_REPORT.md"
move_if_exists "MOBILE_PERFORMANCE_NOTES.md"
move_if_exists "README_PERF.md"
move_if_exists "ASSET_OPTIMIZATION.md"

# Archive workflow documentation
move_if_exists "AUTHENTICATION_FLOW_FINAL.md"
move_if_exists "REALTIME_SESSION_FLOW.md"
move_if_exists "SESSION_RESTORE_OVERLAY.md"
move_if_exists "ENHANCED_SESSION_OVERLAY.md"
move_if_exists "CINEMATIC_TRANSITIONS.md"
move_if_exists "AUTH_TEST_VERIFICATION.md"

# Archive planning docs
move_if_exists "plan.md"

echo "✅ Large documentation archived"
echo ""

# Step 4: Update .gitignore
echo "🔒 Step 4/4: Updating .gitignore..."
if ! grep -q ".archive/" .gitignore 2>/dev/null; then
    echo ".archive/" >> .gitignore
    echo "✅ Added .archive/ to .gitignore"
else
    echo "✅ .archive/ already in .gitignore"
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ Optimization Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Changes Made:"
echo "   ✅ .cursorignore created (excludes ~30 files/directories)"
echo "   ✅ .archive/docs/ created"
echo "   ✅ $(ls -1 .archive/docs/ 2>/dev/null | wc -l | xargs) large documentation files archived"
echo "   ✅ .gitignore updated"
echo ""
echo "💰 Expected Savings:"
echo "   • 15-25% additional token reduction"
echo "   • Faster Cursor responses"
echo "   • Lower monthly costs"
echo ""
echo "📚 Archived Files Location:"
echo "   .archive/docs/"
echo "   (Files are still accessible, just not loaded by Cursor)"
echo ""
echo "🎯 Next Steps:"
echo "   1. Restart Cursor for changes to take effect"
echo "   2. Review ADVANCED_TOKEN_OPTIMIZATION.md for more strategies"
echo "   3. Start new chat to see the difference"
echo "   4. Check Cursor usage dashboard in 1-2 days"
echo ""
echo "💡 Pro Tips:"
echo "   • Be specific in queries: 'Fix X in file.tsx' vs 'improve code'"
echo "   • Close unused files before asking questions"
echo "   • Start fresh chats for unrelated tasks"
echo "   • Use Cmd+K for quick inline edits"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 Setup complete! Happy (cost-effective) coding!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
