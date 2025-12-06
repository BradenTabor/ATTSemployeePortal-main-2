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
};

