/**
 * Minimal structured logger.
 *
 * Emits single-line JSON in production (machine-parseable for log aggregation)
 * and human-readable colored output in development. Zero dependencies so it is
 * safe to import from Server Components, Server Actions, Route Handlers, and
 * background jobs alike.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function activeLevel(): LogLevel {
  const raw = (process.env.LOG_LEVEL || "").toLowerCase();
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") {
    return raw;
  }
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

function serializeError(err: unknown) {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
    };
  }
  return err;
}

type Fields = Record<string, unknown>;

function normalize(fields?: Fields): Fields | undefined {
  if (!fields) return undefined;
  const out: Fields = {};
  for (const [k, v] of Object.entries(fields)) {
    out[k] = k === "error" || k === "err" ? serializeError(v) : v;
  }
  return out;
}

function emit(level: LogLevel, message: string, fields?: Fields) {
  if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[activeLevel()]) return;

  const time = new Date().toISOString();
  const norm = normalize(fields);

  if (process.env.NODE_ENV === "production") {
    // Single-line JSON for aggregators.
    const line = JSON.stringify({ time, level, message, ...norm });
    (level === "error" ? console.error : console.log)(line);
    return;
  }

  // Dev: readable output.
  const prefix = `[${level.toUpperCase()}]`;
  if (norm && Object.keys(norm).length > 0) {
    (level === "error" ? console.error : console.log)(prefix, message, norm);
  } else {
    (level === "error" ? console.error : console.log)(prefix, message);
  }
}

export const logger = {
  debug: (message: string, fields?: Fields) => emit("debug", message, fields),
  info: (message: string, fields?: Fields) => emit("info", message, fields),
  warn: (message: string, fields?: Fields) => emit("warn", message, fields),
  error: (message: string, fields?: Fields) => emit("error", message, fields),
  /** Create a child logger that always includes the given context fields. */
  child(context: Fields) {
    return {
      debug: (message: string, fields?: Fields) =>
        emit("debug", message, { ...context, ...fields }),
      info: (message: string, fields?: Fields) =>
        emit("info", message, { ...context, ...fields }),
      warn: (message: string, fields?: Fields) =>
        emit("warn", message, { ...context, ...fields }),
      error: (message: string, fields?: Fields) =>
        emit("error", message, { ...context, ...fields }),
    };
  },
};

export type Logger = typeof logger;
