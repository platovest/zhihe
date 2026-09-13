import { savePurchaseIntent, type PurchaseIntentDatabase } from "../db/intents";
import { parseInterestInput } from "./interest";
import { json, readJson } from "./request";

export async function handleInterestPost(request: Request, database: PurchaseIntentDatabase | undefined) {
  const parsed = await readJson(request);
  if (parsed instanceof Response) return parsed;
  const input = parseInterestInput(parsed);
  if (!input) return json({ ok: false }, 400);
  if (!database) return json({ ok: false }, 503);
  try {
    const withdrawalToken = await savePurchaseIntent(database, input);
    return json({ ok: true, withdrawalToken });
  } catch {
    console.error("purchase_intent_write_failed");
    return json({ ok: false }, 503);
  }
}
