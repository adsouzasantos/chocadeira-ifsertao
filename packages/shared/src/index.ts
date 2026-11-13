export * from "./schemas/auth";
export * from "./schemas/incubator";
export * from "./schemas/telemetry";
export * from "./schemas/alarm-settings";
export * from "./alarms";

/**
 * Converte os erros de validação do Zod em um mapa campo → primeira mensagem,
 * formato usado pelos formulários da aplicação.
 */
export function fieldErrorsFrom(issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>) {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    if (!(key in errors)) errors[key] = issue.message;
  }
  return errors;
}
