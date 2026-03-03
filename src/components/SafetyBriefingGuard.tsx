/**
 * Redirects field-role users to /safety-briefing when they have not completed
 * today's briefing. Wrap dashboard routes so bookmarks/deep links cannot bypass.
 */

import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSafetyBriefingStatus } from '../hooks/useSafetyBriefing';
import LoadingScreen from './LoadingScreen';

interface SafetyBriefingGuardProps {
  children: ReactNode;
}

export default function SafetyBriefingGuard({ children }: SafetyBriefingGuardProps) {
  useAuth();
  const { mustComplete, isLoading } = useSafetyBriefingStatus();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (mustComplete) {
    return <Navigate to="/safety-briefing" replace />;
  }

  return <>{children}</>;
}
