/**
 * OSHA 300A Posting Reminder.
 * Shows banner Feb 1–Apr 30; "Mark as Posted" or confirmation.
 */

import { useMemo } from 'react';
import { format, getDate, getMonth } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { use300ACertification, useMark300APosted } from '../../hooks/queries/useOSHA300A';
import { Loader2 } from 'lucide-react';
import { useDashboardCardTheme } from '../../contexts/dashboardCardTheme';

const POSTING_START_MONTH = 1; // February
const POSTING_START_DAY = 1;
const POSTING_END_MONTH = 4; // April
const POSTING_END_DAY = 30;

function isPostingPeriod(now: Date): boolean {
  const month = getMonth(now);
  const day = getDate(now);
  if (month < POSTING_START_MONTH) return false;
  if (month > POSTING_END_MONTH) return false;
  if (month === POSTING_START_MONTH && day < POSTING_START_DAY) return false;
  if (month === POSTING_END_MONTH && day > POSTING_END_DAY) return false;
  return true;
}

function getPostingYear(now: Date): number {
  const year = now.getFullYear();
  if (getMonth(now) < 6) return year - 1;
  return year;
}

export default function PostingReminder() {
  const { cardClass } = useDashboardCardTheme();
  const now = useMemo(() => toZonedTime(new Date(), 'America/Chicago'), []);
  const postingYear = useMemo(() => getPostingYear(now), [now]);
  const inPostingPeriod = useMemo(() => isPostingPeriod(now), [now]);

  const { data: certification, isLoading } = use300ACertification(postingYear);
  const markPosted = useMark300APosted(postingYear);

  if (!inPostingPeriod) return null;

  if (isLoading) {
    return (
      <div className={`${cardClass} border-amber-500/25 px-4 py-3 text-sm text-amber-100 flex items-center gap-2`}>
        <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden />
        Checking 300A status...
      </div>
    );
  }

  if (!certification) {
    return (
      <div className={`${cardClass} border-amber-500/30 px-4 py-3 text-sm`}>
        <strong className="text-amber-100">300A for {postingYear} has not been certified yet.</strong>
        <p className="mt-1 text-amber-200/90 text-xs">
          Certify the OSHA 300A Summary before posting. Post Feb 1–Apr 30.
        </p>
      </div>
    );
  }

  if (certification.posted_date) {
    return (
      <div className={`${cardClass} border-emerald-500/25 px-4 py-3 text-sm text-emerald-100`}>
        300A posted on {format(new Date(certification.posted_date), 'MMM d, yyyy')}.
      </div>
    );
  }

  return (
    <div className={`${cardClass} border-amber-500/25 px-4 py-3 text-sm text-amber-100`}>
      <p>
        OSHA 300A Summary for {postingYear} must be posted in a conspicuous location. Has it been posted?
      </p>
      <button
        type="button"
        onClick={() => markPosted.mutate(format(now, 'yyyy-MM-dd'))}
        disabled={markPosted.isPending}
        className="mt-2 px-3 py-1.5 rounded-lg bg-amber-500/25 hover:bg-amber-500/35 border border-amber-500/40 text-amber-100 text-xs font-medium disabled:opacity-50 flex items-center gap-1"
      >
        {markPosted.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
        Mark as Posted
      </button>
    </div>
  );
}
