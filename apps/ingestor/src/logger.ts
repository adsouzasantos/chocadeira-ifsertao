type Level = "debug" | "info" | "warn" | "error";
const order: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

/** Registro em uma linha por evento, com horário ISO, adequado a qualquer hospedagem. */
export function createLogger(minLevel: Level = "info") {
  const write = (level: Level, message: string, data?: Record<string, unknown>) => {
    if (order[level] < order[minLevel]) return;
    const line = `${new Date().toISOString()} ${level.toUpperCase().padEnd(5)} ${message}${
      data ? ` ${JSON.stringify(data)}` : ""
    }`;
    (level === "error" || level === "warn" ? console.error : console.log)(line);
  };
  return {
    debug: (m: string, d?: Record<string, unknown>) => write("debug", m, d),
    info: (m: string, d?: Record<string, unknown>) => write("info", m, d),
    warn: (m: string, d?: Record<string, unknown>) => write("warn", m, d),
    error: (m: string, d?: Record<string, unknown>) => write("error", m, d),
  };
}

export type Logger = ReturnType<typeof createLogger>;
