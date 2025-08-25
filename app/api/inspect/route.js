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
    const metaBlob = await store.get(`meta/${uuid}.json`, { type: "json" });
    if (!metaBlob) return json({ error: "Not found" }, 404);

    const viewUrl = metaBlob.key ? `/api/view?key=${encodeURIComponent(metaBlob.key)}` : null;

    return json({
      ok: true,
      ...metaBlob,
      viewUrl,
    });
  } catch (e) {
    return json({ error: e?.message || "Failed to load metadata." }, 500);
  }
}
