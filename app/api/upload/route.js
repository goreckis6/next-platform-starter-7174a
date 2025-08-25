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

    if (!file || typeof file === "string") {
      return json({ error: "No file provided." }, 400);
    }

    if (!isPdfFile(file, nameRaw)) {
      return json({ error: "Only PDF files are allowed." }, 400);
    }

    // Rozmiar – jeśli brak file.size, policz z ArrayBuffer
    let size = Number.isFinite(file.size) ? file.size : undefined;
    if (size === undefined) {
      const buf = await file.arrayBuffer();
      size = buf.byteLength;
    }
    if (size > MAX_BYTES) {
      return json({ error: "File too large. Max 5 MB." }, 413);
    }

    // Uproszczona, bezpieczna nazwa
    const safeName = String(nameRaw).replace(/[^\w.\-()+\s]/g, "_");

    // Otwórz site-wide store (zalecane przez Netlify)
    const uploads = getStore("file-uploads"); // nazwa store'u według docs

    // Wygeneruj unikalny klucz (np. timestamp + nazwa)
    const key = `uploads/${Date.now()}-${safeName}`;

    // Zapis pliku do Blobs
    await uploads.set(key, file, {
      // Możesz dodać własne metadane:
      // metadata: { any: "value" }
    });

    // Zwracamy key; link do podglądu zapewni drugi endpoint /api/view
    return json({
      ok: true,
      key,
      filename: safeName,
      size,
      contentType: file.type || "application/pdf",
      viewUrl: `/api/view?key=${encodeURIComponent(key)}`,
    });
  } catch (e) {
    return json({ error: e?.message || "Upload failed." }, 500);
  }
}
