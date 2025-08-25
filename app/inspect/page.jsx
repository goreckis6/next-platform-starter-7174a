// app/inspect/page.jsx
export const dynamic = "force-dynamic";   // nie prerenderuj w buildzie
export const revalidate = 0;              // oraz bez cache

import Link from "next/link";

export default async function InspectPage({ searchParams }) {
  const uuid = searchParams?.uuid || "";
  const message = searchParams?.message || "";
  const env = searchParams?.env || "prod";

  let meta = null;
  let err = "";

  if (!uuid) {
    err = "Missing uuid.";
  } else {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SITE_URL || ""}/api/inspect?uuid=${encodeURIComponent(uuid)}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (res.ok && data?.ok) {
        meta = data;
      } else {
        err = data?.error || "Failed to load file metadata.";
      }
    } catch {
      err = "Network error.";
    }
  }

  return (
    <main className="max-w-5xl mx-auto px-6 sm:px-12 py-10">
      <h1 className="text-3xl font-bold mb-4">Inspect</h1>

      {message && (
        <div className="mb-6 rounded-md border border-yellow-300 bg-yellow-50 p-4 text-yellow-900">
          {message}
        </div>
      )}

      {err && <div className="text-red-600 mb-6">{err}</div>}

      {meta && (
        <div className="rounded-lg border border-gray-300 p-6 bg-white">
          <div className="mb-4">
            <div className="text-sm text-gray-600">UUID</div>
            <div className="font-mono">{meta.uuid}</div>
          </div>

          <div className="mb-4">
            <div className="text-sm text-gray-600">File</div>
            <div className="font-medium">{meta.filename}</div>
            {typeof meta.size === "number" && (
              <div className="text-sm text-gray-600">
                {Math.round(meta.size / 1024)} KB
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href={`/dashboard?uuid=${encodeURIComponent(meta.uuid)}&key=${encodeURIComponent(meta.key)}`}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-white text-sm font-semibold hover:bg-blue-700 transition"
            >
              Convert
            </Link>

            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-gray-900 text-sm font-semibold cursor-default"
              disabled
            >
              Inspect
            </button>

            {meta.viewUrl && (
              <a
                href={meta.viewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-gray-900 text-sm font-semibold hover:bg-gray-100 transition"
              >
                View PDF
              </a>
            )}
          </div>
        </div>
      )}

      <div className="mt-8 text-sm text-gray-500">
        env: <span className="font-mono">{env}</span>
      </div>
    </main>
  );
}
