export function formatGen(wei: bigint): string {
  const negative = wei < 0n;
  const absolute = negative ? -wei : wei;
  const whole = absolute / 10n ** 18n;
  const fraction = (absolute % 10n ** 18n).toString().padStart(18, "0").replace(/0+$/, "").slice(0, 6);
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""} GEN`;
}

export function shortHash(value: string): string {
  if (value.length <= 18) return value;
  return `${value.slice(0, 10)}…${value.slice(-6)}`;
}

export function formatDeadline(epochSeconds: number): string {
  if (!epochSeconds) return "Not set";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(epochSeconds * 1_000)) + " UTC";
}

export function countdown(deadline: number, nowSeconds: number): string {
  const remaining = deadline - nowSeconds;
  if (remaining < 0) return "Window closed";
  if (remaining === 0) return "Closes this second";
  const days = Math.floor(remaining / 86_400);
  const hours = Math.floor((remaining % 86_400) / 3_600);
  const minutes = Math.floor((remaining % 3_600) / 60);
  if (days) return `${days}d ${hours}h remaining`;
  if (hours) return `${hours}h ${minutes}m remaining`;
  return `${Math.max(1, minutes)}m remaining`;
}
