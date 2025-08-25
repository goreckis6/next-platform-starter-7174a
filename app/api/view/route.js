// app/api/view/route.js
import { getStore } from "@netlify/blobs";
export const runtime = "nodejs";

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const key = url.searchParams.get("key");
    if (!key) return new Response("Missing key", { status: 400 });

    const store = getStore("file-uploads");
    const buf = await store.get(key, { type: "arrayBuffer" });
    if (!buf) return new Response("Not found", { status: 404 });

    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (e) {
    console.error("[/api/view] error:", e);
    return new Response("Internal error", { status: 500 });
  }
}
