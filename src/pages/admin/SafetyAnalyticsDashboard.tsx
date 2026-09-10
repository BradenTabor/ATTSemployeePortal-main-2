/**
 * Legacy standalone analytics route. The hub is the real entry;
 * this page keeps the same body for anyone who still lands here.
 */

import { useState, memo } from 'react';
import { Shield } from 'lucide-react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { useAuth } from '../../contexts/AuthContext';
import { SafetyAnalyticsView } from '../../components/admin/safety-analytics';
import type { Period } from '../../lib/analytics';

function SafetyAnalyticsDashboard() {
  const { role } = useAuth();
  const [period, setPeriod] = useState<Period>('month');
  const canAccess = role === 'admin' || role === 'safety_officer';

  if (!canAccess) {
    return (
      <DashboardLayout title="Safety Analytics" pageHeading>
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="text-center">
            <Shield className="mx-auto mb-3 h-12 w-12 text-rose-400" aria-hidden />
            <h2 className="text-xl font-bold text-white">Access Denied</h2>
            <p className="mt-1 text-sm text-gray-400">Admin or Safety Officer access required.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Safety Analytics" pageHeading>
      <div className="px-3 pb-8 sm:px-4">
        <SafetyAnalyticsView period={period} onPeriodChange={setPeriod} />
      </div>
    </DashboardLayout>
  );
}

export default memo(SafetyAnalyticsDashboard);
