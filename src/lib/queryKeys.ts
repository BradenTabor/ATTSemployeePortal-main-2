/**
 * Centralized query key management
 * Ensures consistent keys and easy invalidation
 */
export const queryKeys = {
  // Auth
  auth: {
    session: ['auth', 'session'] as const,
    user: ['auth', 'user'] as const,
  },

  // Users / Crew
  users: {
    all: ['users'] as const,
    list: (filters?: { role?: string; search?: string }) =>
      ['users', 'list', filters] as const,
    detail: (userId: string) => ['users', 'detail', userId] as const,
  },

  // Jobs
  jobs: {
    all: ['jobs'] as const,
    list: (filters?: { status?: string; search?: string }) =>
      ['jobs', 'list', filters] as const,
    detail: (jobId: string) => ['jobs', 'detail', jobId] as const,
    assigned: (userId: string) => ['jobs', 'assigned', userId] as const,
  },

  // RTO Requests
  rto: {
    all: ['rto'] as const,
    list: (filters?: { status?: string }) => ['rto', 'list', filters] as const,
    detail: (requestId: string) => ['rto', 'detail', requestId] as const,
    user: (userId: string) => ['rto', 'user', userId] as const,
  },

  // Announcements
  announcements: {
    all: ['announcements'] as const,
    latest: ['announcements', 'latest'] as const,
  },

  // Announcement Rewards
  rewards: {
    all: ['announcement-rewards'] as const,
    userRewards: (userId: string) => ['announcement-rewards', 'user', userId] as const,
    totalPoints: (userId: string) => ['announcement-rewards', 'total-points', userId] as const,
    claimed: (userId: string, announcementId: string) =>
      ['announcement-rewards', 'claimed', userId, announcementId] as const,
  },

  // Contact Requests
  contactRequests: {
    all: ['contactRequests'] as const,
    list: (filters?: { topic?: string }) =>
      ['contactRequests', 'list', filters] as const,
  },

  // JSA
  jsa: {
    all: ['jsa'] as const,
    list: (filters?: { status?: string; date?: string }) =>
      ['jsa', 'list', filters] as const,
    detail: (jsaId: string) => ['jsa', 'detail', jsaId] as const,
    adminList: (params: {
      page: number;
      pageSize: number;
      statusFilter: string;
      dateFilter?: string;
      dateEndFilter?: string;
      searchQuery?: string;
      signatureFilter?: string;
      userFilter?: string;
      sortField: string;
      sortDirection: string;
    }) => ['jsa', 'admin', 'list', params] as const,
  },

  // DVIR
  dvir: {
    all: ['dvir'] as const,
    list: (filters?: { status?: string; date?: string }) =>
      ['dvir', 'list', filters] as const,
    detail: (dvirId: string) => ['dvir', 'detail', dvirId] as const,
  },

  // Equipment
  equipment: {
    all: ['equipment'] as const,
    list: (filters?: { status?: string }) =>
      ['equipment', 'list', filters] as const,
    detail: (equipmentId: string) => ['equipment', 'detail', equipmentId] as const,
  },

  // Compliance Status (for dashboard)
  compliance: {
    today: (userId: string, date: string) => ['compliance', 'today', userId, date] as const,
  },

  // Pending Defects (for mechanic dashboard)
  pendingDefects: () => ['pendingDefects'] as const,

  // Risk Calibration (for admin dashboard)
  riskCalibration: {
    autoTuningConfig: ['riskCalibration', 'autoTuningConfig'] as const,
    tuningDecisions: (limit: number) => ['riskCalibration', 'tuningDecisions', limit] as const,
    tuningRuns: ['riskCalibration', 'tuningRuns'] as const,
    accuracyStats: (days: number) => ['riskCalibration', 'accuracy', days] as const,
    riskHistory: (dateRange: { start: string; end: string }) => 
      ['riskCalibration', 'history', dateRange] as const,
    activeConfig: ['riskCalibration', 'activeConfig'] as const,
  },

  // Safety Incidents (for risk calibration)
  safetyIncidents: {
    all: ['safetyIncidents'] as const,
    list: (dateRange: { start: string; end: string }) =>
      ['safetyIncidents', 'list', dateRange] as const,
    detail: (incidentId: string) => ['safetyIncidents', 'detail', incidentId] as const,
  },

  // Rapid Reporting (OSHA 8/24hr countdown)
  rapidReporting: ['rapidReporting'] as const,

  // Corrective Actions (CAPA)
  correctiveActions: {
    all: ['correctiveActions'] as const,
    byIncident: (incidentId: string) => ['correctiveActions', 'incident', incidentId] as const,
    open: ['correctiveActions', 'open'] as const,
  },

  // Certifications
  certifications: {
    all: ['certifications'] as const,
    list: (userId?: string) => ['certifications', 'list', userId] as const,
    detail: (certId: string) => ['certifications', 'detail', certId] as const,
    tests: (certId: string) => ['certifications', 'tests', certId] as const,
    reportsPassRate: (since: string) => ['certifications', 'reports', 'pass-rate', since] as const,
    reportsTimeToGrade: () => ['certifications', 'reports', 'time-to-grade'] as const,
    reportsCompliance: () => ['certifications', 'reports', 'compliance'] as const,
    auditLog: (limit?: number) => ['certifications', 'audit-log', limit ?? 50] as const,
    workerInternalRecords: (userId: string) =>
      ['certifications', 'worker-internal-records', userId] as const,
    allActiveRecords: () => ['certifications', 'all-active-records'] as const,
  },

  // Near-Miss Reports
  nearMiss: {
    all: ['nearMiss'] as const,
    list: (filters?: { category?: string; dateFrom?: string; dateTo?: string }) =>
      ['nearMiss', 'list', filters] as const,
    detail: (reportId: string) => ['nearMiss', 'detail', reportId] as const,
  },

  // Resources / Study Guides
  resources: {
    all: ['resources'] as const,
    list: (category?: string) => ['resources', 'list', category] as const,
    detail: (resourceId: string) => ['resources', 'detail', resourceId] as const,
  },

  // External Certifications (admin-managed certs earned outside ATTS)
  externalCertifications: {
    all: ['external-certifications'] as const,
    types: () => ['external-certifications', 'types'] as const,
    byWorker: (userId: string) => ['external-certifications', 'worker', userId] as const,
    allWorkers: () => ['external-certifications', 'all-workers'] as const,
  },

  // Worker Qualifications (OSHA 1910.269(r) electrical levels)
  workerQualifications: {
    all: ['worker-qualifications'] as const,
    list: (filterLevel?: string) => ['worker-qualifications', 'all', filterLevel] as const,
    crew: (userIds: string[]) => ['worker-qualifications', 'crew', userIds] as const,
    history: (userId: string) => ['worker-qualifications', 'history', userId] as const,
  },

  // Safety Briefing (daily mandatory for field roles)
  safetyBriefing: {
    all: ['safety-briefing'] as const,
    status: (userId: string, date: string) =>
      ['safety-briefing', 'status', userId, date] as const,
    personalizedContent: (userId: string) =>
      ['safety-briefing', 'personalized', userId] as const,
    streak: (userId: string) => ['safety-briefing', 'streak', userId] as const,
    crewCompletion: (userId: string, date: string) =>
      ['safety-briefing', 'crew-completion', userId, date] as const,
    announcementDates: (since: string) =>
      ['safety-briefing', 'announcement-dates', since] as const,
    dailySnapshot: (date: string) =>
      ['safety-briefing', 'daily-snapshot', date] as const,
  },

  // Briefing Compliance (admin dashboard)
  briefingCompliance: {
    summary: (startDate: string, endDate: string) =>
      ['briefingCompliance', 'summary', startDate, endDate] as const,
  },

  // Notification preferences (certification_granted, certification_expiry)
  notificationPreferences: {
    all: ['notification-preferences'] as const,
    user: (userId: string) => ['notification-preferences', 'user', userId] as const,
  },

  // Safety Rewards (monthly raffle)
  safetyRewards: {
    reward: (year: number, month: number) =>
      ['safety-rewards', 'reward', year, month] as const,
    drawing: (year: number, month: number) =>
      ['safety-rewards', 'drawing', year, month] as const,
    userEntries: (userId: string, year: number, month: number) =>
      ['safety-rewards', 'user-entries', userId, year, month] as const,
    totalEntries: (year: number, month: number) =>
      ['safety-rewards', 'total-entries', year, month] as const,
    allRewards: ['safety-rewards', 'all'] as const,
    pastWinners: (limit: number) =>
      ['safety-rewards', 'past-winners', limit] as const,
  },
};

