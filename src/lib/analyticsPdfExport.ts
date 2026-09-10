/**
 * Safety Analytics PDF export (Phase 2).
 * Generates a one-page PDF report with stats and leaderboard using jspdf.
 * Uses dynamic import so jspdf (~150KB) and jspdf-autotable (~50KB) are not
 * in the Safety Analytics page chunk—loaded only when user clicks Export PDF.
 */

import type { SafetyAnalyticsStats, UnifiedLeaderboardEntry } from '../hooks/queries/useSafetyAnalytics';

export interface AnalyticsPdfOptions {
  stats: SafetyAnalyticsStats;
  leaderboard: UnifiedLeaderboardEntry[];
  period: string;
  generatedAt: string;
}

export async function exportAnalyticsPdf(options: AnalyticsPdfOptions): Promise<void> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const { stats, leaderboard, period, generatedAt } = options;
  let y = 24;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Safety Analytics Report', 40, y);
  y += 8;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Period: ${period} | Generated: ${generatedAt}`, 40, y);
  y += 20;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Summary', 40, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const summaryLines = [
    `Field crew: ${stats.field_users ?? stats.total_users} (${stats.active_users} with activity)`,
    `Form fill: ${stats.form_fill_rate ?? stats.avg_compliance_rate}% (${stats.completed_form_slots ?? '—'} / ${stats.expected_form_slots ?? '—'} slots)`,
    `Full packet: ${stats.full_packet_rate ?? 0}% (${stats.days_with_full_packet ?? 0} person-days)`,
    `Announcement reach: ${stats.announcement_reach ?? stats.announcement_engagement_rate}%`,
    `Ledger points: ${stats.total_combined_points.toLocaleString()} (forms ${stats.total_compliance_points}, announce ${stats.total_announcement_points}, other ${stats.other_points ?? 0})`,
    `Recorded full-packet rate (includes empty attendance): ${stats.full_packet_among_recorded ?? 0}%`,
  ];
  summaryLines.forEach((line) => {
    doc.text(line, 40, y);
    y += 14;
  });
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Leaderboard (top 15)', 40, y);
  y += 6;

  const topN = leaderboard.slice(0, 15);
  autoTable(doc, {
    startY: y,
    head: [['Rank', 'Name', 'Role', 'Points', 'Fill %', 'Packet %', 'Streak']],
    body: topN.map((e) => [
      String(e.rank),
      e.full_name || '—',
      e.role || '—',
      String(e.total_points),
      `${e.form_fill_rate ?? e.compliance_rate ?? 0}%`,
      `${e.full_packet_rate ?? 0}%`,
      String(e.current_streak ?? 0),
    ]),
    theme: 'striped',
    headStyles: { fillColor: [22, 101, 52], fontSize: 9 },
    bodyStyles: { fontSize: 8 },
    margin: { left: 40 },
  });

  const docWithTable = doc as InstanceType<typeof jsPDF> & { lastAutoTable?: { finalY: number } };
  const finalY = docWithTable.lastAutoTable?.finalY ?? y;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('ATTS Safety Compliance System', 40, finalY + 16);
  doc.text('This report is for internal use.', 40, finalY + 24);

  doc.save(`Safety-Analytics-${period}-${new Date().toISOString().slice(0, 10)}.pdf`);
}
