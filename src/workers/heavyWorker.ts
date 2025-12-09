/**
 * Heavy Worker Template
 * 
 * A Web Worker template for offloading CPU-intensive tasks from the main thread.
 * This helps prevent UI blocking and improves responsiveness.
 * 
 * Usage:
 * 1. Copy and customize this template for your specific use case
 * 2. Import the worker in your component:
 *    const worker = new Worker(new URL('./heavyWorker.ts', import.meta.url), { type: 'module' })
 * 3. Post messages to the worker and handle responses
 * 
 * Example:
 *   worker.postMessage({ type: 'PROCESS_DATA', payload: largeDataSet });
 *   worker.onmessage = (e) => console.log('Result:', e.data);
 */

// Define message types for type safety
export interface WorkerMessage {
  type: string;
  payload?: unknown;
  id?: string;
}

export interface WorkerResponse {
  type: string;
  result?: unknown;
  error?: string;
  id?: string;
}

// Message type constants
export const WORKER_MESSAGES = {
  PROCESS_DATA: 'PROCESS_DATA',
  SORT_LARGE_ARRAY: 'SORT_LARGE_ARRAY',
  FILTER_COMPLEX: 'FILTER_COMPLEX',
  COMPUTE_STATS: 'COMPUTE_STATS',
  PARSE_JSON: 'PARSE_JSON',
} as const;

/**
 * Process large datasets without blocking the main thread
 */
function processLargeData<T>(data: T[], processor: (item: T) => T): T[] {
  return data.map(processor);
}

/**
 * Sort large arrays in the worker thread
 */
function sortLargeArray<T>(
  data: T[],
  compareFn?: (a: T, b: T) => number
): T[] {
  return [...data].sort(compareFn);
}

/**
 * Complex filtering with multiple conditions
 */
function filterComplex<T>(
  data: T[],
  predicates: ((item: T) => boolean)[]
): T[] {
  return data.filter((item) => predicates.every((predicate) => predicate(item)));
}

/**
 * Compute statistical aggregations
 */
function computeStats(numbers: number[]): {
  mean: number;
  median: number;
  min: number;
  max: number;
  sum: number;
  count: number;
  stdDev: number;
} {
  if (numbers.length === 0) {
    return { mean: 0, median: 0, min: 0, max: 0, sum: 0, count: 0, stdDev: 0 };
  }

  const sorted = [...numbers].sort((a, b) => a - b);
  const sum = numbers.reduce((acc, n) => acc + n, 0);
  const mean = sum / numbers.length;
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
  
  const variance = numbers.reduce((acc, n) => acc + Math.pow(n - mean, 2), 0) / numbers.length;
  const stdDev = Math.sqrt(variance);

  return {
    mean,
    median,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    sum,
    count: numbers.length,
    stdDev,
  };
}

/**
 * Parse large JSON strings without blocking
 */
function parseJsonSafely(jsonString: string): { success: boolean; data?: unknown; error?: string } {
  try {
    const data = JSON.parse(jsonString);
    return { success: true, data };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown parse error' };
  }
}

// Worker message handler
self.onmessage = function (event: MessageEvent<WorkerMessage>) {
  const { type, payload, id } = event.data;

  try {
    let result: unknown;

    switch (type) {
      case WORKER_MESSAGES.PROCESS_DATA:
        result = processLargeData(
          payload as unknown[],
          (item) => item // Replace with actual processor
        );
        break;

      case WORKER_MESSAGES.SORT_LARGE_ARRAY:
        result = sortLargeArray(payload as unknown[]);
        break;

      case WORKER_MESSAGES.FILTER_COMPLEX:
        // Expects { data: T[], predicates: serialized predicates }
        const filterPayload = payload as { data: unknown[]; filterFn?: string };
        // Note: Functions can't be passed directly to workers
        // You'd need to define filter logic here or pass serializable filter config
        result = filterPayload.data;
        break;

      case WORKER_MESSAGES.COMPUTE_STATS:
        result = computeStats(payload as number[]);
        break;

      case WORKER_MESSAGES.PARSE_JSON:
        result = parseJsonSafely(payload as string);
        break;

      default:
        throw new Error(`Unknown message type: ${type}`);
    }

    const response: WorkerResponse = { type: 'SUCCESS', result, id };
    self.postMessage(response);
  } catch (error) {
    const response: WorkerResponse = {
      type: 'ERROR',
      error: error instanceof Error ? error.message : 'Unknown error',
      id,
    };
    self.postMessage(response);
  }
};

// Export types for main thread usage
export type { WorkerMessage as HeavyWorkerMessage, WorkerResponse as HeavyWorkerResponse };

