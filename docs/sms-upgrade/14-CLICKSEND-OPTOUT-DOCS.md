# What ClickSend actually documents about opt-outs

**Session 9, 2026-09-09.** Retrieved directly from ClickSend's own help centre and API
reference. This page exists because the conclusion in
[`08-BLOCKED-HISTORY-PROPOSAL.md`](./08-BLOCKED-HISTORY-PROPOSAL.md) and the send-path filter in
[`05-CHUNK3-RUNBOOK.md`](./05-CHUNK3-RUNBOOK.md) both rest on the claim that ClickSend does *not*
screen ad-hoc sends against the opt-out list. That claim was inferred from delivery receipts. It
is load-bearing, so it was checked against the vendor's own words.

## Verdict

**Ambiguous, and the ambiguity resolves against the broad reading.**

ClickSend states a broad blocking rule in prose, but every mechanism it documents to implement
that rule is scoped to **contact lists**, and the API reference for the ad-hoc send endpoint —
the one this portal uses — never mentions opt-outs at all. ClickSend nowhere addresses the
specific question "does a `to`-addressed send get screened against the opt-out list?" Our own
receipt data answers it: **no**.

Do not treat this page as license to ignore the vendor. Treat it as the reason the enforcement
now lives in our code, where it is observable, rather than in a vendor behaviour nobody has
confirmed in writing.

---

## 1. The broad claim

From **Understanding opt-outs**
(<https://help.clicksend.com/en/articles/42308-understanding-opt-outs>, updated 2026-07-07):

> As soon as a user opts out, their contact information will be automatically removed from your
> **active lists**. This means you don't need to manually update your records.
>
> Once a contact has opted out, any future messages to that number or email will be blocked.

Read alone, the second sentence says what we assumed for months. Read with the first, it is
already list-scoped: the described mechanism is *removal from lists*, and "blocked" is the
consequence of no longer being on a list you send to.

## 2. The qualifier that scopes it

From **Managing opt-outs**
(<https://help.clicksend.com/en/articles/43124-managing-opt-outs>, updated 2026-07-07):

> The automatic opt-out system is already set up on your account. Once the recipient opts-out
> they will be moved to the opt-out contact list. Just remember, **you must use the correct opt
> out method and store your contact lists in ClickSend for the system to work.**

That last clause is the whole ballgame. The system works *if your contacts are stored in
ClickSend as lists*. ATTS stores its recipients in Supabase `app_users` and passes raw numbers
to the API. There are no ATTS contact lists in ClickSend for anyone to be removed from.

The same page also confines the STOP keyword itself:

> Recipients can reply with the keyword "STOP" (or a custom keyword) to unsubscribe
> automatically. **Available in SMS Campaign only.**

And the opt-out rule it tells you to build is literally a list-move operation:

> Under Action select **MOVE_CONTACT** and under Contact List select **Opt-Out List**.

## 3. The endpoint we actually use is silent

The REST v3 **Send SMS** reference
(<https://developers.clicksend.com/docs/messaging/sms/other/send-sms>) — the `POST /v3/sms/send`
endpoint with a `messages[].to` array, which is exactly what
`supabase/functions/_shared/clicksend.ts` calls — documents `to`, `from`, `body`, `schedule`,
`custom_string`, `country`, `source`, and the list-id alternative. **It contains no mention of
"opt-out", "opt out", "unsubscribe", or "STOP" anywhere in the page.** No pre-send screening is
described, promised, or hinted at.

By contrast, the **SMS Campaigns** reference
(<https://developers.clicksend.com/docs/messaging/sms-campaigns>) is where the opt-out
obligations appear:

> You are required to add an opt-out message to the end of your message body if you are sending
> marketing message.

The split is consistent: opt-out machinery is documented on the campaign/list surface, not the
ad-hoc surface.

## 4. The one place ClickSend claims universal screening

The **ActiveCampaign integration guide**
(<https://help.clicksend.com/en/articles/42331-integration-guide-activecampaign>) is the
strongest statement in the other direction:

> Opt-out status is not synced back to ActiveCampaign, but **ClickSend will always check the
> opt-out list before sending any SMS.**
>
> Even if a contact appears active in ActiveCampaign, ClickSend will block SMS delivery if the
> number is opted out in ClickSend.

Three reasons not to rely on it:

1. It is scoped to one integration, describing sends that ClickSend itself originates from lists
   it owns — not third-party API calls to `/sms/send`.
2. The **same page** immediately undercuts the universality: *"If different contact lists are
   selected, the recipient may still receive messages after replying STOP."* So the screen is
   list-identity-sensitive, not number-sensitive.
3. It is contradicted by our production data.

## 5. What our data says

`+18703656644` has been on the ClickSend opt-out list since **2026-03-04**. Since that date the
portal has sent it **530 messages that ClickSend's own delivery receipts mark `Delivered`**,
against 2 failed, most recently today. If ad-hoc sends were screened, that number would be zero.

This is the decisive evidence. Vendor prose says one thing; the vendor's own receipts say
another. See [`13-UNREACHABLE-CREW.md` §1](./13-UNREACHABLE-CREW.md).

---

## 6. Is there account-level enforcement that would cover ad-hoc sends?

**Nothing documented. No.** Searching the help centre and the v3 API reference turns up no
account-wide "suppress all sends to opted-out numbers" toggle, no global blocklist that applies
to `to`-addressed messages, and no send-time screening option on `/sms/send`.

What exists is adjacent but does not cover us:

| Feature | What it does | Why it does not help |
|---|---|---|
| Opt-Out List (Contacts → Opt-Outs) | A contact list, importable and exportable | Screening happens on list-addressed sends; we address raw numbers |
| `PUT /lists/{list_id}/remove-opted-out-contacts/{opt_out_list_id}` | Scrubs opted-out contacts *out of* a list | Operates on lists we do not maintain |
| Inbound rules (`MOVE_CONTACT` / `CREATE_CONTACT`) | Puts a STOP replier onto the Opt-Out List | Populates the list; does not enforce against ad-hoc sends |
| Share opt-out lists across subaccounts | Propagates the list between subaccounts | Propagation, not enforcement |

**Recommended follow-up, not taken here:** ask ClickSend support directly whether account-level
suppression for `to`-addressed sends can be enabled — email support@clicksend.com, quoting the
530-delivered figure above as the reproduction. If such a setting exists it is worth having as a
second layer *behind* the application filter, never instead of it. **This has not been enabled or
requested.** Per the hard constraints, no vendor-side configuration was changed.

---

## 7. What this changes

Nothing in the code — the filter added in this session already assumes no carrier backstop. What
it changes is the confidence level: the application-side filter in
`_shared/smsOptOutFilter.ts` is now known to be **the only** opt-out enforcement in the chain,
confirmed against vendor documentation rather than inferred from receipts alone. If it is
disabled via `app_settings.sms_send_optout_filter_config`, opted-out people receive messages.
There is nothing underneath it.
