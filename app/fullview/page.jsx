// app/fullview/page.jsx
import { headers } from "next/headers";
import InspectClient from "../../components/InspectClient";

async function fetchMeta(uuid) {
  // 1) spróbuj z env
  const envBase = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  // 2) jeśli brak, zbuduj z nagłówków żądania
  let base = envBase;
  if (!base) {
    const h = headers();
    const proto = h.get("x-forwarded-proto") || "https";
    const host = h.get("x-forwarded-host") || h.get("host");
    base = `${proto}://${host}`;
  }

  const res = await fetch(
    `${base}/api/inspect?uuid=${encodeURIComponent(uuid)}`,
    { cache: "no-store" }
  );

  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || `Failed to load metadata (status ${res.status}).`);
  }
  return data;
}

export default async function FullViewPage({ searchParams }) {
  const uuid = searchParams?.uuid || "";
  
  if (!uuid) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <p className="text-red-600">Missing UUID parameter</p>
      </div>
    );
  }

  let meta;
  try {
    meta = await fetchMeta(uuid);
  } catch (e) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <p className="text-red-600">Error loading PDF: {String(e.message || e)}</p>
      </div>
    );
  }

  // OK — mamy meta z backendu
  return (
    <div className="w-full h-screen overflow-hidden">
      {/* Full window PDF viewer */}
      <div className="w-full h-full">
        <InspectClient
          pdfUrl={meta.viewUrl}
          uuid={meta.uuid}
          pdfName={meta.filename}
          fullWindow={true}
        />
      </div>
    </div>
  );
}