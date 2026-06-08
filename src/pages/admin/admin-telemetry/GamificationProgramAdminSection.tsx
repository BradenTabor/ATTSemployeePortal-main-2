import { useMemo, useState } from 'react';
import { CalendarRange, Megaphone, Moon, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useGamificationPhase2AdminFlags,
  useGamificationProgramCampaigns,
  useGamificationProgramChallenges,
  useGamificationProgramSeasons,
  useSetGamificationCampaignActive,
  useSetGamificationSeasonStatus,
  useUpsertGamificationCampaign,
  useUpsertGamificationSeason,
} from '@/hooks/gamification';
import type { GamificationProgramSeason } from '@/lib/gamification/types';

function toDatetimeLocalValue(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocalValue(value: string): string {
  if (!value) return '';
  return new Date(value).toISOString();
}

function StatusChip({ label, tone }: { label: string; tone: 'amber' | 'emerald' | 'blue' | 'red' | 'neutral' }) {
  const tones = {
    amber: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
    emerald: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
    blue: 'border-blue-500/30 bg-blue-500/10 text-blue-200',
    red: 'border-red-500/30 bg-red-500/10 text-red-200',
    neutral: 'border-white/10 bg-white/[0.03] text-white/60',
  };
  return (
    <span className={cn('inline-flex px-1.5 py-0.5 rounded-md border text-[9px] sm:text-[10px] uppercase tracking-wide', tones[tone])}>
      {label}
    </span>
  );
}

interface SeasonEditorProps {
  season: GamificationProgramSeason;
  onSaved: () => void;
}

function SeasonEditor({ season, onSaved }: SeasonEditorProps) {
  const upsert = useUpsertGamificationSeason();
  const setStatus = useSetGamificationSeasonStatus();
  const [name, setName] = useState(season.name);
  const [theme, setTheme] = useState(season.theme ?? '');
  const [startAt, setStartAt] = useState(toDatetimeLocalValue(season.startAt));
  const [endAt, setEndAt] = useState(toDatetimeLocalValue(season.endAt));
  const editable = season.status === 'draft' || season.status === 'scheduled';

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2 sm:p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div>
          <p className="text-xs sm:text-sm font-medium text-white">{season.seasonKey}</p>
          <div className="flex flex-wrap gap-1 mt-1">
            <StatusChip label={season.status} tone={season.status === 'active' ? 'emerald' : season.status === 'scheduled' ? 'blue' : 'neutral'} />
            {!season.mostImprovedEnabled && (
              <StatusChip label="podium only" tone="neutral" />
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {season.status === 'draft' && (
            <button
              type="button"
              disabled={setStatus.isPending}
              onClick={() => setStatus.mutate({ seasonKey: season.seasonKey, status: 'scheduled' }, { onSuccess: onSaved })}
              className="px-2 py-1 rounded-md border border-blue-500/30 bg-blue-500/10 text-[10px] text-blue-200 hover:bg-blue-500/20"
            >
              Schedule
            </button>
          )}
          {(season.status === 'draft' || season.status === 'scheduled' || season.status === 'active') && (
            <button
              type="button"
              disabled={setStatus.isPending}
              onClick={() => setStatus.mutate({ seasonKey: season.seasonKey, status: 'closed' }, { onSuccess: onSaved })}
              className="px-2 py-1 rounded-md border border-red-500/30 bg-red-500/10 text-[10px] text-red-200 hover:bg-red-500/20"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {editable ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <label className="space-y-1">
            <span className="text-white/50">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-gray-800 px-2 py-1.5 text-base text-white"
            />
          </label>
          <label className="space-y-1">
            <span className="text-white/50">Theme</span>
            <input
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              placeholder="ember, gold, frost…"
              className="w-full rounded-lg border border-white/10 bg-gray-800 px-2 py-1.5 text-base text-white"
            />
          </label>
          <label className="space-y-1">
            <span className="text-white/50">Start</span>
            <input
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-gray-800 px-2 py-1.5 text-base text-white"
            />
          </label>
          <label className="space-y-1">
            <span className="text-white/50">End</span>
            <input
              type="datetime-local"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-gray-800 px-2 py-1.5 text-base text-white"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="button"
              disabled={upsert.isPending}
              onClick={() =>
                upsert.mutate(
                  {
                    seasonKey: season.seasonKey,
                    name,
                    theme: theme || null,
                    startAt: fromDatetimeLocalValue(startAt),
                    endAt: fromDatetimeLocalValue(endAt),
                    mostImprovedEnabled: season.mostImprovedEnabled,
                    sortOrder: season.sortOrder,
                  },
                  { onSuccess: onSaved },
                )
              }
              className="px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-100 text-xs font-medium hover:bg-amber-500/20"
            >
              {upsert.isPending ? 'Saving…' : 'Save season'}
            </button>
            {(upsert.isError || setStatus.isError) && (
              <p className="mt-1 text-[10px] text-red-300" role="alert">
                {upsert.error?.message ?? setStatus.error?.message}
              </p>
            )}
          </div>
        </div>
      ) : (
        <p className="text-[10px] sm:text-xs text-white/50">
          {season.name} · {season.theme ?? 'no theme'} · lifecycle-managed while {season.status}
        </p>
      )}
    </div>
  );
}

export function GamificationProgramAdminSection() {
  const { data: flags } = useGamificationPhase2AdminFlags();
  const { data: seasons = [], isLoading: seasonsLoading, refetch: refetchSeasons } = useGamificationProgramSeasons();
  const { data: campaigns = [], isLoading: campaignsLoading, refetch: refetchCampaigns } = useGamificationProgramCampaigns();
  const { data: challenges = [] } = useGamificationProgramChallenges();
  const upsertCampaign = useUpsertGamificationCampaign();
  const setCampaignActive = useSetGamificationCampaignActive();

  const [campaignKey, setCampaignKey] = useState('');
  const [challengeKey, setChallengeKey] = useState('compliance_sprint');
  const [campaignTitle, setCampaignTitle] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [multiplier, setMultiplier] = useState('1.00');

  const challengeOptions = useMemo(
    () => challenges.filter((c) => c.isActive),
    [challenges],
  );

  if (flags && !flags.isProgramAdmin) {
    return null;
  }

  const refresh = () => {
    void refetchSeasons();
    void refetchCampaigns();
  };

  return (
    <div className="rounded-xl border border-amber-500/20 bg-white/[0.02] p-3 sm:p-4 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div className="flex items-start gap-2">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" aria-hidden />
          <div>
            <h3 className="text-xs sm:text-sm font-semibold text-white">Phase 2 Program Admin</h3>
            <p className="text-[10px] sm:text-xs text-white/50 mt-0.5">
              Stage seasons and campaigns before kickoff. Staged rows stay inert until flags flip and you activate campaigns.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          <StatusChip
            label={flags?.phase2Enabled ? 'phase2 live' : 'phase2 dark'}
            tone={flags?.phase2Enabled ? 'emerald' : 'amber'}
          />
          <StatusChip
            label={flags?.challengesEnabled ? 'challenges on' : 'challenges dark'}
            tone={flags?.challengesEnabled ? 'emerald' : 'neutral'}
          />
          <StatusChip
            label={flags?.seasonsEnabled ? 'seasons on' : 'seasons dark'}
            tone={flags?.seasonsEnabled ? 'emerald' : 'neutral'}
          />
        </div>
      </div>

      {!flags?.phase2Enabled && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 flex items-start gap-2 text-[10px] sm:text-xs text-amber-100/90">
          <Moon className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden />
          <span>
            Master flag off — prep tooling is available, but payouts, lifecycle transitions, and owner nudges all no-op until kickoff.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <CalendarRange className="w-4 h-4 text-blue-300" aria-hidden />
            <h4 className="text-xs font-semibold text-white">Seasons</h4>
          </div>
          {seasonsLoading ? (
            <div className="h-24 rounded-lg border border-white/10 bg-white/[0.03] animate-pulse" />
          ) : (
            <div className="space-y-2">
              {seasons.map((season) => (
                <SeasonEditor key={season.seasonKey} season={season} onSaved={refresh} />
              ))}
            </div>
          )}
        </section>

        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-emerald-300" aria-hidden />
            <h4 className="text-xs font-semibold text-white">Campaigns</h4>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2 sm:p-3 space-y-2">
            <p className="text-[10px] text-white/50">New campaigns are staged (inactive) until you activate them after kickoff prep.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <label className="space-y-1 sm:col-span-2">
                <span className="text-white/50">Campaign key</span>
                <input
                  value={campaignKey}
                  onChange={(e) => setCampaignKey(e.target.value.trim().replace(/\s+/g, '_'))}
                  placeholder="q3_compliance_push"
                  className="w-full rounded-lg border border-white/10 bg-gray-800 px-2 py-1.5 text-base text-white"
                />
              </label>
              <label className="space-y-1 sm:col-span-2">
                <span className="text-white/50">Challenge</span>
                <select
                  value={challengeKey}
                  onChange={(e) => setChallengeKey(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-gray-800 px-2 py-1.5 text-base text-white"
                >
                  {challengeOptions.map((c) => (
                    <option key={c.challengeKey} value={c.challengeKey}>
                      {c.title} ({c.challengeKey})
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 sm:col-span-2">
                <span className="text-white/50">Title (optional)</span>
                <input
                  value={campaignTitle}
                  onChange={(e) => setCampaignTitle(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-gray-800 px-2 py-1.5 text-base text-white"
                />
              </label>
              <label className="space-y-1">
                <span className="text-white/50">Starts</span>
                <input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-gray-800 px-2 py-1.5 text-base text-white"
                />
              </label>
              <label className="space-y-1">
                <span className="text-white/50">Ends</span>
                <input
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-gray-800 px-2 py-1.5 text-base text-white"
                />
              </label>
              <label className="space-y-1">
                <span className="text-white/50">Multiplier ≥ 1.00</span>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={multiplier}
                  onChange={(e) => setMultiplier(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-gray-800 px-2 py-1.5 text-base text-white"
                />
              </label>
              <div className="flex items-end">
                <button
                  type="button"
                  disabled={upsertCampaign.isPending || !campaignKey || !startsAt || !endsAt}
                  onClick={() =>
                    upsertCampaign.mutate(
                      {
                        campaignKey,
                        challengeKey,
                        title: campaignTitle || null,
                        startsAt: fromDatetimeLocalValue(startsAt),
                        endsAt: fromDatetimeLocalValue(endsAt),
                        multiplier: Number(multiplier) || 1,
                      },
                      {
                        onSuccess: () => {
                          setCampaignKey('');
                          setCampaignTitle('');
                          refresh();
                        },
                      },
                    )
                  }
                  className="w-full px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-100 text-xs font-medium hover:bg-emerald-500/20 disabled:opacity-40"
                >
                  {upsertCampaign.isPending ? 'Staging…' : 'Stage campaign'}
                </button>
              </div>
            </div>
            {upsertCampaign.isError && (
              <p className="text-[10px] text-red-300" role="alert">{upsertCampaign.error.message}</p>
            )}
          </div>

          {campaignsLoading ? (
            <div className="h-16 rounded-lg border border-white/10 bg-white/[0.03] animate-pulse" />
          ) : campaigns.length === 0 ? (
            <p className="text-[10px] text-white/40">No campaigns staged yet.</p>
          ) : (
            <ul className="space-y-2">
              {campaigns.map((campaign) => (
                <li
                  key={campaign.campaignKey}
                  className="rounded-lg border border-white/10 bg-white/[0.02] p-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                >
                  <div>
                    <p className="text-xs text-white font-medium">
                      {campaign.title ?? campaign.campaignKey}
                    </p>
                    <p className="text-[10px] text-white/50">
                      {campaign.challengeKey} · {Number(campaign.multiplier).toFixed(2)}×
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusChip
                      label={campaign.isActive ? 'active' : 'staged'}
                      tone={campaign.isActive ? 'emerald' : 'amber'}
                    />
                    <button
                      type="button"
                      disabled={setCampaignActive.isPending}
                      onClick={() =>
                        setCampaignActive.mutate(
                          { campaignKey: campaign.campaignKey, isActive: !campaign.isActive },
                          { onSuccess: refresh },
                        )
                      }
                      className="px-2 py-1 rounded-md border border-white/10 bg-white/5 text-[10px] text-white/70 hover:text-white"
                    >
                      {campaign.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
