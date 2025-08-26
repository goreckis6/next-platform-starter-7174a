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

// ciaśniejsza tolerancja
const EPS = 0.25;
// minimalny wymagany procent pokrycia ROW/COLUMN w TABLE, aby zaliczyć (0..1)
const OVERLAP_T = 0.35;

function pointInRect(px, py, r) {
  return px >= r.x - EPS && px <= r.x + r.w + EPS && py >= r.y - EPS && py <= r.y + r.h + EPS;
}
function rectsIntersect(r1, r2) {
  return !(
    r2.x > r1.x + r1.w + EPS ||
    r2.x + r2.w < r1.x - EPS ||
    r2.y > r1.y + r1.h + EPS ||
    r2.y + r2.h < r1.y - EPS
  );
}
function rectIntersection(a, b) {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  if (x2 <= x1 || y2 <= y1) return null;
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}
function rectArea(r) { return Math.max(0, r.w) * Math.max(0, r.h); }
function overlapRatio(container, candidate) {
  const inter = rectIntersection(container, candidate);
  if (!inter) return 0;
  const a = rectArea(candidate);
  if (a === 0) return 0;
  return rectArea(inter) / a;
}

// uchwyty
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

export default function InspectClient({ pdfUrl, pdfData, uuid, pdfName: pdfNameProp }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const [pdfjs, setPdfjs] = useState(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pageNum, setPageNum] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [scale, setScale] = useState(1.25);
  const [viewport, setViewport] = useState({ width: 0, height: 0, transform: [1, 0, 0, 1, 0, 0] });
  const [error, setError] = useState(null);

  // nazwa dokumentu (dla CSV)
  const [docName, setDocName] = useState("file");
  // licznik do twardego przeładowania PDF-a
  const [reloadTick, setReloadTick] = useState(0);

  // cache: { [page]: { items, viewportTransform } }
  const [textCache, setTextCache] = useState({});

  // selections[page] = [{ type, color, rect }]
  const [selections, setSelections] = useState({});
  const [tool, setTool] = useState(Tool.TABLE);
  const colorIndexRef = useRef({ table: 0, column: 0, row: 0 });

  const [draft, setDraft] = useState(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [dragging, setDragging] = useState(null);

  // per page: { tables: [...], loose: [...] }
  const [pageData, setPageData] = useState({});

  // helper: wyciąganie nazwy pliku z URL lub propsa
  const deriveDocName = useCallback(() => {
    if (typeof pdfNameProp === "string" && pdfNameProp.trim()) return pdfNameProp.trim();

    let name = "";
    if (typeof pdfUrl === "string" && pdfUrl) {
      try {
        const u = new URL(pdfUrl, typeof window !== "undefined" ? window.location.href : "http://local");
        name = (u.pathname.split("/").pop() || "").split("?")[0];
      } catch {
        name = pdfUrl.split("/").pop() || "";
      }
    }
    if (!name && pdfData && typeof pdfData === "object" && "name" in pdfData && pdfData.name) {
      name = String(pdfData.name);
    }
    return name || "file.pdf";
  }, [pdfNameProp, pdfUrl, pdfData]);

  // init pdf.js + worker
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

  // load doc
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!pdfjs) return;
      if (!pdfUrl && !pdfData) return;

      setError(null);
      if (pdfDoc) {
        try { await pdfDoc.destroy(); } catch {}
      }
      setPdfDoc(null);
      setTextCache({});
      setPageData({});

      try {
        const name = deriveDocName();
        setDocName(name);

        const bustUrl = (u) => (typeof u === "string" ? `${u}${u.includes("?") ? "&" : "?"}ts=${Date.now()}-${reloadTick}` : u);
        const params = pdfData ? { data: pdfData } : { url: bustUrl(pdfUrl), httpHeaders: { "Cache-Control": "no-cache" } };
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
  }, [pdfUrl, pdfData, pdfjs, reloadTick, deriveDocName]);

  // render + cache text with viewport transform
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

    const txt = await page.getTextContent({ includeMarkedContent: true, disableCombineTextItems: false });
    setTextCache((prev) => ({
      ...prev,
      [pageNum]: { items: txt.items, vpTransform: vp.transform },
    }));
  }, [pdfDoc, pageNum, scale]);

  useEffect(() => {
    renderPage().catch((e) => console.error("Render error:", e));
  }, [renderPage]);

  // helpers – current selections
  const current = selections[pageNum] || [];
  const setCurrent = (updater) =>
    setSelections((prev) => {
      const arr = prev[pageNum] || [];
      const next = typeof updater === "function" ? updater(arr) : updater;
      return { ...prev, [pageNum]: next };
    });

  // toolbar
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

  // hit tests
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

  // mouse
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
      if (h) setDragging({ mode: "resize", handle: h, startMouse: { x: sx, y: sy }, startRect: r });
      else setDragging({ mode: "move", handle: null, startMouse: { x: sx, y: sy }, startRect: r });
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
          next[activeIndex] = { ...next[activeIndex], rect: toNorm(r.x, r.y, r.w, r.h, viewport.width, viewport.height) };
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

  // ----- PRECYZYJNE BBOXY TEKSTU W KOORDYNATACH VIEWPORTU -----
  const getTextBoxesForPage = useCallback(
    (pageNumber) => {
      const entry = textCache[pageNumber];
      if (!entry || !pdfjs) return [];
      const { items, vpTransform } = entry;
      const Util = pdfjs.Util;

      return items.map((it) => {
        const T = Util.transform(vpTransform, it.transform || [1, 0, 0, 1, 0, 0]);
        const x = T[4];
        const w = (it.width ?? 0) || Math.hypot(T[0], T[2]);
        const h = Math.hypot(T[1], T[3]);
        const yTop = T[5] - h; // top-left
        return { it, x, y: yTop, w, h };
      });
    },
    [textCache, pdfjs]
  );

  const collectTextInRect = useCallback((rect, boxes) => {
    // bierzemy glify, których środek leży w prostokącie komórki
    const inside = (bx) => {
      const cx = bx.x + bx.w / 2;
      const cy = bx.y + bx.h / 2;
      return pointInRect(cx, cy, rect);
    };
    const picked = [];
    for (const bx of boxes) if (inside(bx)) picked.push(bx);
    picked.sort((a, b) => {
      const dy = a.y - b.y;
      if (Math.abs(dy) > 0.75) return dy;
      return a.x - b.x;
    });
    return picked.map((bx) => bx.it.str).join(" ");
  }, []);

  // ----- BUDOWA TABEL (TABLE + ROW + COLUMN) -----
  const buildTablesForPage = useCallback(
    (page) => {
      const sels = selections[page] || [];
      if (viewport.width === 0 || viewport.height === 0) return { tables: [], loose: [] };

      const tables = [];
      const rows = [];
      const cols = [];
      for (const s of sels) {
        const r = fromNorm(s.rect, viewport.width, viewport.height);
        if (s.type === Tool.TABLE) tables.push({ ...s, rectPx: r });
        else if (s.type === Tool.ROW) rows.push({ ...s, rectPx: r });
        else if (s.type === Tool.COLUMN) cols.push({ ...s, rectPx: r });
      }

      const resultTables = tables.map((t) => {
        const tRect = t.rectPx;

        const inRows = rows
          .filter((r) => {
            const cx = r.rectPx.x + r.rectPx.w / 2;
            const cy = r.rectPx.y + r.rectPx.h / 2;
            // kryterium: środek w TABLE LUB wystarczające pokrycie powierzchni
            return pointInRect(cx, cy, tRect) || overlapRatio(tRect, r.rectPx) >= OVERLAP_T;
          })
          .sort((a, b) => a.rectPx.y - b.rectPx.y)
          .map((r) => r.rectPx);

        const inCols = cols
          .filter((c) => {
            const cx = c.rectPx.x + c.rectPx.w / 2;
            const cy = c.rectPx.y + c.rectPx.h / 2;
            return pointInRect(cx, cy, tRect) || overlapRatio(tRect, c.rectPx) >= OVERLAP_T;
          })
          .sort((a, b) => a.rectPx.x - b.rectPx.x)
          .map((c) => c.rectPx);

        return { rect: tRect, rows: inRows.length ? inRows : [tRect], cols: inCols.length ? inCols : [tRect] };
      });

      const loose = [];
      for (const s of [...rows, ...cols]) {
        const centerX = s.rectPx.x + s.rectPx.w / 2;
        const centerY = s.rectPx.y + s.rectPx.h / 2;
        const inAnyTable = tables.some(
          (t) => pointInRect(centerX, centerY, t.rectPx) || overlapRatio(t.rectPx, s.rectPx) >= OVERLAP_T
        );
        if (!inAnyTable) loose.push({ type: s.type, rect: s.rectPx });
      }

      return { tables: resultTables, loose };
    },
    [selections, viewport.width, viewport.height]
  );

  // recompute pageData
  useEffect(() => {
    if (!pdfDoc) return;
    const pagesWithText = Object.keys(textCache).map((k) => parseInt(k, 10));
    if (pagesWithText.length === 0) return;

    setPageData((prev) => {
      const next = { ...prev };
      for (const p of pagesWithText) {
        const structure = buildTablesForPage(p);
        const boxes = getTextBoxesForPage(p);

        const tablesOut = structure.tables.map((T) => {
          const rowsRects = T.rows;
          const colsRects = T.cols;

          const cells = rowsRects.map((rr) =>
            colsRects.map((cc) => {
              const rc = rectIntersection(T.rect, rr);
              const cellRect = rc ? rectIntersection(rc, cc) : null;
              if (!cellRect) return "";
              return collectTextInRect(cellRect, boxes);
            })
          );

          return { rect: T.rect, rows: rowsRects, cols: colsRects, cells };
        });

        const looseOut = structure.loose.map((frag) => ({
          type: frag.type,
          rect: frag.rect,
          text: collectTextInRect(frag.rect, boxes),
        }));

        next[p] = { tables: tablesOut, loose: looseOut };
      }
      return next;
    });
  }, [selections, textCache, viewport.width, viewport.height, pdfDoc, buildTablesForPage, getTextBoxesForPage, collectTextInRect]);

  const currentPageData = pageData[pageNum] || { tables: [], loose: [] };

  // --- CSV builder (wyodrębniony, z mini-testami w DEV) ---
  function buildCSV(rows) {
    return rows
      .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
  }

  if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
    // proste testy w przeglądarce, tylko w DEV
    (function runSelfTests() {
      try {
        // CSV
        const rows1 = [["a", "b"], ["c", "d"]];
        const out1 = buildCSV(rows1);
        console.assert(out1 === '"a","b"\n"c","d"', "CSV: podstawowy join z LF");
        const rows2 = [["a,b", "c"], ['He said "Hi"']];
        const out2 = buildCSV(rows2);
        console.assert(out2.includes('"a,b"'), "CSV: przecinek w polu -> cudzysłów");
        console.assert(out2.includes('"He said ""Hi"""'), "CSV: cudzysłowy podwajane");

        // Geometria overlap
        const A = { x: 0, y: 0, w: 100, h: 100 };
        const B = { x: 25, y: 25, w: 10, h: 10 };
        const C = { x: 80, y: 0, w: 40, h: 40 }; // 1/4 poza
        const rAB = overlapRatio(A, B);
        const rAC = overlapRatio(A, C);
        console.assert(Math.abs(rAB - 1) < 1e-9, "overlapRatio: środek w 100% wewnątrz -> 1");
        console.assert(rAC > 0 && rAC < 1, "overlapRatio: częściowe pokrycie w (0,1)");
      } catch (e) {
        console.warn("Self-tests failed:", e);
      }
    })();
  }

  // export CSV
  const handleExportCSV = async () => {
    // Zbieramy TYLKO komórki tabel (bez metadanych page/table/row, bez loose)
    const pages = Object.keys(pageData)
      .map((n) => parseInt(n, 10))
      .filter((p) => (pageData[p]?.tables?.length || 0) > 0)
      .sort((a, b) => a - b);

    const rows = [];
    for (const p of pages) {
      const d = pageData[p];
      d.tables.forEach((T) => {
        // Każdy wiersz tabeli to wiersz CSV
        T.cells.forEach((row) => rows.push([...row]));
        // Przerwa między tabelami
        rows.push([]);
      });
    }

    // Jeżeli nie było żadnej tabeli, wyeksportuj pusty plik z jedną pustą linią
    if (rows.length === 0) rows.push([]);

    const csv = buildCSV(rows);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const base = String(docName || "file").replace(/\.[^.]+$/, "");
    a.download = `${base}.csv`;
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
          <button
            className={`px-3 py-1 border rounded text-white ${tool === Tool.TABLE ? "ring-2 ring-offset-1" : ""}`}
            style={{ background: COLORS.table[0], borderColor: COLORS.table[0], opacity: tool === Tool.TABLE ? 1 : 0.85 }}
            onClick={() => setTool(Tool.TABLE)}
          >
            [1] Create Table
          </button>
          <button
            className={`px-3 py-1 border rounded text-white ${tool === Tool.COLUMN ? "ring-2 ring-offset-1" : ""}`}
            style={{ background: COLORS.column[0], borderColor: COLORS.column[0], opacity: tool === Tool.COLUMN ? 1 : 0.85 }}
            onClick={() => setTool(Tool.COLUMN)}
          >
            [2] Add Column
          </button>
          <button
            className={`px-3 py-1 border rounded text-white ${tool === Tool.ROW ? "ring-2 ring-offset-1" : ""}`}
            style={{ background: COLORS.row[0], borderColor: COLORS.row[0], opacity: tool === Tool.ROW ? 1 : 0.85 }}
            onClick={() => setTool(Tool.ROW)}
          >
            [3] Add Row
          </button>
        </div>

        <span className="mx-1" />
        <button className="px-3 py-1 border rounded hover:bg-gray-100" onClick={zoomIn}>[+] Zoom</button>
        <button className="px-3 py-1 border rounded hover:bg-gray-100" onClick={zoomOut}>[-] Zoom</button>
        <button className="px-3 py-1 border rounded hover:bg-gray-100" onClick={prevPage}>&lt; Prev</button>
        <button className="px-3 py-1 border rounded hover:bg-gray-100" onClick={nextPage}>Next &gt;</button>
        <button className="px-3 py-1 border rounded hover:bg-gray-100" onClick={() => setReloadTick((t) => t + 1)}>Reload</button>

        <div className="ml-auto flex items-center gap-2">
          <Legend label="Table" color={COLORS.table[0]} />
          <Legend label="Column" color={COLORS.column[0]} />
          <Legend label="Row" color={COLORS.row[0]} />
          <button onClick={handleExportCSV} className="px-4 py-2 rounded-md text-white font-semibold bg-emerald-600 hover:bg-emerald-700">Export CSV</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[auto_420px] gap-6">
        <div
          className="relative inline-block select-none"
          ref={containerRef}
          style={{ lineHeight: 0 }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
        >
          <canvas ref={canvasRef} className="shadow border" />

          {error && (
            <div className="absolute left-0 top-0 w-full p-3 bg-red-50 text-red-800 text-sm border border-red-200">
              PDF load error: <span className="font-mono">{String(error)}</span>
            </div>
          )}

          {(selections[pageNum] || []).map((s, i) => {
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
                onMouseDown={(e) => {
                  const rect = containerRef.current.getBoundingClientRect();
                  const x = clamp(e.clientX - rect.left, 0, viewport.width);
                  const y = clamp(e.clientY - rect.top, 0, viewport.height);
                  setActiveIndex(i);
                  const h = hitTestHandle(x, y, i);
                  const rpx = { ...r };
                  if (h) setDragging({ mode: "resize", handle: h, startMouse: { x, y }, startRect: rpx });
                  else setDragging({ mode: "move", handle: null, startMouse: { x, y }, startRect: rpx });
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
                <div
                  className="absolute text-[11px] font-semibold px-1.5 py-0.5 rounded-br"
                  style={{ left: 0, top: 0, color: "#fff", background: s.color }}
                >
                  {s.type.toUpperCase()}
                </div>
              </div>
            );
          })}

          {draft && (
            <div
              className="absolute border-2 border-dashed"
              style={{ left: draft.x, top: draft.y, width: draft.w, height: draft.h, borderColor: draft.color, background: `${draft.color}14` }}
            />
          )}
        </div>

        {/* RIGHT PANEL */}
        <div className="border rounded-lg p-3 bg-white/60 overflow-auto max-h-[80vh]">
          <div className="font-semibold mb-2">Wyniki (page {pageNum})</div>

          {currentPageData.tables.length === 0 && currentPageData.loose.length === 0 ? (
            <div className="text-sm text-gray-500">Brak danych — narysuj TABLE, a w nim ROW/COLUMN.</div>
          ) : null}

          {currentPageData.tables.map((T, ti) => (
            <div key={ti} className="mb-4">
              <div className="text-sm font-medium mb-1">Table #{ti + 1} — {T.rows.length} rows × {T.cols.length} cols</div>
              <div className="overflow-auto">
                <table className="min-w-full border text-sm">
                  <tbody>
                    {T.cells.map((row, ri) => (
                      <tr key={ri}>
                        {row.map((cell, ci) => (
                          <td key={ci} className="border px-2 py-1 align-top">{cell || <span className="text-gray-400">—</span>}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {currentPageData.loose.length > 0 && (
            <>
              <div className="text-sm font-medium mt-4 mb-1">Loose selections</div>
              <ul className="space-y-1 text-sm">
                {currentPageData.loose.map((L, i) => (
                  <li key={i}>
                    <span
                      className="inline-block min-w-16 px-1 py-0.5 rounded mr-2 text-white"
                      style={{ background: L.type === Tool.COLUMN ? COLORS.column[1] : COLORS.row[1] }}
                    >
                      {L.type}
                    </span>
                    {L.text || <span className="text-gray-400">—</span>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Legend({ label, color }) {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-block w-3 h-3 rounded" style={{ background: color }} />
      <span>{label}</span>
    </div>
  );
}
