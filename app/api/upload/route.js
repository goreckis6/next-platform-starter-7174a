// app/api/upload/route.js
import { put } from "@netlify/blobs";

export const runtime = "edge";

export async function POST(request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const name = form.get("filename") || file?.name || "upload.pdf";

    if (!file || typeof file === "string") {
      return new Response(JSON.stringify({ error: "No file provided." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // zapis do Blobs; access: "private" (zmień na "public" jeśli chcesz publiczny odczyt)
    const keyBase = `uploads/${Date.now()}-${name}`;
    const { key } = await put(keyBase, file, {
      contentType: file.type || "application/pdf",
      addRandomSuffix: true,
      access: "private",
    });

    return new Response(
      JSON.stringify({
        ok: true,
        key,
        filename: name,
        size: file.size || null,
        contentType: file.type || null,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: "Upload failed." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
