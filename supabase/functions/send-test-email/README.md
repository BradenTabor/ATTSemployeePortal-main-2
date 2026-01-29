# send-test-email

Edge Function used by the Admin **Email Recipients** page to send a test email to the current list’s recipients (Compliance Summary or Safety Forecast).

## Required secrets

Set these in the Supabase Dashboard under **Project Settings** → **Edge Functions** → **Secrets**:

| Secret               | Required | Description |
|----------------------|----------|-------------|
| `GMAIL_APP_PASSWORD` | **Yes**  | Gmail App Password for the sender account. Without this, the function returns an error and the UI will show “GMAIL_APP_PASSWORD not configured”. |
| `GMAIL_USER`         | No       | Sender email (default: `allterraintreeservice.po@gmail.com`). |

## Usage

- **Auth:** Caller must be logged in and have `app_users.role = 'admin'`.
- **Body:** `{ "listKey": "compliance_summary" | "safety_forecast" }`.
- **Response:** `{ "success": true, "count": N }` or error JSON with `error` (and optionally `details`).

If “Send test” fails, the Admin UI now shows the function’s error message (e.g. missing secret or SMTP failure) instead of a generic non-2xx message.
