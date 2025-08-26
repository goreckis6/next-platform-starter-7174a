// components/InspectClient.jsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Minimalny front z chunkowaniem:
 * PDF -> tekst per strona (pdfjs) -> /.netlify/functions/ai-parse (po 1 stronie)
 * -> scalanie + deduplikacja -> podgląd + eksport CSV/XLSX
 */
export default function InspectClient({
  pdfUrl,
  pdfData,
  pdfName: pdfNameProp,
  fullWindow = false,
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const [pdfjs, setPdfjs] = useState(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pageNum, setPageNum] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [scale, setScale] = useState(1.25);
  const [viewport, setViewport] = useState({
    width: 0,
    height: 0,
    transform: [1, 0, 0, 1, 0, 0],
  });
  const [error, setError] = useState(null);

  const [docName, setDocName] = useState("file");
  const [reloadTick, setReloadTick] = useState(0);

  const [textCache, setTextCache] = useState({});
  const [isParsing, setIsParsing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [transactions, setTransactions] = useState([]);

  // Konfig eksportu
  const ALL_COLUMNS = [
    "Date",
    "Source Date",
    "Description",
    "Credit",
    "Debit",
    "Amount",
    "Balance",
    "Currency",
    "Reference Number",
    "Reference 1",
    "Reference 2",
    "Transaction Type",
    "Transaction Category",
    "Branch",
    "Sender/Receiver Name",
    "Source Statement Page",
  ];
  const [exportType, setExportType] = useState("xlsx");
  const [selectedCols, setSelectedCols] = useState(
    new Set(["Date", "Description", "Debit", "Balance"])
  );
  const toggleCol = (label) =>
    setSelectedCols((prev) => {
      const n = new Set(prev);
      n.has(label) ? n.delete(label) : n.add(label);
      return n;
    });

  // ===== helpers
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const chunkArray = (arr, size) => {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  };
  const minifyText = (s) =>
    String(s || "")
      .replace(/\s+$/gm, "")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n");
  const makeTxKey = (t) => {
    const date = String(t?.Date ?? "").trim();
    const amt = String(t?.Amount ?? t?.Debit ?? t?.Credit ?? "").trim();
    const desc = String(t?.Description ?? "").trim().replace(/\s+/g, " ");
    return `${date}||${amt}||${desc}`.toLowerCase();
  };

  const deriveDocName = useCallback(() => {
    if (typeof pdfNameProp === "string" && pdfNameProp.trim())
      return pdfNameProp.trim();
    let name = "";
    if (typeof pdfUrl === "string" && pdfUrl) {
      try {
        const u = new URL(
          pdfUrl,
          typeof window !== "undefined" ? window.location.href : "http://local"
        );
        name = (u.pathname.split("/").pop() || "").split("?")[0];
      } catch {
        name = pdfUrl.split("/").pop() || "";
      }
    }
    if (!name && pdfData && typeof pdfData === "object" && "name" in pdfData) {
      name = String(pdfData.name || "");
    }
    return name || "file.pdf";
  }, [pdfNameProp, pdfUrl, pdfData]);

  // ===== init pdfjs (z workerem)
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (typeof window === "undefined") return;
      try {
        const lib = await import("pdfjs-dist");
        let workerUrl;
        try {
          const w = await import("pdfjs-dist/build/pdf.worker.mjs?url");
          workerUrl = w?.default;
        } catch {
          try {
            const w = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
            workerUrl = w?.default;
          } catch {
            try {
              const w = await import(
                "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"
              );
              workerUrl = w?.default;
            } catch {}
          }
        }
        if (workerUrl) lib.GlobalWorkerOptions.workerSrc = workerUrl;
        if (mounted) setPdfjs(lib);
      } catch (e) {
        console.error(e);
        if (mounted) setError("PDF.js init failed");
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // ===== load doc
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!pdfjs) return;
      if (!pdfUrl && !pdfData) return;

      setError(null);
      if (pdfDoc) {
        try {
          await pdfDoc.destroy();
        } catch {}
      }
      setPdfDoc(null);
      setTextCache({});
      setTransactions([]);

      try {
        const name = deriveDocName();
        setDocName(name);
        const bustUrl = (u) =>
          typeof u === "string"
            ? `${u}${u.includes("?") ? "&" : "?"}ts=${Date.now()}-${reloadTick}`
            : u;
        const params = pdfData
          ? { data: pdfData }
          : { url: bustUrl(pdfUrl), httpHeaders: { "Cache-Control": "no-cache" } };
        const doc = await pdfjs.getDocument(params).promise;
        if (!mounted) return;
        setPdfDoc(doc);
        setPageCount(doc.numPages);
        setPageNum(1);
      } catch (err) {
        console.error(err);
        if (!mounted) return;
        setError(err?.message || "PDF load error");
        setPdfDoc(null);
        setPageCount(1);
        setPageNum(1);
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfUrl, pdfData, pdfjs, reloadTick, deriveDocName]);

  // ===== render + cache tekstu bieżącej strony
  const renderPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current) return;
    const page = await pdfDoc.getPage(pageNum);
    const vp = page.getViewport({ scale });
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    canvas.width = vp.width;
    canvas.height = vp.height;
    setViewport({ width: vp.width, height: vp.height, transform: vp.transform });
    await page.render({ canvasContext: ctx, viewport: vp }).promise;

    const txt = await page.getTextContent({
      includeMarkedContent: true,
      disableCombineTextItems: false,
    });
    setTextCache((prev) => ({
      ...prev,
      [pageNum]: { items: txt.items, vpTransform: vp.transform },
    }));
  }, [pdfDoc, pageNum, scale]);

  useEffect(() => {
    renderPage().catch((e) => console.error("Render error:", e));
  }, [renderPage]);

  // ===== nawigacja
  const zoomIn = () =>
    setScale((s) => Math.min(4, Math.round((s + 0.1) * 100) / 100));
  const zoomOut = () =>
    setScale((s) => Math.max(0.2, Math.round((s - 0.1) * 100) / 100));
  const prevPage = () => setPageNum((n) => Math.max(1, n - 1));
  const nextPage = () => setPageNum((n) => Math.min(pageCount, n + 1));

  // ===== tekst jednej strony (z cache)
  const getPageText = useCallback(
    async (p) => {
      if (!pdfDoc) return "";
      if (!textCache[p]) {
        const page = await pdfDoc.getPage(p);
        const vp = page.getViewport({ scale: 1 });
        const txt = await page.getTextContent({
          includeMarkedContent: true,
          disableCombineTextItems: false,
        });
        setTextCache((prev) => ({
          ...prev,
          [p]: { items: txt.items, vpTransform: vp.transform },
        }));
        return txt.items.map((it) => it.str).join(" ").trim();
      }
      return textCache[p].items.map((it) => it.str).join(" ").trim();
    },
    [pdfDoc, textCache]
  );

  // ===== główne parsowanie w porcjach (CHUNK_PAGES = 1)
  const parseWithAI = useCallback(async () => {
    if (!pdfDoc) return;
    try {
      setIsParsing(true);

      const pages = Array.from({ length: pdfDoc.numPages }, (_, i) => i + 1);
      const CHUNK_PAGES = 1;       // 1 strona = 1 request (najbezpieczniej na Netlify)
      const MAX_CHARS = 60_000;    // limit per request (po stronie klienta)
      const chunks = chunkArray(pages, CHUNK_PAGES);

      setProgress({ done: 0, total: chunks.length });

      const all = new Map();
      const unrecovered = [];

      for (let i = 0; i < chunks.length; i++) {
        const group = chunks[i];

        // zbierz i zminimalizuj tekst porcji
        const texts = [];
        for (const p of group) {
          const s = await getPageText(p);
          if (s) texts.push(`(Page ${p})\n${s}`);
        }
        let payload = minifyText(texts.join("\n\n"));
        if (payload.length > MAX_CHARS) payload = payload.slice(0, MAX_CHARS);

        // wywołanie funkcji
        const res = await fetch("/.netlify/functions/ai-parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: payload }),
        });

        if (!res.ok) {
          // przy CHUNK_PAGES=1 to już pojedyncza strona – po prostu zapisz jako nieudane
          const body = await res.text().catch(() => "(no body)");
          unrecovered.push({ group, status: res.status, body });
        } else {
          const data = await res.json().catch(() => ({}));
          const list = Array.isArray(data.transactions) ? data.transactions : [];
          for (const t of list) {
            const k = makeTxKey(t);
            if (!all.has(k)) all.set(k, t);
          }
        }

        setProgress({ done: i + 1, total: chunks.length });
      }

      setTransactions(Array.from(all.values()));

      if (unrecovered.length) {
        const msg = unrecovered
          .map(
            (f) =>
              `pages: ${f.group.join(", ")} | status: ${f.status} | body: ${String(
                f.body || ""
              ).slice(0, 200)}`
          )
          .join("\n");
        alert(
          `Część porcji nie przeszła (504). Wyniki częściowe zebrane.\n\nSzczegóły:\n${msg}`
        );
      }
    } catch (e) {
      console.error(e);
      alert("AI parsing failed (client). Szczegóły w konsoli.");
    } finally {
      setIsParsing(false);
    }
  }, [pdfDoc, getPageText]);

  // ===== Export
  function buildCSV(rows) {
    return rows
      .map((r) =>
        r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");
  }

  async function ensureXLSX() {
    if (typeof window === "undefined") throw new Error("XLSX only in browser.");
    if (window.XLSX) return window.XLSX;
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src =
        "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Failed to load XLSX library"));
      document.head.appendChild(s);
    });
    return window.XLSX;
  }

  async function doExport() {
    const base = String(docName || "file").replace(/\.[^.]+$/, "");
    const header = ALL_COLUMNS.filter((c) => selectedCols.has(c));
    const rows = [header];
    transactions.forEach((t) => {
      rows.push(header.map((h) => t?.[h] ?? ""));
    });

    if (exportType === "csv") {
      const csv = buildCSV(rows);
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${base}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } else {
      try {
        const XLSX = await ensureXLSX();
        const ws = XLSX.utils.aoa_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
        const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
        const blob = new Blob([wbout], {
          type:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${base}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch (e) {
        console.error(e);
        alert("XLSX export failed — fallback to CSV.");
        const csv = buildCSV(rows);
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${base}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }
    }
  }

  // ===== UI
  const CanvasShell = (
    <div
      className="relative inline-block select-none"
      ref={containerRef}
      style={{ lineHeight: 0 }}
    >
      <canvas ref={canvasRef} className="shadow border" />
      {error && (
        <div className="absolute left-0 top-0 w-full p-3 bg-red-50 text-red-800 text-sm border border-red-200">
          PDF load error: <span className="font-mono">{String(error)}</span>
        </div>
      )}
    </div>
  );

  if (fullWindow) {
    return (
      <div className="w-full h-screen overflow-hidden">
        <div className="w-full h-full relative" style={{ lineHeight: 0 }}>
          {CanvasShell}
        </div>
      </div>
    );
  }

  const progressLabel =
    isParsing && progress.total
      ? `Parsing… ${progress.done}/${progress.total}`
      : isParsing
      ? "Parsing…"
      : "Parse with AI";

  return (
    <div className="w-full">
      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="text-sm px-2 py-1 border rounded">
          Page {pageNum}/{pageCount}
        </div>
        <button className="px-3 py-1 border rounded hover:bg-gray-100" onClick={zoomIn}>
          [+] Zoom
        </button>
        <button className="px-3 py-1 border rounded hover:bg-gray-100" onClick={zoomOut}>
          [-] Zoom
        </button>
        <button className="px-3 py-1 border rounded hover:bg-gray-100" onClick={prevPage}>
          &lt; Prev
        </button>
        <button className="px-3 py-1 border rounded hover:bg-gray-100" onClick={nextPage}>
          Next &gt;
        </button>
        <button
          className="px-3 py-1 border rounded hover:bg-gray-100"
          onClick={() => setReloadTick((t) => t + 1)}
        >
          Reload
        </button>

        <span className="mx-2" />

        <button
          disabled={isParsing || !pdfDoc}
          onClick={parseWithAI}
          className="px-4 py-2 rounded-md text-white font-semibold disabled:opacity-60 bg-indigo-600 hover:bg-indigo-700"
          title="Parse entire PDF with AI"
        >
          {progressLabel}
        </button>

        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-3 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="ft"
                value="xlsx"
                checked={exportType === "xlsx"}
                onChange={() => setExportType("xlsx")}
              />
              XLSX
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="ft"
                value="csv"
                checked={exportType === "csv"}
                onChange={() => setExportType("csv")}
              />
              CSV
            </label>
          </div>
          <button
            onClick={doExport}
            disabled={!transactions.length}
            className="px-4 py-2 rounded-md text-white font-semibold disabled:opacity-60 bg-emerald-600 hover:bg-emerald-700"
            title="Export parsed transactions"
          >
            Export {exportType.toUpperCase()}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[auto_520px] gap-6">
        {/* LEFT: canvas */}
        {CanvasShell}

        {/* RIGHT: wynik AI */}
        <div className="border rounded-lg p-3 bg-white/60 overflow-auto max-h=[80vh]">
          <div className="font-semibold mb-2">
            Transactions ({transactions.length})
          </div>

          {!transactions.length ? (
            <div className="text-sm text-gray-500">
              Kliknij <b>Parse with AI</b>, aby przetworzyć PDF (po 1 stronie, by uniknąć timeoutów 504).
            </div>
          ) : (
            <>
              <div className="text-sm font-medium mb-2">Columns</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm mb-3">
                {ALL_COLUMNS.map((label) => (
                  <label key={label} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedCols.has(label)}
                      onChange={() => toggleCol(label)}
                    />
                    {label}
                  </label>
                ))}
              </div>

              <div className="overflow-auto">
                <table className="min-w-full border text-xs">
                  <thead>
                    <tr className="bg-gray-50">
                      {ALL_COLUMNS.filter((c) => selectedCols.has(c)).map(
                        (c) => (
                          <th key={c} className="border px-2 py-1 text-left">
                            {c}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((t, i) => (
                      <tr key={i}>
                        {ALL_COLUMNS.filter((c) => selectedCols.has(c)).map(
                          (c) => (
                            <td key={c} className="border px-2 py-1 align-top">
                              {String(t?.[c] ?? "")}
                            </td>
                          )
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
