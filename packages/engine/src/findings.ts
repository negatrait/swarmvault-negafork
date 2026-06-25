// TODO: Port this module to Go, adhering to the 1:1 structural port paradigm (mirroring directory structures and data models) and ensuring 100% output parity.
export type FindingSeverity = "error" | "warning" | "info";

export function normalizeFindingSeverity(value: unknown): FindingSeverity {
  if (typeof value !== "string") {
    return "info";
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "error" || normalized === "critical" || normalized === "fatal" || normalized === "high" || normalized === "severe") {
    return "error";
  }
  if (
    normalized === "warning" ||
    normalized === "warn" ||
    normalized === "medium" ||
    normalized === "moderate" ||
    normalized === "caution"
  ) {
    return "warning";
  }
  return "info";
}
