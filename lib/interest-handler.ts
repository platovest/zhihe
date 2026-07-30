import {
  savePurchaseIntent,
  type PurchaseIntentDatabase,
} from "../db/intents";
import { parseInterestInput } from "./interest";

const MAX_BODY_BYTES = 2_048;

function json(body: unknown, status: number) {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export async function handleInterestPost(
  request: Request,
  database: PurchaseIntentDatabase | undefined,
) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return json({ ok: false }, 400);
  }

  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return json({ ok: false }, 415);
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) return json({ ok: false }, 413);

  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) {
    return json({ ok: false }, 413);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return json({ ok: false }, 400);
  }

  const input = parseInterestInput(parsed);
  if (!input) return json({ ok: false }, 400);
  if (!database) return json({ ok: false }, 503);

  try {
    await savePurchaseIntent(database, input);
    return json({ ok: true }, 200);
  } catch {
    console.error("purchase_intent_write_failed");
    return json({ ok: false }, 503);
  }
}
