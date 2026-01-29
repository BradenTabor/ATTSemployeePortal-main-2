/**
 * Safety Analytics PDF export (Phase 2).
 * Generates a one-page PDF report with stats and leaderboard using jspdf.
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { SafetyAnalyticsStats, UnifiedLeaderboardEntry } from '../hooks/queries/useSafetyAnalytics';

export interface AnalyticsPdfOptions {
  stats: SafetyAnalyticsStats;
  leaderboard: UnifiedLeaderboardEntry[];
  period: string;
  generatedAt: string;
}

export function exportAnalyticsPdf(options: AnalyticsPdfOptions): void {
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
    `Active users: ${stats.active_users} / ${stats.total_users}`,
    `Total points: ${stats.total_combined_points.toLocaleString()}`,
    `Avg. compliance rate: ${stats.avg_compliance_rate}%`,
    `Full compliance days: ${stats.total_compliance_days}`,
    `Announcement engagement: ${stats.announcement_engagement_rate}%`,
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
    head: [['Rank', 'Name', 'Role', 'Points', 'Compliance %', 'Streak']],
    body: topN.map((e) => [
      String(e.rank),
      e.full_name || '—',
      e.role || '—',
      String(e.total_points),
      `${e.compliance_rate ?? 0}%`,
      String(e.current_streak ?? 0),
    ]),
    theme: 'striped',
    headStyles: { fillColor: [22, 101, 52], fontSize: 9 },
    bodyStyles: { fontSize: 8 },
    margin: { left: 40 },
  });

  const docWithTable = doc as jsPDF & { lastAutoTable?: { finalY: number } };
  const finalY = docWithTable.lastAutoTable?.finalY ?? y;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('ATTS Safety Compliance System', 40, finalY + 16);
  doc.text('This report is for internal use.', 40, finalY + 24);

  doc.save(`Safety-Analytics-${period}-${new Date().toISOString().slice(0, 10)}.pdf`);
}
