/**
 * Small concurrency helpers for the submission/upload path.
 *
 * Field photos used to be uploaded strictly one after another, so a DVIR with
 * five photos on LTE paid five full round-trips (compress → PUT → ack) in
 * series. Running them with bounded concurrency keeps the radio busy without
 * opening more sockets than mobile Safari is happy with.
 */

/** Default parallelism for photo uploads. 3 is a safe ceiling for iOS Safari over cellular. */
export const UPLOAD_CONCURRENCY = 3;

/**
 * Map `items` through `fn` with at most `limit` promises in flight.
 * Results are returned in input order. Rejects on the first failure but only
 * after every in-flight task has settled (so callers can still see partial
 * successes via `mapSettledWithConcurrency`).
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const settled = await mapSettledWithConcurrency(items, limit, fn);
  const results: R[] = [];
  for (const s of settled) {
    if (s.status === "rejected") throw s.reason;
    results.push(s.value);
  }
  return results;
}

/**
 * Like `Promise.allSettled` but with bounded concurrency and stable ordering.
 */
export async function mapSettledWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  const workerCount = Math.max(1, Math.min(limit, items.length));

  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      try {
        results[i] = { status: "fulfilled", value: await fn(items[i], i) };
      } catch (reason) {
        results[i] = { status: "rejected", reason };
      }
    }
  };

  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
}

/**
 * Upload a batch of files in parallel and return the storage paths in order.
 * Paths from successful uploads are pushed onto `uploadedPaths` even if a
 * sibling fails, so the caller's rollback can remove the orphans.
 */
export async function uploadBatch<T>(
  entries: readonly T[],
  upload: (entry: T, index: number) => Promise<string>,
  uploadedPaths: string[],
  limit: number = UPLOAD_CONCURRENCY,
): Promise<string[]> {
  const settled = await mapSettledWithConcurrency(entries, limit, upload);
  const paths: string[] = [];
  let firstError: unknown = null;
  for (const s of settled) {
    if (s.status === "fulfilled") {
      paths.push(s.value);
      uploadedPaths.push(s.value);
    } else if (firstError === null) {
      firstError = s.reason;
    }
  }
  if (firstError !== null) throw firstError;
  return paths;
}
