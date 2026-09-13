export function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff", ...extra } });
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return (!origin || origin === new URL(request.url).origin) && request.headers.get("sec-fetch-site") !== "cross-site";
}

export async function readJson(request: Request): Promise<unknown | Response> {
  if (!sameOrigin(request)) return json({ ok: false }, 403);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return json({ ok: false }, 415);
  if (Number(request.headers.get("content-length") ?? 0) > 2048) return json({ ok: false }, 413);
  const reader = request.body?.getReader();
  if (!reader) return json({ ok: false }, 400);
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 2048) { await reader.cancel(); return json({ ok: false }, 413); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch { return json({ ok: false }, 400); }
}
