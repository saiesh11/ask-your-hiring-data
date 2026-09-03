/**
 * Minimal structured logger: one JSON object per line, no dependency.
 *
 * Quiet during tests unless a sink is attached with {@link setLogSink} — that
 * lets a test assert on what was logged without every other test spamming the
 * console.
 */

export type LogLevel = "info" | "warn" | "error";

export type LogFields = Record<string, unknown>;

type Sink = (record: Record<string, unknown>) => void;

let sink: Sink | null = null;

/** Redirect log output (used by tests). Pass `null` to restore default behavior. */
export function setLogSink(next: Sink | null): void {
  sink = next;
}

function emit(level: LogLevel, event: string, fields: LogFields): void {
  const record = { ts: new Date().toISOString(), level, event, ...fields };
  if (sink) {
    sink(record);
    return;
  }
  if (process.env.NODE_ENV === "test") return;
  const line = JSON.stringify(record);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (event: string, fields: LogFields = {}) => emit("info", event, fields),
  warn: (event: string, fields: LogFields = {}) => emit("warn", event, fields),
  error: (event: string, fields: LogFields = {}) => emit("error", event, fields),
};
