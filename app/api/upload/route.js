// app/api/upload/route.js
import { getStore } from "@netlify/blobs";
export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024;
const J = (b, s=200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

const isPdf = (file, name) => (file?.type === "application/pdf") || (name||file?.name||"").toLowerCase().endsWith(".pdf");

export async function POST(request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const nameRaw = form.get("filename") || file?.name || "upload.pdf";
    if (!file || typeof file === "string") return J({ error: "No file provided." }, 400);
    if (!isPdf(file, nameRaw)) return J({ error: "Only PDF files are allowed." }, 400);

    let size = Number(file.size);
    if (!Number.isFinite(size)) {
      const buf = await file.arrayBuffer();
      size = buf.byteLength;
    }
    if (size > MAX_BYTES) return J({ error: "File too large. Max 5 MB." }, 413);

    const safeName = String(nameRaw).replace(/[^\w.\-()+\s]/g, "_");
    const uuid = crypto.randomUUID();

    const store = getStore("file-uploads");
    const key = `uploads/${uuid}-${safeName}`;
    await store.set(key, file);

    const meta = { uuid, key, filename: safeName, size, contentType: file.type||"application/pdf", createdAt: new Date().toISOString() };
    await store.set(`meta/${uuid}.json`, JSON.stringify(meta), { contentType: "application/json" });

    const origin = new URL(request.url).origin;
    const msg = "We were unable to automatically extract the data. You can use this page to manually extract the data.";
    const inspectUrl = `${origin}/inspect?uuid=${encodeURIComponent(uuid)}&env=prod&message=${encodeURIComponent(msg)}`;

    return J({ ok: true, ...meta, viewUrl: `/api/view?key=${encodeURIComponent(key)}`, inspectUrl });
  } catch (e) {
    console.error("[/api/upload] error:", e);
    return J({ error: "Upload failed." }, 500);
  }
}
