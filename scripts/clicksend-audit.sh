#!/usr/bin/env bash
# clicksend-audit.sh — READ-ONLY snapshot of the ClickSend account for the SMS upgrade discovery.
# Never sends anything. Only GET requests.
#
# Usage:  ./scripts/clicksend-audit.sh > docs/sms-upgrade/clicksend-audit-$(date +%F).json
# Creds:  reads CLICKSEND_USERNAME and CLICKSEND_API_KEY (or CLICKSEND_PASSWORD) from the env,
#         falling back to ./.env in the repo root. Never commit the output if it contains phone numbers
#         you don't want in git — it is gitignored via docs/sms-upgrade/clicksend-audit-*.json.
set -euo pipefail

if [[ -z "${CLICKSEND_USERNAME:-}" && -f .env ]]; then
  # shellcheck disable=SC1091
  set -a; source .env; set +a
fi
KEY="${CLICKSEND_API_KEY:-${CLICKSEND_PASSWORD:-}}"
if [[ -z "${CLICKSEND_USERNAME:-}" || -z "$KEY" ]]; then
  echo '{"error":"CLICKSEND_USERNAME and CLICKSEND_API_KEY (or CLICKSEND_PASSWORD) not set"}'
  exit 2
fi

BASE="https://rest.clicksend.com/v3"
get() { curl -sS -u "${CLICKSEND_USERNAME}:${KEY}" -H "Accept: application/json" "${BASE}$1"; }

account=$(get "/account")
numbers=$(get "/numbers?page=1&limit=100")
lists=$(get "/lists?page=1&limit=100")
# ClickSend moves STOP replies into an opt-out contact list; find any list whose name mentions opt-out.
optout_ids=$(echo "$lists" | python3 -c '
import json,sys
d=json.load(sys.stdin)
for l in d.get("data",{}).get("data",[]):
    n=(l.get("list_name") or "").lower()
    if "opt" in n and "out" in n: print(l["list_id"])' 2>/dev/null || true)
optout_contacts="[]"
if [[ -n "$optout_ids" ]]; then
  optout_contacts="["
  first=1
  for id in $optout_ids; do
    c=$(get "/lists/${id}/contacts?page=1&limit=1000")
    [[ $first -eq 0 ]] && optout_contacts+=","
    optout_contacts+="{\"list_id\":${id},\"contacts\":${c}}"
    first=0
  done
  optout_contacts+="]"
fi
# Last 1000 outbound messages — enough to see which `from` numbers are actually in use.
history=$(get "/sms/history?page=1&limit=1000")
from_summary=$(echo "$history" | python3 -c '
import json,sys,collections
d=json.load(sys.stdin)
c=collections.Counter()
for m in d.get("data",{}).get("data",[]):
    c[(m.get("from") or "(none)", m.get("status") or "?")]+=1
print(json.dumps([{"from":k[0],"status":k[1],"count":v} for k,v in c.most_common()]))' 2>/dev/null || echo "[]")
inbound=$(get "/sms/inbound?page=1&limit=200")

python3 - "$account" "$numbers" "$lists" "$optout_contacts" "$from_summary" "$inbound" <<'EOF'
import json,sys,datetime
a,n,l,o,f,i=[json.loads(x) if x else None for x in sys.argv[1:]]
print(json.dumps({
  "generated_at": datetime.datetime.utcnow().isoformat()+"Z",
  "account": a, "numbers": n, "contact_lists": l,
  "opt_out_lists": o, "outbound_from_number_summary": f,
  "inbound_recent": i
}, indent=2))
EOF
