/**
 * Safety Analytics section for the Safety & Compliance Hub.
 * Period lives on the URL so a shared link opens the same window.
 */

import { useSearchParams } from 'react-router-dom';
import { SafetyAnalyticsView } from '../../../components/admin/safety-analytics';
import type { Period } from '../../../lib/analytics';

const PERIODS: Period[] = ['week', 'month', 'quarter', 'all'];

function readPeriod(value: string | null): Period {
  return PERIODS.includes(value as Period) ? (value as Period) : 'month';
}

export default function SafetyAnalyticsSection() {
  const [searchParams, setSearchParams] = useSearchParams();
  const period = readPeriod(searchParams.get('period'));

  const onPeriodChange = (next: Period) => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        params.set('section', 'analytics');
        if (next === 'month') params.delete('period');
        else params.set('period', next);
        return params;
      },
      { replace: true },
    );
  };

  return <SafetyAnalyticsView period={period} onPeriodChange={onPeriodChange} />;
}
