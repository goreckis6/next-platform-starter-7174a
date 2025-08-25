// app/api/view/route.js
import { getStore } from "@netlify/blobs";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const key = url.searchParams.get("key");
    if (!key) {
      return new Response("Missing key", { status: 400 });
    }

    const uploads = getStore("file-uploads");
    // Pobierz jako stream; jeśli chcesz bufor: type: "arrayBuffer"
    const blobStream = await uploads.get(key, { type: "stream" });

    if (!blobStream) {
      return new Response("Not found", { status: 404 });
    }

    // Ustaw nagłówki; możesz dodać Content-Disposition jeśli chcesz pobieranie
    return new Response(blobStream, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (e) {
    return new Response("Error fetching blob", { status: 500 });
  }
}
