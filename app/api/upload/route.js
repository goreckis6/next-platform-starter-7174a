// app/api/upload/route.js
import { put } from "@netlify/blobs";

// Stabilniejsze dla uploadów niż edge
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

    // Walidacja typu
    if (!isPdfFile(file, nameRaw)) {
      return json({ error: "Only PDF files are allowed." }, 400);
    }

    // Rozmiar (niektóre środowiska mogą nie podać file.size)
    let size = Number.isFinite(file.size) ? file.size : undefined;
    if (size === undefined) {
      const buf = await file.arrayBuffer();
      size = buf.byteLength;
    }

    if (size > MAX_BYTES) {
      return json({ error: "File too large. Max 5 MB." }, 413);
    }

    // Prosta normalizacja nazwy (bez znaków problematycznych)
    const safeName = String(nameRaw).replace(/[^\w.\-()+\s]/g, "_");

    // Zapis do Netlify Blobs z publicznym dostępem (zwróci URL)
    const keyBase = `uploads/${Date.now()}-${safeName}`;
    const { key, url } = await put(keyBase, file, {
      contentType: file.type || "application/pdf",
      addRandomSuffix: true,
      access: "public",
    });

    return json({
      ok: true,
      key,
      url, // publiczny link
      filename: safeName,
      size,
      contentType: file.type || "application/pdf",
    });
  } catch (e) {
    return json({ error: e?.message || "Upload failed." }, 500);
  }
}
