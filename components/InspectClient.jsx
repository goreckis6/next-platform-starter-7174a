// components/InspectClient.jsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const Tool = { TABLE: "table", COLUMN: "column", ROW: "row" };

const COLORS = {
  table: ["#2563eb", "#1d4ed8", "#3b82f6"],
  column: ["#16a34a", "#22c55e", "#15803d"],
  row: ["#d97706", "#f59e0b", "#b45309"],
};

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const toNorm = (x, y, w, h, vw, vh) => ({ x: x / vw, y: y / vh, w: w / vw, h: h / vh });
const fromNorm = (nr, vw, vh) => ({ x: nr.x * vw, y: nr.y * vh, w: nr.w * vw, h: nr.h * vh });

// precise rect intersection with tolerance
const EPS = 1.5; // px tolerance
function rectsIntersect(r1, r2) {
  return !(
    r2.x > r1.x + r1.w + EPS ||
    r2.x + r2.w < r1.x - EPS ||
    r2.y > r1.y + r1.h + EPS ||
    r2.y + r2.h < r1.y - EPS
  );
}

// resize/move handles
const HandleDots = ({ r, active, onMouseDown }) =>
  active ? (
    <>
      {[
        ["tl", r.x, r.y, "nwse-resize"],
        ["tr", r.x + r.w, r.y, "nesw-resize"],
        ["bl", r.x, r.y + r.h, "nesw-resize"],
        ["br", r.x + r.w, r.y + r.h, "nwse-resize"],
        ["l", r.x, r.y + r.h / 2, "col-resize"],
        ["r", r.x + r.w, r.y + r.h / 2, "col-resize"],
        ["t", r.x + r.w / 2, r.y, "row-resize"],
        ["b", r.x + r.w / 2, r.y + r.h, "row-resize"],
      ].map(([key, x, y, cursor]) => (
        <div
          key={key}
          className="absolute -translate-x-1/2 -translate-y-1/2 bg-white border border-gray-700"
          style={{ left: x, top: y, width: 10, height: 10, borderRadius: 6, cursor }}
          onMouseDown={(e) => onMouseDown(e, key)}
          title="Drag to resize"
        />
      ))}
    </>
  ) : null;

export default function InspectClient({ pdfUrl, pdfData, uuid }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const [pdfjs, setPdfjs] = useState(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pageNum, setPageNum] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [scale, setScale] = useState(1.25);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [error, setError] = useState(null);

  // text cache per page: page -> items
  const [textCache, setTextCache] = useState({});

  // selections[page] = [{ type, color, rect (normalized) }]
  const [selections, setSelections] = useState({});
  const [tool, setTool] = useState(Tool.TABLE);
  const colorIndexRef = useRef({ table: 0, column: 0, row: 0 });

  const [draft, setDraft] = useState(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [dragging, setDragging] = useState(null);

  // auto extracted values: values[page] = [{index,type,text}]
  const [values, setValues] = useState({});

  // init pdf.js with worker fallbacks
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
              const w = await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url");
              workerUrl = w?.default;
            } catch (e3) {
              console.error("[pdfjs] no worker url variant worked", e3);
            }
          }
        }
        if (workerUrl) {
          lib.GlobalWorkerOptions.workerSrc = workerUrl;
        } else {
          console.warn("[pdfjs] running without dedicated worker");
        }
        if (mounted) setPdfjs(lib);
      } catch (e) {
        console.error("[pdfjs] init failed:", e);
        if (mounted) setError("PDF.js init failed");
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // load document from url or pdfData
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!pdfjs) return;
      if (!pdfUrl && !pdfData) return;

      setError(null);
      setPdfDoc(null);
      setTextCache({});
      setValues({});

      try {
        const params = pdfData ? { data: pdfData } : { url: pdfUrl };
        const doc = await pdfjs.getDocument(params).promise;
        if (!mounted) return;
        setPdfDoc(doc);
        setPageCount(doc.numPages);
        setPageNum(1);
      } catch (err) {
        console.error("PDF load error:", err);
        if (!mounted) return;
        setError(err?.message || "Unknown PDF load error");
        setPdfDoc(null);
        setPageCount(1);
        setPageNum(1);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [pdfUrl, pdfData, pdfjs]);

  // render page and cache text
  const renderPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current) return;
    const page = await pdfDoc.getPage(pageNum);
    const vp = page.getViewport({ scale });
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    canvas.width = vp.width;
    canvas.height = vp.height;
    setViewport({ width: vp.width, height: vp.height });
    await page.render({ canvasContext: ctx, viewport: vp }).promise;

    if (!textCache[pageNum]) {
      const txt = await page.getTextContent();
      setTextCache((prev) => ({ ...prev, [pageNum]: txt.items }));
    }
  }, [pdfDoc, pageNum, scale, textCache]);

  useEffect(() => {
    renderPage().catch((e) => console.error("Render error:", e));
  }, [renderPage]);

  // helpers for current page
  const current = selections[pageNum] || [];
  const setCurrent = (updater) =>
    setSelections((prev) => {
      const arr = prev[pageNum] || [];
      const next = typeof updater === "function" ? updater(arr) : updater;
      return { ...prev, [pageNum]: next };
    });

  // toolbar actions
  const zoomIn = () => setScale((s) => Math.min(4, Math.round((s + 0.1) * 100) / 100));
  const zoomOut = () => setScale((s) => Math.max(0.2, Math.round((s - 0.1) * 100) / 100));
  const prevPage = () => {
    setActiveIndex(-1);
    setPageNum((n) => Math.max(1, n - 1));
  };
  const nextPage = () => {
    setActiveIndex(-1);
    setPageNum((n) => Math.min(pageCount, n + 1));
  };

  const nextColorFor = (t) => {
    const list = COLORS[t];
    const i = colorIndexRef.current[t] % list.length;
    colorIndexRef.current[t] = i + 1;
    return list[i];
  };

  // hit testing
  const pxFromNorm = (nr) => fromNorm(nr, viewport.width, viewport.height);

  const hitTestBox = (x, y) => {
    for (let i = current.length - 1; i >= 0; i--) {
      const r = pxFromNorm(current[i].rect);
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
    }
    return -1;
  };

  const hitTestHandle = (x, y, idx) => {
    const r = pxFromNorm(current[idx].rect);
    const size = 8;
    const near = (px, py) => Math.abs(x - px) <= size && Math.abs(y - py) <= size;

    if (near(r.x, r.y)) return "tl";
    if (near(r.x + r.w, r.y)) return "tr";
    if (near(r.x, r.y + r.h)) return "bl";
    if (near(r.x + r.w, r.y + r.h)) return "br";

    if (Math.abs(x - r.x) <= size && y >= r.y && y <= r.y + r.h) return "l";
    if (Math.abs(x - (r.x + r.w)) <= size && y >= r.y && y <= r.y + r.h) return "r";
    if (Math.abs(y - r.y) <= size && x >= r.x && x <= r.x + r.w) return "t";
    if (Math.abs(y - (r.y + r.h)) <= size && x >= r.x && x <= r.x + r.w) return "b";

    return null;
  };

  // mouse events
  const onMouseDown = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const sx = clamp(e.clientX - rect.left, 0, viewport.width);
    const sy = clamp(e.clientY - rect.top, 0, viewport.height);

    const hitIdx = hitTestBox(sx, sy);
    if (hitIdx >= 0) {
      setActiveIndex(hitIdx);
      const h = hitTestHandle(sx, sy, hitIdx);
      const r = pxFromNorm(current[hitIdx].rect);
      if (h) {
        setDragging({ mode: "resize", handle: h, startMouse: { x: sx, y: sy }, startRect: r });
      } else {
        setDragging({ mode: "move", handle: null, startMouse: { x: sx, y: sy }, startRect: r });
      }
      return;
    }

    setActiveIndex(-1);
    setDraft({ x: sx, y: sy, w: 0, h: 0, type: tool, color: nextColorFor(tool) });
  };

  const onMouseMove = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clamp(e.clientX - rect.left, 0, viewport.width);
    const y = clamp(e.clientY - rect.top, 0, viewport.height);

    if (dragging) {
      const { mode, startMouse, startRect, handle } = dragging;
      if (mode === "move") {
        const dx = x - startMouse.x;
        const dy = y - startMouse.y;
        const nx = clamp(startRect.x + dx, 0, viewport.width - startRect.w);
        const ny = clamp(startRect.y + dy, 0, viewport.height - startRect.h);
        setCurrent((prev) => {
          const next = [...prev];
          next[activeIndex] = {
            ...next[activeIndex],
            rect: toNorm(nx, ny, startRect.w, startRect.h, viewport.width, viewport.height),
          };
          return next;
        });
      } else if (mode === "resize") {
        const r = { ...startRect };
        const minSize = 8;

        if (["tl", "l", "bl"].includes(handle)) {
          const nx = clamp(Math.min(x, r.x + r.w - minSize), 0, viewport.width);
          r.w = r.x + r.w - nx;
          r.x = nx;
        }
        if (["tr", "r", "br"].includes(handle)) {
          const nx2 = clamp(Math.max(x, r.x + minSize), 0, viewport.width);
          r.w = nx2 - r.x;
        }
        if (["tl", "t", "tr"].includes(handle)) {
          const ny = clamp(Math.min(y, r.y + r.h - minSize), 0, viewport.height);
          r.h = r.y + r.h - ny;
          r.y = ny;
        }
        if (["bl", "b", "br"].includes(handle)) {
          const ny2 = clamp(Math.max(y, r.y + minSize), 0, viewport.height);
          r.h = ny2 - r.y;
        }

        setCurrent((prev) => {
          const next = [...prev];
          next[activeIndex] = {
            ...next[activeIndex],
            rect: toNorm(r.x, r.y, r.w, r.h, viewport.width, viewport.height),
          };
          return next;
        });
      }
      return;
    }

    if (draft) {
      const w = x - draft.x;
      const h = y - draft.y;
      const W = Math.abs(w);
      const H = Math.abs(h);
      const nx = w < 0 ? draft.x - W : draft.x;
      const ny = h < 0 ? draft.y - H : draft.y;
      setDraft({ ...draft, x: nx, y: ny, w: W, h: H });
    }
  };

  const onMouseUp = () => {
    if (dragging) {
      setDragging(null);
      return;
    }
    if (draft && draft.w >= 6 && draft.h >= 6) {
      const norm = toNorm(draft.x, draft.y, draft.w, draft.h, viewport.width, viewport.height);
      setCurrent((prev) => [...prev, { type: draft.type, color: draft.color, rect: norm }]);
      setActiveIndex(current.length);
    }
    setDraft(null);
  };

  const onClick = () => {
    if (!containerRef.current || dragging || draft) return;
  };

  // keyboard
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        if (activeIndex >= 0) {
          setCurrent((prev) => prev.filter((_, i) => i !== activeIndex));
          setActiveIndex(-1);
        }
      }
      if (e.key === "1") setTool(Tool.TABLE);
      if (e.key === "2") setTool(Tool.COLUMN);
      if (e.key === "3") setTool(Tool.ROW);
      if (e.key === "+") zoomIn();
      if (e.key === "-") zoomOut();
      if (e.key === "<" || e.key === ",") prevPage();
      if (e.key === ">" || e.key === ".") nextPage();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeIndex, pageNum, pageCount]);

  // precise auto-extract with intersection and sorting
  const extractTextsForPage = useCallback(
    (page) => {
      const pageSelections = selections[page] || [];
      const items = textCache[page];
      if (!items || viewport.width === 0 || viewport.height === 0) return [];

      // precompute boxes for items
      const boxes = items.map((it, idx) => {
        const t = it.transform || [];
        const a = t[0] ?? 0;
        const b = t[1] ?? 0;
        const c = t[2] ?? 0;
        const d = t[3] ?? 0;
        const e = t[4] ?? 0; // x
        const f = t[5] ?? 0; // baseline y
        const w = it.width || 0;
        const h = Math.abs(d) || it.height || 0; // glyph box height
        const x = e;
        const y = f - h; // convert baseline to top-left
        return { idx, it, x, y, w, h };
      });

      return pageSelections.map((sel, i) => {
        const r = fromNorm(sel.rect, viewport.width, viewport.height);

        // collect intersecting items
        const picked = [];
        for (const bx of boxes) {
          if (rectsIntersect(r, bx)) picked.push(bx);
        }

        // sort by y (ascending), then x
        picked.sort((p, q) => {
          const dy = p.y - q.y;
          if (Math.abs(dy) > 0.5) return dy;
          return p.x - q.x;
        });

        const text = picked.map((bx) => bx.it.str).join(" ");

        return { index: i, type: sel.type, text };
      });
    },
    [selections, textCache, viewport.width, viewport.height]
  );

  // recompute values when dependencies change
  useEffect(() => {
    if (!pdfDoc) return;
    const pagesWithText = Object.keys(textCache).map((k) => parseInt(k, 10));
    if (pagesWithText.length === 0) return;

    setValues((prev) => {
      const next = { ...prev };
      for (const p of pagesWithText) {
        next[p] = extractTextsForPage(p);
      }
      return next;
    });
  }, [selections, textCache, viewport.width, viewport.height, pdfDoc, extractTextsForPage]);

  const currentValues = values[pageNum] || [];

  // export csv using the same precise logic
  const handleExportCSV = async () => {
    if (!pdfDoc) return;

    const pages = Object.keys(selections)
      .map((k) => parseInt(k, 10))
      .filter((p) => (selections[p] || []).length > 0)
      .sort((a, b) => a - b);

    const rows = [["page", "index", "type", "text"]];

    for (const p of pages) {
      const pageSelections = selections[p] || [];
      if (pageSelections.length === 0) continue;

      const page = await pdfDoc.getPage(p);
      const vp = page.getViewport({ scale });

      let items = textCache[p];
      if (!items) {
        const txt = await page.getTextContent();
        items = txt.items;
      }

      // precompute boxes for that page
      const boxes = items.map((it, idx) => {
        const t = it.transform || [];
        const d = t[3] ?? 0;
        const e = t[4] ?? 0;
        const f = t[5] ?? 0;
        const w = it.width || 0;
        const h = Math.abs(d) || it.height || 0;
        const x = e;
        const y = f - h;
        return { idx, it, x, y, w, h };
      });

      pageSelections.forEach((sel, i) => {
        const r = fromNorm(sel.rect, vp.width, vp.height);

        const picked = [];
        for (const bx of boxes) {
          if (rectsIntersect(r, bx)) picked.push(bx);
        }

        picked.sort((p, q) => {
          const dy = p.y - q.y;
          if (Math.abs(dy) > 0.5) return dy;
          return p.x - q.x;
        });

        const text = picked.map((bx) => bx.it.str).join(" ");
        rows.push([p, i, sel.type, text]);
      });
    }

    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `values-${uuid || "file"}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="text-sm px-2 py-1 border rounded">Page {pageNum}/{pageCount}</div>

        <div className="flex items-center gap-1">
          <button className={`px-3 py-1 border rounded hover:bg-gray-100 ${tool === Tool.TABLE ? "bg-gray-100" : ""}`} onClick={() => setTool(Tool.TABLE)} title="[1] Create Table">[1] Create Table</button>
          <button className={`px-3 py-1 border rounded hover:bg-gray-100 ${tool === Tool.COLUMN ? "bg-gray-100" : ""}`} onClick={() => setTool(Tool.COLUMN)} title="[2] Add Column">[2] Add Column</button>
          <button className={`px-3 py-1 border rounded hover:bg-gray-100 ${tool === Tool.ROW ? "bg-gray-100" : ""}`} onClick={() => setTool(Tool.ROW)} title="[3] Add Row">[3] Add Row</button>
        </div>

        <span className="mx-1" />

        <button className="px-3 py-1 border rounded hover:bg-gray-100" onClick={zoomIn}>[+] Zoom In</button>
        <button className="px-3 py-1 border rounded hover:bg-gray-100" onClick={zoomOut}>[-] Zoom Out</button>
        <button className="px-3 py-1 border rounded hover:bg-gray-100" onClick={prevPage}>&lt; Prev</button>
        <button className="px-3 py-1 border rounded hover:bg-gray-100" onClick={nextPage}>Next &gt;</button>

        <div className="ml-auto flex items-center gap-2">
          <Legend label="Table" color={COLORS.table[0]} />
          <Legend label="Column" color={COLORS.column[0]} />
          <Legend label="Row" color={COLORS.row[0]} />
          <button onClick={handleExportCSV} className="px-4 py-2 rounded-md text-white font-semibold bg-emerald-600 hover:bg-emerald-700" title="Export values to CSV">Export CSV</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[auto_320px] gap-6">
        <div
          className="relative inline-block select-none"
          ref={containerRef}
          style={{ lineHeight: 0 }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onClick={onClick}
        >
          <canvas ref={canvasRef} className="shadow border" />

          {error && (
            <div className="absolute left-0 top-0 w-full p-3 bg-red-50 text-red-800 text-sm border border-red-200">
              PDF load error: <span className="font-mono">{String(error)}</span>
            </div>
          )}

          {viewport.width > 0 &&
            current.map((s, i) => {
              const r = fromNorm(s.rect, viewport.width, viewport.height);
              const active = i === activeIndex;
              return (
                <div
                  key={i}
                  className="absolute"
                  style={{
                    left: r.x,
                    top: r.y,
                    width: r.w,
                    height: r.h,
                    border: `2px solid ${s.color}`,
                    boxShadow: active ? `0 0 0 2px ${s.color}40` : "none",
                    background: `${s.color}1a`,
                  }}
                >
                  <HandleDots
                    r={r}
                    active={active}
                    onMouseDown={(e, handle) => {
                      e.stopPropagation();
                      const rect = containerRef.current.getBoundingClientRect();
                      const x = clamp(e.clientX - rect.left, 0, viewport.width);
                      const y = clamp(e.clientY - rect.top, 0, viewport.height);
                      setDragging({ mode: "resize", handle, startMouse: { x, y }, startRect: { ...r } });
                    }}
                  />
                  <div className="absolute text-[11px] font-semibold px-1.5 py-0.5 rounded-br" style={{ left: 0, top: 0, color: "#fff", background: s.color }}>
                    {s.type.toUpperCase()}
                  </div>
                </div>
              );
            })}

          {draft && (
            <div
              className="absolute border-2 border-dashed"
              style={{
                left: draft.x,
                top: draft.y,
                width: draft.w,
                height: draft.h,
                borderColor: draft.color,
                background: `${draft.color}14`,
              }}
            />
          )}
        </div>

        <div className="border rounded-lg p-3 bg-white/60">
          <div className="font-semibold mb-2">Wyniki (page {pageNum})</div>
          {currentValues.length === 0 ? (
            <div className="text-sm text-gray-500">Brak zaznaczen.</div>
          ) : (
            <ul className="space-y-2">
              {currentValues.map((row) => (
                <li key={row.index} className="text-sm">
                  <span className="inline-block min-w-16 px-1 py-0.5 rounded mr-2 text-white" style={{ background: chipColor(row.type) }}>
                    {row.type}
                  </span>
                  <span className="align-middle break-words">{row.text || <em className="text-gray-500">-</em>}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function chipColor(t) {
  if (t === Tool.TABLE) return COLORS.table[1];
  if (t === Tool.COLUMN) return COLORS.column[1];
  return COLORS.row[1];
}

function Legend({ label, color }) {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-block w-3 h-3 rounded" style={{ background: color }} />
      <span>{label}</span>
    </div>
  );
}
