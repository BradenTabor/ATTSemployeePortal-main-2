#!/usr/bin/env bash
# Check for inputs/textareas that might cause iOS auto-zoom (font-size < 16px).
# iOS Safari zooms when an input/textarea with font-size < 16px receives focus.
# Run in CI to prevent regression. Usage: ./scripts/check-input-font-sizes.sh

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Flag lines that contain both input/textarea and text-xs or text-sm (heuristic:
# same line often has className with the small font). Multiline JSX may slip through.
MATCHES=$(grep -rn --include="*.tsx" --include="*.jsx" \
  -E '(input|textarea)[^>]*(className|class)=[^>]*(text-xs|text-sm)|(text-xs|text-sm)[^>]*(input|textarea)' \
  src 2>/dev/null || true)

if [ -z "$MATCHES" ]; then
  echo "OK: No obvious input/textarea with text-xs or text-sm found."
  exit 0
fi

echo "The following lines may have inputs/textareas with small font (review for mobile zoom):"
echo "$MATCHES"
echo "Use MOBILE_SAFE_INPUT / MOBILE_SAFE_TEXTAREA or text-base (16px) for focusable inputs on mobile."
exit 1
