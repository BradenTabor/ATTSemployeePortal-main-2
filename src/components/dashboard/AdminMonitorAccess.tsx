import { useEffect, useRef, useState } from 'react';
import { Check, Copy, ExternalLink, Activity } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { glass, canopy } from '../../lib/glass';

/** Mounted only on the admin dashboard; database RLS also enforces admin access. */
export default function AdminMonitorAccess() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const passwordInput = useRef<HTMLInputElement>(null);

  // Keep the credential in component memory, outside persisted query/draft caches.
  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(false);
      try {
        const { data, error: queryError } = await supabase.rpc('get_po_monitor_password');
        if (!active) return;
        if (queryError || typeof data !== 'string' || !data) throw new Error('Unavailable');
        setPassword(data);
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [attempt]);

  useEffect(() => {
    if (copyStatus !== 'copied') return;
    const timeout = window.setTimeout(() => setCopyStatus('idle'), 3000);
    return () => window.clearTimeout(timeout);
  }, [copyStatus]);

  async function copyPassword() {
    try {
      await navigator.clipboard.writeText(password);
      setCopyStatus('copied');
    } catch {
      passwordInput.current?.focus();
      passwordInput.current?.select();
      setCopyStatus('failed');
    }
  }

  return (
    <section aria-labelledby="po-monitor-title" className={`${glass.cardGold} min-w-0 space-y-4 p-5 sm:p-6`}>
      <div className="flex items-start gap-3">
        <Activity className="mt-1 h-5 w-5 shrink-0 text-amber-300" aria-hidden />
        <div className="min-w-0">
          <h3 id="po-monitor-title" className="type-display text-2xl text-bone-50">PO# analytics & system monitor</h3>
          <p className="mt-2 text-sm text-bone-300">View purchase order analytics and system health. Copy the password, then open the monitor to log in.</p>
        </div>
      </div>
      {loading ? <p role="status" className="text-sm text-bone-300">Loading login password…</p> : error ? (
        <div className="flex flex-wrap items-center gap-3">
          <p role="alert" className="text-sm text-amber-200">Unable to load the login password. Check your connection and try again.</p>
          <button type="button" onClick={() => setAttempt(value => value + 1)} className="min-h-[44px] rounded-lg border border-white/20 px-4 text-sm text-bone-50 focus-visible:outline-emerald-400">Retry password</button>
        </div>
      ) : (
        <div>
          <label htmlFor="po-monitor-password" className="mb-2 block text-sm text-bone-200">Monitor login password</label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input ref={passwordInput} id="po-monitor-password" type="text" readOnly value={password} autoComplete="off" spellCheck={false}
              className="min-h-[44px] w-full min-w-0 flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-3 font-mono text-base text-bone-50 focus-visible:outline-emerald-400" />
            <button type="button" onClick={() => void copyPassword()} className="flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-lg border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm text-amber-100 hover:bg-amber-300/20 focus-visible:outline-emerald-400">
              {copyStatus === 'copied' ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
              {copyStatus === 'copied' ? 'Copied!' : 'Copy password'}
            </button>
          </div>
          <p role="status" className="mt-2 text-sm text-bone-300">
            {copyStatus === 'failed' ? 'Automatic copy is unavailable. The password is selected; use your device’s Copy command.' : copyStatus === 'copied' ? 'Password copied. Paste it into the monitor login.' : ''}
          </p>
        </div>
      )}
      <a href="https://atts-po-monitor.vercel.app/" target="_blank" rel="noopener noreferrer" className={`${canopy.buttonPrimary} inline-flex min-h-[44px] items-center justify-center gap-2 px-5 py-3 text-sm focus-visible:outline-emerald-400`}>
        Open PO monitor <ExternalLink className="h-4 w-4" aria-hidden />
        <span className="sr-only">(opens in a new tab)</span>
      </a>
    </section>
  );
}
