// app/api/inspect/route.js
import { getStore } from "@netlify/blobs";
export const runtime = "nodejs";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const uuid = url.searchParams.get("uuid");
    if (!uuid) return json({ error: "Missing uuid" }, 400);

    const store = getStore("file-uploads");
    const metaText = await store.get(`meta/${uuid}.json`, { type: "text" });
    if (!metaText) return json({ error: "Not found" }, 404);

    const meta = JSON.parse(metaText);
    const viewUrl = meta.key ? `/api/view?key=${encodeURIComponent(meta.key)}` : null;

    return json({ ok: true, ...meta, viewUrl });
  } catch (e) {
    console.error("[/api/inspect] error:", e);
    return json({ error: "Internal error" }, 500);
  }
}
