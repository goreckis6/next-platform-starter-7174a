// app/api/upload/route.js
import { getStore } from "@netlify/blobs";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isPdfFile(file, name) {
  const typeOk = file?.type === "application/pdf";
  const nameOk = (name || file?.name || "").toLowerCase().endsWith(".pdf");
  return typeOk || nameOk;
}

export async function POST(request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const nameRaw = form.get("filename") || file?.name || "upload.pdf";

    if (!file || typeof file === "string") return json({ error: "No file provided." }, 400);
    if (!isPdfFile(file, nameRaw)) return json({ error: "Only PDF files are allowed." }, 400);

    let size = Number.isFinite(file.size) ? file.size : undefined;
    if (size === undefined) {
      const buf = await file.arrayBuffer();
      size = buf.byteLength;
    }
    if (size > MAX_BYTES) return json({ error: "File too large. Max 5 MB." }, 413);

    const safeName = String(nameRaw).replace(/[^\w.\-()+\s]/g, "_");
    const uuid = crypto.randomUUID();

    const store = getStore("file-uploads");
    const key = `uploads/${uuid}-${safeName}`;
    await store.set(key, file);

    // zapisz metadane do późniejszego odczytu po uuid
    const meta = {
      uuid,
      key,
      filename: safeName,
      size,
      contentType: file.type || "application/pdf",
      createdAt: new Date().toISOString(),
    };
    await store.set(`meta/${uuid}.json`, JSON.stringify(meta), {
      contentType: "application/json",
    });

    const origin = new URL(request.url).origin;
    const msg =
      "We were unable to automatically extract the data. You can use this page to manually extract the data.";
    const inspectUrl = `${origin}/inspect?uuid=${encodeURIComponent(
      uuid
    )}&env=prod&message=${encodeURIComponent(msg)}`;

    return json({
      ok: true,
      ...meta,
      viewUrl: `/api/view?key=${encodeURIComponent(key)}`,
      inspectUrl,
    });
  } catch (e) {
    return json({ error: e?.message || "Upload failed." }, 500);
  }
}
