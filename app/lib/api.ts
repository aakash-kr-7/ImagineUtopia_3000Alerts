export async function api(path: string, options?: RequestInit) {
  const r = await fetch("/api/" + path, {
    ...options,
    headers: { "content-type": "application/json", ...options?.headers },
  });
  const data: any = await r.json();
  if (!r.ok) throw new Error(data.error ?? "Request failed");
  return data;
}
export const fmt = (n: number) => n.toLocaleString("en-US");
export const time = (s: string) =>
  new Date(s).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
export const short = (s: string) =>
  s.replace("INC-", "").slice(0, 8).toUpperCase();

export const pct = (n: number | null) =>
  n === null ? "—" : (n * 100).toFixed(1) + "%";
