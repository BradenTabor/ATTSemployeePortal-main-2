/**
 * Request Time Off (RTO) Test Data Factory
 * 
 * Creates valid and invalid RTO test data for unit and integration tests.
 */

export interface RTOTestData {
  full_name: string;
  email: string;
  phone_number?: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  reason: string;
  notes?: string;
  status?: 'pending' | 'approved' | 'denied';
  user_id?: string;
}

/**
 * Create a valid RTO request
 */
export function createValidRTO(overrides?: Partial<RTOTestData>): RTOTestData {
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() + 7); // 1 week from now
  
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 2); // 3-day request
  
  return {
    full_name: 'Test Employee',
    email: 'test-employee@atts.test',
    phone_number: '555-0100',
    start_date: startDate.toISOString().split('T')[0],
    end_date: endDate.toISOString().split('T')[0],
    start_time: '08:00',
    end_time: '17:00',
    reason: 'vacation',
    notes: 'Annual family vacation',
    status: 'pending',
    ...overrides,
  };
}

/**
 * Create RTO request for single day
 */
export function createSingleDayRTO(overrides?: Partial<RTOTestData>): RTOTestData {
  const date = new Date();
  date.setDate(date.getDate() + 14); // 2 weeks from now
  const dateStr = date.toISOString().split('T')[0];
  
  return createValidRTO({
    start_date: dateStr,
    end_date: dateStr,
    start_time: '08:00',
    end_time: '12:00',
    reason: 'personal',
    notes: 'Half day for appointment',
    ...overrides,
  });
}

/**
 * Create RTO request missing required fields
 */
export function createRTOMissingDates(): Partial<RTOTestData> {
  return {
    full_name: 'Test Employee',
    email: 'test@atts.test',
    reason: 'vacation',
  };
}

/**
 * Create RTO request with invalid date range
 */
export function createRTOInvalidDateRange(): RTOTestData {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 14);
  
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 7); // End before start
  
  return createValidRTO({
    start_date: startDate.toISOString().split('T')[0],
    end_date: endDate.toISOString().split('T')[0],
  });
}

/**
 * Create RTO request with past dates
 */
export function createRTOPastDates(): RTOTestData {
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 7);
  
  return createValidRTO({
    start_date: pastDate.toISOString().split('T')[0],
    end_date: pastDate.toISOString().split('T')[0],
  });
}

/**
 * RTO reasons
 */
export const RTO_REASONS = [
  'vacation',
  'personal',
  'medical',
  'family',
  'other',
] as const;

/**
 * Create approved RTO
 */
export function createApprovedRTO(overrides?: Partial<RTOTestData>): RTOTestData {
  return createValidRTO({
    status: 'approved',
    ...overrides,
  });
}

/**
 * Create denied RTO
 */
export function createDeniedRTO(overrides?: Partial<RTOTestData>): RTOTestData {
  return createValidRTO({
    status: 'denied',
    ...overrides,
  });
}
