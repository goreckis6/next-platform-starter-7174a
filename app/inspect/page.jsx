// app/inspect/page.jsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
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

export default async function InspectPage({ searchParams }) {
  const uuid = searchParams?.uuid || "";
  const message = searchParams?.message || "";
  const env = searchParams?.env || "prod";

  if (!uuid) {
    return (
      <main className="max-w-5xl mx-auto px-6 sm:px-12 py-10">
        <h1 className="text-3xl font-bold mb-4">Inspect</h1>
        <p className="text-red-600">Missing <code>uuid</code> in query.</p>
      </main>
    );
  }

  let meta;
  try {
    meta = await fetchMeta(uuid);
  } catch (e) {
    return (
      <main className="max-w-5xl mx-auto px-6 sm:px-12 py-10">
        <h1 className="text-3xl font-bold mb-4">Inspect</h1>
        <p className="text-red-600">{String(e.message || e)}</p>
        <p className="mt-2 text-sm text-gray-600">
          Tip: możesz ustawić <code>NEXT_PUBLIC_SITE_URL</code> w Netlify (np. <code>https://twoja-domena.netlify.app</code>),
          ale nie jest to wymagane — powyższa wersja i tak działa bez tego.
        </p>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-6 sm:px-12 py-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Inspect: {meta.filename}</h1>
        {/* Ten przycisk możesz usunąć, bo Convert jest w kliencie */}
        <Link
          href={`/inspect?uuid=${encodeURIComponent(meta.uuid)}&env=prod`}
          className="rounded-md bg-blue-600 px-4 py-2 text-white font-semibold hover:bg-blue-700"
        >
          Reload
        </Link>
      </div>

      {message && (
        <div className="mb-4 rounded-md border border-yellow-300 bg-yellow-50 p-3 text-yellow-900">
          {message}
        </div>
      )}

      {/* Interaktywny viewer/edytor (z przyciskiem Convert w środku) */}
      <InspectClient pdfUrl={meta.viewUrl} uuid={meta.uuid} />
      <div className="mt-8 text-sm text-gray-500">
        env: <span className="font-mono">{env}</span>
      </div>
    </main>
  );
}
