// app/inspect/page.jsx
"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Cog6ToothIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";

export default function InspectPage() {
  const search = useSearchParams();
  const uuid = search.get("uuid") || "";
  const message = search.get("message") || "";
  const env = search.get("env") || "prod";

  const [meta, setMeta] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let ignore = false;
    async function load() {
      setErr("");
      setMeta(null);
      if (!uuid) {
        setErr("Missing uuid.");
        return;
      }
      try {
        const res = await fetch(`/api/inspect?uuid=${encodeURIComponent(uuid)}`);
        const data = await res.json();
        if (!ignore) {
          if (res.ok && data?.ok) setMeta(data);
          else setErr(data?.error || "Failed to load file metadata.");
        }
      } catch (e) {
        if (!ignore) setErr("Network error.");
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [uuid]);

  return (
    <main className="max-w-5xl mx-auto px-6 sm:px-12 py-10">
      <h1 className="text-3xl font-bold mb-4">Inspect</h1>

      {message && (
        <div className="mb-6 rounded-md border border-yellow-300 bg-yellow-50 p-4 text-yellow-900">
          {message}
        </div>
      )}

      {!uuid && (
        <div className="text-red-600">Missing <code>uuid</code> in query.</div>
      )}

      {err && (
        <div className="text-red-600 mb-6">{err}</div>
      )}

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
              <div className="text-sm text-gray-600">{Math.round(meta.size / 1024)} KB</div>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            {/* Convert – prześlij uuid/key do Twojego flow konwersji */}
            <Link
              href={`/dashboard?uuid=${encodeURIComponent(meta.uuid)}&key=${encodeURIComponent(meta.key)}`}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-white text-sm font-semibold hover:bg-blue-700 transition"
            >
              <Cog6ToothIcon className="h-5 w-5" />
              Convert
            </Link>

            {/* Inspect – jesteś na tej stronie; zostawiam jako disabled/ghost */}
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-gray-900 text-sm font-semibold cursor-default"
              disabled
              title="You are on the Inspect page"
            >
              <MagnifyingGlassIcon className="h-5 w-5" />
              Inspect
            </button>

            {/* Podgląd PDF jeśli masz /api/view */}
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
