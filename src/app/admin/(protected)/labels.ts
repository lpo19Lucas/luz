export const STATUS_LABEL: Record<string, string> = {
  TRIAL: "Em teste",
  ACTIVE: "Ativa",
  PAST_DUE: "Pagamento pendente",
  CANCELLED: "Cancelada",
};

export const STATUS_COLOR: Record<string, "info" | "success" | "warning" | "default"> = {
  TRIAL: "info",
  ACTIVE: "success",
  PAST_DUE: "warning",
  CANCELLED: "default",
};

export const ACCESS_LABEL: Record<string, string> = {
  OK: "Em dia",
  GRACE: "Carência",
  BLOCKED: "Bloqueado",
};

export const ACCESS_COLOR: Record<string, "success" | "warning" | "error"> = {
  OK: "success",
  GRACE: "warning",
  BLOCKED: "error",
};

/** "YYYY-MM-DD" (calendário de Brasília) pra preencher input type=date. */
export function toDateInput(date: Date | null | undefined) {
  if (!date) return "";
  return new Date(date.getTime() - 3 * 60 * 60_000).toISOString().slice(0, 10);
}
