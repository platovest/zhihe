import { allOrders, createOrder, deleteClosedOrder, findOrder, hasAccess, sessionOrders, transitionOrder, type Order, type OrderStatus } from "../db/commerce";
import { hashToken } from "../db/intents";
import { allowRequest, type ApiEnv } from "./api";
import { json, readJson, sameOrigin } from "./request";
import { catalog, lessons } from "../content/courses";

const COOKIE_NAME = "zhihe_local_session";
const mode = "local_simulation";
const uuid = /^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;
function reply(body: Record<string, unknown>, status = 200, headers: Record<string, string> = {}) {
  return json({ mode, ...body }, status, headers);
}
function sessionKey(request: Request) {
  const token = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
  return token && /^[a-f\d]{64}$/.test(token) ? token : null;
}
function sessionCookie(token: string, request: Request, clear = false) {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict${clear ? "; Max-Age=0" : ""}${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
}
function randomKey() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (value) => value.toString(16).padStart(2, "0")).join("");
}
async function parseBody(request: Request) {
  const value = await readJson(request);
  if (value instanceof Response) return reply({ ok: false, error: value.status === 413 ? "body_too_large" : value.status === 415 ? "unsupported_content_type" : "invalid_input" }, value.status);
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : reply({ ok: false, error: "invalid_input" }, 400);
}

export async function handleCommerce(request: Request, env: ApiEnv): Promise<Response> {
  const url = new URL(request.url);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) return reply({ ok: false, error: "local_only" }, 403);
  if (!sameOrigin(request)) return reply({ ok: false, error: "cross_origin" }, 403);
  if (!allowRequest("commerce", Date.now(), 240)) return reply({ ok: false, error: "rate_limited" }, 429, { "retry-after": "60" });
  const admin = url.pathname.startsWith("/api/admin/commerce");
  // Test-only orders must never grant customer access. This flag is reserved
  // for isolated engineering tests, not the normal local product.
  if (!admin && env.ENABLE_COMMERCE_SIMULATION !== "true") {
    const mode = "paid_courses";
    if (url.pathname === "/api/catalog" && request.method === "GET") return reply({ mode, ok: true, lessons: catalog });
    if (url.pathname.startsWith("/api/lessons/") && request.method === "GET") {
      const lesson = lessons.find((item) => item.slug === url.pathname.slice("/api/lessons/".length));
      if (!lesson) return reply({ mode, ok: false, error: "not_found" }, 404);
      if (lesson.slug === "expression") return reply({ mode, ok: true, lesson });
      return reply({ mode, ok: false, error: "purchase_required" }, 403);
    }
    if (url.pathname === "/api/commerce/me" && request.method === "GET") return reply({ mode, ok: true, orders: [], access: false, paymentAvailable: false });
    return reply({ mode, ok: false, error: "payment_unavailable" }, 503);
  }
  if (admin) {
    if (!env.ADMIN_TOKEN || env.ADMIN_TOKEN.length < 32) return reply({ ok: false, error: "admin_not_configured" }, 503);
    const supplied = request.headers.get("authorization")?.match(/^Bearer (\S+)$/)?.[1] ?? "";
    if (await hashToken(supplied) !== await hashToken(env.ADMIN_TOKEN)) return reply({ ok: false, error: "unauthorized" }, 401);
  }
  if (url.pathname === "/api/catalog") {
    return request.method === "GET" ? reply({ ok: true, lessons: catalog }) : reply({ ok: false, error: "method_not_allowed" }, 405);
  }
  if (url.pathname.startsWith("/api/lessons/")) {
    if (request.method !== "GET") return reply({ ok: false, error: "method_not_allowed" }, 405);
    const slug = url.pathname.slice("/api/lessons/".length);
    const lesson = lessons.find((item) => item.slug === slug);
    if (!lesson) return reply({ ok: false, error: "not_found" }, 404);
    if (lesson.slug === "expression") return reply({ ok: true, lesson });
    const key = sessionKey(request);
    if (!key) return reply({ ok: false, error: "access_required" }, 403);
    if (!env.DB) return reply({ ok: false, error: "database_unavailable" }, 503);
    try {
      if (!hasAccess(await sessionOrders(env.DB, await hashToken(key)))) return reply({ ok: false, error: "access_required" }, 403);
      return reply({ ok: true, lesson });
    } catch { console.error("local_lesson_access_failed"); return reply({ ok: false, error: "database_unavailable" }, 503); }
  }
  if (!env.DB) return reply({ ok: false, error: "database_unavailable" }, 503);
  const database = env.DB;
  try {
    let token = sessionKey(request);
    let sessionHash = token ? await hashToken(token) : null;
    if (url.pathname === "/api/commerce/me" && request.method === "GET") {
      const orders = sessionHash ? await sessionOrders(database, sessionHash) : [];
      return reply({ ok: true, orders, access: hasAccess(orders) });
    }
    if (url.pathname === "/api/admin/commerce" && request.method === "GET") return reply({ ok: true, orders: await allOrders(database) });
    if (request.method !== "POST") return reply({ ok: false, error: "method_not_allowed" }, 405);
    const body = await parseBody(request);
    if (body instanceof Response) return body;
    if (url.pathname === "/api/commerce/logout") return reply({ ok: true }, 200, { "set-cookie": sessionCookie("", request, true) });
    if (url.pathname === "/api/commerce/orders") {
      if (body.consent !== true || typeof body.idempotencyKey !== "string" || !uuid.test(body.idempotencyKey) || Object.keys(body).some((key) => !["consent", "idempotencyKey"].includes(key))) return reply({ ok: false, error: "invalid_input" }, 400);
      if (!sessionHash || !(await sessionOrders(database, sessionHash)).length) {
        token = randomKey(); sessionHash = await hashToken(token);
      }
      const order = await createOrder(database, sessionHash, body.idempotencyKey);
      if (!order) return reply({ ok: false, error: "idempotency_conflict" }, 409);
      return reply({ ok: true, order, access: hasAccess(await sessionOrders(database, sessionHash)) }, 200, { "set-cookie": sessionCookie(token!, request) });
    }
    const action = url.pathname.match(/^\/api\/(commerce\/orders|admin\/commerce)\/([a-f\d-]+)\/(pay|cancel|refund|delete)$/i);
    if (!action || !uuid.test(action[2])) return reply({ ok: false, error: "not_found" }, 404);
    const [, , id, operation] = action;
    if (!admin && !sessionHash) return reply({ ok: false, error: "not_found" }, 404);
    const order = await findOrder(database, id, admin ? undefined : sessionHash!);
    if (!order) return reply({ ok: false, error: "not_found" }, 404);
    if (operation !== "pay" && Object.keys(body).length) return reply({ ok: false, error: "invalid_input" }, 400);
    let updated: Order | null = order;
    let expected: OrderStatus;
    if (admin) {
      if (operation === "delete") {
        if (!["cancelled", "simulated_refunded"].includes(order.status)) return reply({ ok: false, error: "only_closed_orders_deletable" }, 409);
        await deleteClosedOrder(database, id); return reply({ ok: true });
      }
      if (operation !== "refund") return reply({ ok: false, error: "method_not_allowed" }, 405);
      expected = "simulated_refunded";
      if (order.status === "refund_requested") updated = await transitionOrder(database, id, "refund_requested", expected);
    } else if (operation === "pay") {
      if (!["success", "failure"].includes(String(body.outcome)) || Object.keys(body).some((key) => key !== "outcome")) return reply({ ok: false, error: "invalid_input" }, 400);
      if (body.outcome === "failure") {
        if (order.status !== "pending") return reply({ ok: false, error: "invalid_transition" }, 409);
        return reply({ ok: false, error: "simulated_decline", order, access: hasAccess(await sessionOrders(database, sessionHash!)) }, 402);
      }
      expected = "simulated_paid";
      if (order.status === "pending") updated = await transitionOrder(database, id, "pending", expected, sessionHash!);
    } else if (operation === "cancel") {
      expected = "cancelled";
      if (order.status === "pending") updated = await transitionOrder(database, id, "pending", expected, sessionHash!);
    } else if (operation === "refund") {
      expected = "refund_requested";
      if (order.status === "simulated_paid") updated = await transitionOrder(database, id, "simulated_paid", expected, sessionHash!);
    } else return reply({ ok: false, error: "method_not_allowed" }, 405);
    if (updated?.status !== expected) return reply({ ok: false, error: "invalid_transition" }, 409);
    return reply({ ok: true, order: updated, ...(admin ? {} : { access: hasAccess(await sessionOrders(database, sessionHash!)) }) });
  } catch { console.error("local_commerce_operation_failed"); return reply({ ok: false, error: "database_unavailable" }, 503); }
}
