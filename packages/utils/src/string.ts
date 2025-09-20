export function parseBoolean<T>(
  value: string | undefined,
  defaultValue?: T
): boolean | T {
  if (!value) return defaultValue;

  if (typeof value === "boolean") return value;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  return defaultValue; // or throw an error if invalid
}
