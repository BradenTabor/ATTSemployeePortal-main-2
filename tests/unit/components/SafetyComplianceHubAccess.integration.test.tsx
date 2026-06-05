/**
 * Safety & Compliance Hub — Risk Calibration access-control tests
 *
 * Privilege gap (confirmed in analysis): the Risk Calibration section is
 * intended admin-only (hub comment "Risk Calibration tab hidden for
 * safety_officer", showRiskCalibration = isAdmin, original standalone route was
 * requiredRole="admin"). But the SECTION_RISK render keyed off `validSection`,
 * which was derived purely from the ?section= URL param with NO role check. So a
 * safety_officer reached the content via TWO doors:
 *   1. the shadowed /admin/risk-calibration redirect → ?section=risk-calibration
 *   2. a direct /admin/safety-compliance?section=risk-calibration URL
 * Hiding the tab was cosmetic; the section still mounted.
 *
 * Fix: enforce admin-only in the `validSection` derivation itself — a non-admin
 * requesting SECTION_RISK falls back to SECTION_ANALYTICS (same behavior as an
 * unknown section). Because `validSection` is the single chokepoint that decides
 * what renders, this closes BOTH doors at once: every path that sets
 * ?section=risk-calibration (redirect and direct URL alike) hits the same
 * coercion. These tests assert the param→render path directly via mocked
 * useSearchParams, so they cover the redirect and direct-URL cases identically.
 *
 * The four section bodies are mocked to lightweight markers — this suite is
 * about access routing, not section internals.
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderWithProviders, screen } from '../../utils/testHelpers';
import SafetyComplianceHub from '../../../src/pages/admin/SafetyComplianceHub';

const mocks = vi.hoisted(() => ({
  role: 'employee' as string,
  section: null as string | null,
}));

vi.mock('../../../src/contexts/AuthContext', () => ({
  useAuth: () => ({ role: mocks.role }),
}));

// Drive ?section= via a controllable mock; keep the rest of react-router-dom real
// (renderWithProviders still wraps in BrowserRouter). setSearchParams is a no-op
// here — we only read the param to choose the rendered section.
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useSearchParams: () => [
      new URLSearchParams(mocks.section ? `section=${mocks.section}` : ''),
      vi.fn(),
    ],
  };
});

// Avoid the lazy-loaded layout hanging in jsdom (mirrors other hub/admin tests).
vi.mock('../../../src/layouts/DashboardLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));

// Lightweight section markers so we can assert which section mounted.
vi.mock('../../../src/pages/admin/safety-compliance/SafetyAnalyticsSection', () => ({
  default: () => <div data-testid="section-analytics">Analytics Section</div>,
}));
vi.mock('../../../src/pages/admin/safety-compliance/RiskCalibrationSection', () => ({
  default: () => <div data-testid="section-risk">Risk Calibration Section</div>,
}));
vi.mock('../../../src/pages/admin/safety-compliance/ComplianceAuditSection', () => ({
  default: () => <div data-testid="section-audit">Compliance Audit Section</div>,
}));
vi.mock('../../../src/pages/admin/safety-compliance/BriefingComplianceSection', () => ({
  default: () => <div data-testid="section-briefing">Briefing Compliance Section</div>,
}));

// Section components are lazy; allow the Suspense boundary to resolve.
async function findSection(testId: string) {
  return screen.findByTestId(testId);
}

describe('SafetyComplianceHub — Risk Calibration access control', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.role = 'employee';
    mocks.section = null;
    // jsdom doesn't implement scrollIntoView, which AdminSegmentedControl calls
    // on mount in its mobile layout effect. Stub it so the real control renders.
    Element.prototype.scrollIntoView = vi.fn();
  });

  // --- The privilege fix: both doors for safety_officer ----------------------

  it('safety_officer + ?section=risk-calibration → risk content NOT rendered, falls back to analytics (direct-URL door)', async () => {
    mocks.role = 'safety_officer';
    mocks.section = 'risk-calibration';

    renderWithProviders(<SafetyComplianceHub />);

    // Fallback section renders instead of risk.
    expect(await findSection('section-analytics')).toBeInTheDocument();
    expect(screen.queryByTestId('section-risk')).not.toBeInTheDocument();
    // Tab is also hidden for non-admins (cosmetic gate still in place).
    expect(screen.queryByRole('tab', { name: /risk/i })).not.toBeInTheDocument();
  });

  it('safety_officer arriving via the /admin/risk-calibration redirect (same ?section=risk-calibration) → no risk content (redirect door)', async () => {
    // The legacy route is a <Navigate> to /admin/safety-compliance?section=risk-calibration,
    // so at the hub it is indistinguishable from the direct URL above: same param,
    // same validSection chokepoint. Covered by the same coercion.
    mocks.role = 'safety_officer';
    mocks.section = 'risk-calibration';

    renderWithProviders(<SafetyComplianceHub />);

    expect(await findSection('section-analytics')).toBeInTheDocument();
    expect(screen.queryByTestId('section-risk')).not.toBeInTheDocument();
  });

  // --- Admin regression guard ------------------------------------------------

  it('admin + ?section=risk-calibration → risk content IS rendered (admins unaffected)', async () => {
    mocks.role = 'admin';
    mocks.section = 'risk-calibration';

    renderWithProviders(<SafetyComplianceHub />);

    expect(await findSection('section-risk')).toBeInTheDocument();
    expect(screen.queryByTestId('section-analytics')).not.toBeInTheDocument();
    // Admin sees the Risk tab.
    expect(screen.getByRole('tab', { name: /risk/i })).toBeInTheDocument();
  });

  // --- Surgical: other sections must NOT be over-blocked ----------------------

  it('safety_officer + ?section=compliance-audit → audit content renders (entitled section, not over-blocked)', async () => {
    mocks.role = 'safety_officer';
    mocks.section = 'compliance-audit';

    renderWithProviders(<SafetyComplianceHub />);

    expect(await findSection('section-audit')).toBeInTheDocument();
    expect(screen.queryByTestId('section-risk')).not.toBeInTheDocument();
  });

  it('safety_officer + ?section=analytics → analytics renders (unchanged)', async () => {
    mocks.role = 'safety_officer';
    mocks.section = 'analytics';

    renderWithProviders(<SafetyComplianceHub />);

    expect(await findSection('section-analytics')).toBeInTheDocument();
  });

  it('safety_officer + ?section=briefing-compliance → briefing renders (unchanged)', async () => {
    mocks.role = 'safety_officer';
    mocks.section = 'briefing-compliance';

    renderWithProviders(<SafetyComplianceHub />);

    expect(await findSection('section-briefing')).toBeInTheDocument();
    expect(screen.queryByTestId('section-risk')).not.toBeInTheDocument();
  });

  it('safety_officer + no section param → defaults to analytics (unchanged)', async () => {
    mocks.role = 'safety_officer';
    mocks.section = null;

    renderWithProviders(<SafetyComplianceHub />);

    expect(await findSection('section-analytics')).toBeInTheDocument();
  });
});
