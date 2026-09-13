import { EVENTS, deleteInterestById, exportIntents, hashToken, purgeExpired, readSummary, recordEvent, updateStatus, withdrawInterest, type PurchaseIntentDatabase } from "../db/intents";
import { handleInterestPost } from "./interest-handler";
import { json, readJson, sameOrigin } from "./request";

export type ApiEnv = { DB?: PurchaseIntentDatabase; ADMIN_TOKEN?: string; ENABLE_COMMERCE_SIMULATION?: string };
// Bounded, process-local endpoint buckets. No IP or visitor ID is collected.
// This protects a small local beta, not a distributed public service.
const buckets = new Map<string, { start: number; count: number }>();
export function allowRequest(key: string, now = Date.now(), limit = 120) {
  const bucket = buckets.get(key);
  if (!bucket || now - bucket.start >= 60000) {
    if (buckets.size >= 16 && !buckets.has(key)) buckets.delete(buckets.keys().next().value!);
    buckets.set(key, { start: now, count: 1 }); return true;
  }
  bucket.count += 1; return bucket.count <= limit;
}

export async function handleApi(request: Request, env: ApiEnv): Promise<Response> {
  const path = new URL(request.url).pathname;
  if (!sameOrigin(request)) return json({ ok: false }, 403);
  if (!allowRequest(path)) return json({ ok: false, error: "rate_limited" }, 429, { "retry-after": "60" });
  const admin = path.startsWith("/api/admin/");
  if (admin) {
    if (!env.ADMIN_TOKEN || env.ADMIN_TOKEN.length < 32) return json({ ok: false, error: "admin_not_configured" }, 503);
    const supplied = request.headers.get("authorization")?.match(/^Bearer (\S+)$/)?.[1] ?? "";
    if (await hashToken(supplied) !== await hashToken(env.ADMIN_TOKEN)) return json({ ok: false }, 401);
  }
  try {
    if (path === "/api/interest" && request.method === "POST") return handleInterestPost(request, env.DB);
    if (!env.DB) return json({ ok: false }, 503);
    if (path === "/api/interest" && request.method === "DELETE") {
      const input = await readJson(request);
      if (input instanceof Response) return input;
      const token = (input as { token?: unknown } | null)?.token;
      if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) return json({ ok: false }, 400);
      await withdrawInterest(env.DB, token); return json({ ok: true });
    }
    if (path === "/api/events" && request.method === "POST") {
      const input = await readJson(request);
      if (input instanceof Response) return input;
      const value = input as { event?: unknown; consent?: unknown } | null;
      if (!value || typeof value.event !== "string" || !(EVENTS as readonly string[]).includes(value.event) || value.consent !== true || Object.keys(value).some((key) => !["event", "consent"].includes(key))) return json({ ok: false }, 400);
      await recordEvent(env.DB, value.event); return json({ ok: true });
    }
    if (path === "/api/admin/summary" && request.method === "GET") return json({ ok: true, ...await readSummary(env.DB) });
    if (path === "/api/admin/export" && request.method === "GET") return new Response(await exportIntents(env.DB), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="zhihe-interests.csv"', "cache-control": "no-store", "x-content-type-options": "nosniff" } });
    if (path === "/api/admin/interest" && request.method === "PATCH") {
      const input = await readJson(request);
      if (input instanceof Response) return input;
      const value = input as { id?: unknown; status?: unknown } | null;
      if (!value || typeof value.id !== "string" || value.id.length > 64 || !["new", "contacted", "closed"].includes(String(value.status))) return json({ ok: false }, 400);
      await updateStatus(env.DB, value.id, String(value.status)); return json({ ok: true });
    }
    if (path === "/api/admin/interest" && request.method === "DELETE") {
      const input = await readJson(request);
      if (input instanceof Response) return input;
      const id = (input as { id?: unknown } | null)?.id;
      if (typeof id !== "string" || !id || id.length > 64) return json({ ok: false }, 400);
      await deleteInterestById(env.DB, id); return json({ ok: true });
    }
    if (path === "/api/admin/purge" && request.method === "POST") return json({ ok: true, cutoff: await purgeExpired(env.DB) });
    return json({ ok: false }, 405);
  } catch { console.error("api_operation_failed"); return json({ ok: false }, 503); }
}
