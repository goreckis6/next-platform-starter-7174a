// app/api/upload/route.js
// 👇 WAŻNE: używamy wersji node
import { put } from "@netlify/blobs/node";

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

    if (!file || typeof file === "string") {
      return json({ error: "No file provided." }, 400);
    }

    if (!isPdfFile(file, nameRaw)) {
      return json({ error: "Only PDF files are allowed." }, 400);
    }

    // Rozmiar (niektóre środowiska nie podają file.size)
    let size = Number.isFinite(file.size) ? file.size : undefined;
    if (size === undefined) {
      const buf = await file.arrayBuffer();
      size = buf.byteLength;
    }

    if (size > MAX_BYTES) {
      return json({ error: "File too large. Max 5 MB." }, 413);
    }

    const safeName = String(nameRaw).replace(/[^\w.\-()+\s]/g, "_");

    // 👇 zapis do Netlify Blobs
    const keyBase = `uploads/${Date.now()}-${safeName}`;
    const { key, url } = await put(keyBase, file, {
      contentType: file.type || "application/pdf",
      addRandomSuffix: true,
      access: "public", // publiczny link
    });

    return json({
      ok: true,
      key,
      url, // tu masz publiczny link do pliku
      filename: safeName,
      size,
      contentType: file.type || "application/pdf",
    });
  } catch (e) {
    return json({ error: e?.message || "Upload failed." }, 500);
  }
}
