# Purchase-order app — SMS delivery from shared-account receipts

> **Read-only report.** Queried from `sms_delivery_receipt` on the ATTS portal project
> (`emqqxfzahmwnehxcpxzp`). Nothing in either system was changed. This describes traffic from
> an app outside this repo (Braden's Bolt purchase-order app); it makes no recommendations
> about that app's code.

**Source.** The portal and the PO app share one ClickSend account. Every outbound receipt for
the account lands in `sms_delivery_receipt`. Rows with `is_matched = false` have no
corresponding portal send (`sms_message_log` / `sms_message_log_compat`) and are the PO app's
traffic. Confirmed: every unmatched body since 2026-05-01 matches purchase-order wording
(2,772 / 2,772).

**Window.** Receipts with `delivery_status_at >= 2026-05-01`. ClickSend retention begins
around **2026-05-11**, so that is the practical start of the sample. Latest unmatched receipt
in this pull: **2026-09-09**.

**Sending number.** All 2,772 unmatched receipts are from **`+18338612650`**. Portal traffic
in the same ledger is from `+18443781444` only. Toll-free verification status for
`+18338612650` shows **REGISTERED**.

---

## 1. Unmatched outcomes since 2026-05-01

| Outcome | Count | Share |
|---|---:|---:|
| Total unmatched | **2,772** | 100% |
| Delivered | 2,614 | 94.30% |
| Failed | **91** | **3.28%** |
| Sent to network (no final receipt) | 67 | 2.42% |

**Failure rate (failed / all unmatched):** 91 / 2,772 = **3.28%**.

### Failures by carrier error code

| Error code | Provider status text | Count |
|---|---|---:|
| **15** | Rejected by the recipient network. (`error_text`: Unknown error) | **56** |
| **12** | Absent Subscriber. Phone is out of range or switched off. Likely to have been unavailable for 12 hours or more. (`error_text`: Unknown error) | **35** |

No other failure codes appear on unmatched traffic in this window.

Error **15** (network rejection) ran **2026-05-14 → 2026-07-08**, then stopped. Error **12**
(absent subscriber) appears **2026-07-27 → 2026-09-08**. The same May→July then July→later
shift appears on portal receipts for the same codes, so the code mix is partly a shared
carrier-era effect, not PO-specific.

---

## 2. Split by sending number

| From | Total | Delivered | Failed | Sent to network | Fail % |
|---|---:|---:|---:|---:|---:|
| **`+18338612650`** (PO) | 2,772 | 2,614 | 91 | 67 | **3.28%** |

There is no other unmatched from-number in the window. PO traffic is already fully isolated
from portal traffic by `from_number` and by `is_matched`.

Both apps use the same ClickSend `_api_username` / `subaccount_id`; only the from-number and
match flag separate them.

---

## 3. URL-bearing vs no-URL bodies

Receipt `raw` includes the message `body` for every row (2,772 / 2,772). URL presence is
taken only from an explicit `http://` or `https://` scheme in that body — not inferred from
vendor names or bare domains.

| Body | Total | Delivered | Failed | Sent to network | Fail % |
|---|---:|---:|---:|---:|---:|
| **Contains `http(s)://`** | 1,054 | 943 | **91** | 20 | **8.63%** |
| **No `http(s)://`** | 1,718 | 1,671 | **0** | 47 | **0.00%** |

Every unmatched failure in the window is in the URL-bearing group. The non-URL group has
zero failures across 1,718 messages.

**What the URLs are.** All 1,054 URL bodies point at one host:
`webhook-approval-for-6061.bolt.host` — approval / deny links in PO approval-request texts.
Non-URL bodies are approval *notifications* (PO approved / status update) without a link.

**Within-recipient check.** Seven of twelve distinct recipients received both kinds of
message. Among those seven: URL fail rate **8.63%** (91 / 1,054), non-URL fail rate **0%**
(0 / 1,675). The gap is not explained by different phone numbers alone.

**Confounders the data also shows (not resolved here):**

- URL bodies are longer (avg ~409 chars, mostly 3–4 parts) than non-URL (avg ~185 chars,
  mostly 1–2 parts). Failure rate on 4-part URL messages is 16.67% (8 / 48) vs 8.25% on
  3-part URL (83 / 1,006). Length and URL presence travel together.
- The same seven recipients see both templates, so recipient identity does not explain the
  gap; message content / length still might.

The receipt data **does** carry enough to classify URL vs no-URL. It does **not** carry
enough to separate “URL caused the reject” from “longer multi-part message caused the
reject” without an experiment outside this dataset.

---

## 4. Comparison to the portal baseline (229 of 3,047)

Portal sends since 2026-05-01 (`sms_message_log_compat`, live only):

| | Count |
|---|---:|
| Submitted | **3,047** |
| Delivered | 2,595 |
| Failed | **229** |
| Sent to network | 80 |
| No receipt (pre-retention) | 143 |

**Portal failure rate:** 229 / 3,047 = **7.52%**.

| Traffic | Fail rate | vs portal 7.52% |
|---|---:|---|
| PO overall (`+18338612650`) | **3.28%** | Lower |
| PO **with URL** | **8.63%** | **Higher** (~1.1×) |
| PO **without URL** | **0.00%** | Far lower |
| Portal (no URLs in bodies) | **7.52%** | — |

Portal receipts in this ledger contain **no** `http(s)://` bodies (0 / 2,632 matched
receipts). Portal failures are therefore not URL-driven in the same sense; they are
dominated by codes 12 and 15 on plain operational SMS from `+18443781444`.

**On the URL-filtering hypothesis.** A materially higher failure rate on URL-bearing PO
traffic than on the portal baseline would be consistent with carrier filtering of links from
a toll-free number. The data is **directionally consistent** with that story:

- URL PO traffic fails at **8.63%** vs portal **7.52%** (modestly higher).
- Non-URL PO traffic from the **same** toll-free number fails at **0%**.
- All 91 PO failures sit in the URL group; 56 of them are code **15** (rejected by the
  recipient network), which is the code most often associated with content / network policy
  rejects rather than a powered-off handset.

It is **not** a clean proof: the portal and PO apps use different from-numbers, different
templates, different part counts, and different recipient sets. The strongest contrast in
this ledger is **URL vs non-URL on the same PO number**, not PO-vs-portal alone.

---

## 5. Account / policy context (facts only)

ClickSend's own guidance, mirrored at the top of this repo's shared helper
(`supabase/functions/_shared/clicksend.ts`):

> WARNING: Do not include URLs in SMS body unless ClickSend account is approved for URL
> messaging.

Toll-free verification for the PO sending number **`+18338612650`** shows **REGISTERED**.
Verification status and URL-messaging approval are separate ClickSend / carrier controls;
this report does not establish whether the shared account is approved for URL messaging.

---

## Method notes

- Unmatched = `sms_delivery_receipt.is_matched = false`. Cross-check: zero unmatched rows
  join to `sms_message_log` or `sms_message_log_compat` by `provider_message_id`; every
  unmatched body is PO-shaped.
- Outcomes use the ledger's mapped `delivery_status` (`delivered` / `failed` /
  `sent_to_network`), sourced from ClickSend history (`status_code` / `status` text).
- URL flag = `raw->>'body' ~* 'https?://'`. Bodies are present on every receipt in the pull.
- Portal baseline denominator matches the compliance export framing: 229 failures among
  3,047 portal submissions since 2026-05-01 (includes 143 with no receipt).
- Queried read-only via `psql` against the linked project. No writes.
