import type { SessionV1 } from '@swedevtools/livedoc-schema';

/**
 * Returns the effective "latest activity" timestamp for a session.
 * SessionV1.timestamp is the earliest run start, which is misleading for
 * recency comparisons. This helper returns the latest run's timestamp instead.
 */
export function getSessionLatestActivity(session: SessionV1): string {
  const runs = session.runs ?? [];
  if (runs.length === 0) return session.timestamp;

  return runs.reduce(
    (latest, run) => (run.timestamp > latest ? run.timestamp : latest),
    runs[0].timestamp
  );
}
