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

const EPS = 0.25;
const OVERLAP_T = 0.35;
const SHOW_HANDLES = false;

// ---- geometry helpers
function pointInRect(px, py, r) {
  return px >= r.x - EPS && px <= r.x + r.w + EPS && py >= r.y - EPS && py <= r.y + r.h + EPS;
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
function arrayMove(arr, from, to) {
  const a = arr.slice();
  if (from === to || from < 0 || to < 0 || from >= a.length || to >= a.length) return a;
  const [it] = a.splice(from, 1);
  a.splice(to, 0, it);
  return a;
}

// ---- optional handles (hidden)
const HandleDots = ({ r, active, onMouseDown }) =>
  active && SHOW_HANDLES ? (
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

export default function InspectClient({ pdfUrl, pdfData, uuid, pdfName: pdfNameProp, fullWindow = false }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const [pdfjs, setPdfjs] = useState(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pageNum, setPageNum] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [scale, setScale] = useState(1.25);
  const [viewport, setViewport] = useState({ width: 0, height: 0, transform: [1, 0, 0, 1, 0, 0] });
  const [error, setError] = useState(null);

  const [docName, setDocName] = useState("file");
  const [reloadTick, setReloadTick] = useState(0);

  const [textCache, setTextCache] = useState({});
  const [selections, setSelections] = useState({});
  const [tool, setTool] = useState(Tool.TABLE);
  const colorIndexRef = useRef({ table: 0, column: 0, row: 0 });

  const [draft, setDraft] = useState(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [dragging, setDragging] = useState(null);

  const [pageData, setPageData] = useState({});
  const [tableOrders, setTableOrders] = useState({});
  const [autoBuild, setAutoBuild] = useState(true);
  const [smartDetect, setSmartDetect] = useState(true);

  const autoCols = true;
  const maxCols = 6;

  const [manualLinks, setManualLinks] = useState({});
  const [draggingLoose, setDraggingLoose] = useState(null);
  const [dragHover, setDragHover] = useState(null);

  // ===== Export Settings (⚙️) =====
  const [showExport, setShowExport] = useState(false);
  const [exportType, setExportType] = useState("xlsx"); // 'xlsx' | 'csv'
  const TRANSACTION_COLUMNS = [
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

  // DOMYŚLNE: Date, Description, Debit, Balance
  const [selectedCols, setSelectedCols] = useState(new Set(["Date", "Description", "Debit", "Balance"]));

  // Mapowanie wierszy -> kolumny (heurystyka)
  const [mapDetectedRows, setMapDetectedRows] = useState(true);

  const toggleCol = (label) =>
    setSelectedCols((prev) => {
      const n = new Set(prev);
      if (n.has(label)) n.delete(label);
      else n.add(label);
      return n;
    });

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

  // init pdfjs
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (typeof window === "undefined") return;
      try {
        const lib = await import("pdfjs-dist");
        let workerUrl;
        try { const w = await import("pdfjs-dist/build/pdf.worker.mjs?url"); workerUrl = w?.default; }
        catch { try { const w = await import("pdfjs-dist/build/pdf.worker.min.mjs?url"); workerUrl = w?.default; }
        catch { try { const w = await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"); workerUrl = w?.default; } catch {} } }
        if (workerUrl) lib.GlobalWorkerOptions.workerSrc = workerUrl;
        if (mounted) setPdfjs(lib);
      } catch (e) { console.error(e); if (mounted) setError("PDF.js init failed"); }
    })();
    return () => { mounted = false; };
  }, []);

  // load doc
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!pdfjs) return;
      if (!pdfUrl && !pdfData) return;

      setError(null);
      if (pdfDoc) { try { await pdfDoc.destroy(); } catch {} }
      setPdfDoc(null);
      setTextCache({});
      setPageData({});
      setTableOrders({});
      setManualLinks({});
      setDraggingLoose(null);
      setDragHover(null);

      try {
        const name = deriveDocName(); setDocName(name);
        const bustUrl = (u) => (typeof u === "string" ? `${u}${u.includes("?") ? "&" : "?"}ts=${Date.now()}-${reloadTick}` : u);
        const params = pdfData ? { data: pdfData } : { url: bustUrl(pdfUrl), httpHeaders: { "Cache-Control": "no-cache" } };
        const doc = await pdfjs.getDocument(params).promise;
        if (!mounted) return;
        setPdfDoc(doc); setPageCount(doc.numPages); setPageNum(1);
      } catch (err) {
        console.error(err); if (!mounted) return;
        setError(err?.message || "PDF load error"); setPdfDoc(null); setPageCount(1); setPageNum(1);
      }
    })();
    return () => { mounted = false; };
  }, [pdfUrl, pdfData, pdfjs, reloadTick, deriveDocName]);

  // render + text
  const renderPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current) return;
    const page = await pdfDoc.getPage(pageNum);
    const vp = page.getViewport({ scale });
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    canvas.width = vp.width; canvas.height = vp.height;
    setViewport({ width: vp.width, height: vp.height, transform: vp.transform });
    await page.render({ canvasContext: ctx, viewport: vp }).promise;

    const txt = await page.getTextContent({ includeMarkedContent: true, disableCombineTextItems: false });
    setTextCache((prev) => ({ ...prev, [pageNum]: { items: txt.items, vpTransform: vp.transform } }));
  }, [pdfDoc, pageNum, scale]);
  useEffect(() => { renderPage().catch((e) => console.error("Render error:", e)); }, [renderPage]);

  // selections helpers
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
  const prevPage = () => { setActiveIndex(-1); setPageNum((n) => Math.max(1, n - 1)); };
  const nextPage = () => { setActiveIndex(-1); setPageNum((n) => Math.min(pageCount, n + 1)); };

  const nextColorFor = (t) => { const list = COLORS[t]; const i = colorIndexRef.current[t] % list.length; colorIndexRef.current[t] = i + 1; return list[i]; };

  // hit tests
  const pxFromNorm = (nr) => fromNorm(nr, viewport.width, viewport.height);
  const hitTestBox = (x, y) => { for (let i = current.length - 1; i >= 0; i--) { const r = pxFromNorm(current[i].rect); if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i; } return -1; };
  const hitTestHandle = (x, y, idx) => {
    const r = pxFromNorm(current[idx].rect); const size = 8;
    const near = (px, py) => Math.abs(x - px) <= size && Math.abs(y - py) <= size;
    if (near(r.x, r.y)) return "tl"; if (near(r.x + r.w, r.y)) return "tr";
    if (near(r.x, r.y + r.h)) return "bl"; if (near(r.x + r.w, r.y + r.h)) return "br";
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
      const h = SHOW_HANDLES ? hitTestHandle(sx, sy, hitIdx) : null;
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
        const dx = x - startMouse.x; const dy = y - startMouse.y;
        const nx = clamp(startRect.x + dx, 0, viewport.width - startRect.w);
        const ny = clamp(startRect.y + dy, 0, viewport.height - startRect.h);
        setCurrent((prev) => { const next = [...prev]; next[activeIndex] = { ...next[activeIndex], rect: toNorm(nx, ny, startRect.w, startRect.h, viewport.width, viewport.height) }; return next; });
      } else if (mode === "resize") {
        const r = { ...startRect }; const minSize = 8;
        if (["tl","l","bl"].includes(handle)) { const nx = clamp(Math.min(x, r.x + r.w - minSize), 0, viewport.width); r.w = r.x + r.w - nx; r.x = nx; }
        if (["tr","r","br"].includes(handle)) { const nx2 = clamp(Math.max(x, r.x + minSize), 0, viewport.width); r.w = nx2 - r.x; }
        if (["tl","t","tr"].includes(handle)) { const ny = clamp(Math.min(y, r.y + r.h - minSize), 0, viewport.height); r.h = r.y + r.h - ny; r.y = ny; }
        if (["bl","b","br"].includes(handle)) { const ny2 = clamp(Math.max(y, r.y + minSize), 0, viewport.height); r.h = ny2 - r.y; }
        setCurrent((prev) => { const next = [...prev]; next[activeIndex] = { ...next[activeIndex], rect: toNorm(r.x, r.y, r.w, r.h, viewport.width, viewport.height) }; return next; });
      }
      return;
    }

    if (draft) {
      const w = x - draft.x; const h = y - draft.y;
      const W = Math.abs(w); const H = Math.abs(h);
      const nx = w < 0 ? draft.x - W : draft.x; const ny = h < 0 ? draft.y - H : draft.y;
      setDraft({ ...draft, x: nx, y: ny, w: W, h: H });
    }
  };
  const onMouseUp = () => {
    if (dragging) { setDragging(null); return; }
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
        if (activeIndex >= 0) { setCurrent((prev) => prev.filter((_, i) => i !== activeIndex)); setActiveIndex(-1); }
      }
      if (e.key === "1") setTool(Tool.TABLE);
      if (e.key === "2") setTool(Tool.COLUMN);
      if (e.key === "3") setTool(Tool.ROW);
      if (e.key === "+") zoomIn();
      if (e.key === "-") zoomOut();
      if (e.key === "<" || e.key === ",") prevPage();
      if (e.key === ">" || e.key === ".") nextPage();
      if (e.key === "Escape") { setDraggingLoose(null); setDragHover(null); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeIndex, pageNum, pageCount]);

  // text boxes in viewport coords
  const getTextBoxesForPage = useCallback((pageNumber) => {
    const entry = textCache[pageNumber];
    if (!entry || !pdfjs) return [];
    const { items, vpTransform } = entry;
    const Util = pdfjs.Util;
    return (items || []).map((it) => {
      const T = Util.transform(vpTransform || [1,0,0,1,0,0], it.transform || [1, 0, 0, 1, 0, 0]);
      const x = T[4];
      const w = (it.width ?? 0) || Math.hypot(T[0], T[2]);
      const h = Math.hypot(T[1], T[3]);
      const yTop = T[5] - h;
      return { it, x, y: yTop, w, h };
    });
  }, [textCache, pdfjs]);

  const collectTextInRect = useCallback((rect, boxes) => {
    const inside = (bx) => { const cx = bx.x + bx.w / 2; const cy = bx.y + bx.h / 2; return pointInRect(cx, cy, rect); };
    const picked = []; for (const bx of boxes) if (inside(bx)) picked.push(bx);
    picked.sort((a, b) => { const dy = a.y - b.y; if (Math.abs(dy) > 0.75) return dy; return a.x - b.x; });
    return picked.map((bx) => bx.it.str).join(" ");
  }, []);

  // ---------- KMEANS 1D HELPERS ----------
  function kmeans1D(xs, k, maxIter = 25) {
    if (k <= 1) return { centroids: [mean(xs)], labels: xs.map(() => 0) };
    const min = xs[0], max = xs[xs.length - 1];
    let centroids = Array.from({ length: k }, (_, i) => min + ((i + 0.5) / k) * (max - min));
    let labels = new Array(xs.length).fill(0);

    for (let iter = 0; iter < maxIter; iter++) {
      for (let i = 0; i < xs.length; i++) {
        let best = 0, bestd = Infinity;
        for (let c = 0; c < k; c++) {
          const d = Math.abs(xs[i] - centroids[c]);
          if (d < bestd) { bestd = d; best = c; }
        }
        labels[i] = best;
      }
      const sums = new Array(k).fill(0);
      const counts = new Array(k).fill(0);
      for (let i = 0; i < xs.length; i++) { sums[labels[i]] += xs[i]; counts[labels[i]]++; }
      const newC = centroids.slice();
      for (let c = 0; c < k; c++) newC[c] = counts[c] === 0 ? min + Math.random() * (max - min) : sums[c] / counts[c];
      const shift = newC.reduce((s, v, i) => s + Math.abs(v - centroids[i]), 0) / k;
      centroids = newC;
      if (shift < 1e-3) break;
    }
    const order = centroids.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]).map(([_, i]) => i);
    const centSorted = order.map((oi) => centroids[oi]);
    const mapOldToNew = new Map(order.map((oi, newi) => [oi, newi]));
    const labelsSorted = labels.map((l) => mapOldToNew.get(l));
    return { centroids: centSorted, labels: labelsSorted };
  }
  function mean(arr) { return arr.reduce((s, v) => s + v, 0) / Math.max(1, arr.length); }
  function stddev(arr) { if (!arr.length) return 0; const m = mean(arr); return Math.sqrt(arr.reduce((s, v) => s + (v - m) * (v - m), 0) / arr.length); }

  // ---------- SMART DETECT (auto cols 2..maxCols) ----------
  const inferGrid = useCallback((tableRect, boxes) => {
    let words = boxes.filter((bx) => {
      const cx = bx.x + bx.w / 2, cy = bx.y + bx.h / 2;
      return pointInRect(cx, cy, tableRect);
    });
    const noiseRe = /^[\s.\-–—·•]+$/u;
    words = words.filter(w => !noiseRe.test((w.it?.str || "").trim()));
    if (words.length < 2) return { rows: [tableRect], cols: [tableRect] };

    const avgH = words.reduce((s, w) => s + w.h, 0) / words.length;
    const rowTh = Math.max(6, avgH * 0.7);
    const longLineChars = 100; // Increased for bank statements
    const longLineTokens = 20; // Increased for bank statements

    const yItems = words.map(w => ({ y: w.y + w.h / 2, y0: w.y, y1: w.y + w.h, str: w.it?.str || "" }));
    yItems.sort((a, b) => a.y - b.y);
    const rowClusters = [];
    for (const it of yItems) {
      const last = rowClusters[rowClusters.length - 1];
      if (!last) rowClusters.push({ yMin: it.y0, yMax: it.y1, ys: [it.y], items: [it] });
      else {
        const meanY = last.ys.reduce((s, v) => s + v, 0) / last.ys.length;
        // More lenient row clustering for bank statements
        if (Math.abs(it.y - meanY) <= rowTh * 1.5) {
          last.yMin = Math.min(last.yMin, it.y0);
          last.yMax = Math.max(last.yMax, it.y1);
          last.ys.push(it.y);
          last.items.push(it);
        } else {
          rowClusters.push({ yMin: it.y0, yMax: it.y1, ys: [it.y], items: [it] });
        }
      }
    }
    const rows = rowClusters
      .filter(c => (c.items.map(i => i.str).join(" ").trim().length <= longLineChars))
      .map(c => ({
        x: tableRect.x,
        y: Math.max(tableRect.y, c.yMin),
        w: tableRect.w,
        h: Math.min(tableRect.y + tableRect.h, c.yMax) - Math.max(tableRect.y, c.yMin),
      }))
      .filter(r => r.h > 2);

    // columns K=2..maxCols
    const xm = words.map(w => w.x + w.w / 2).sort((a, b) => a - b);
    let best = { k: 1, score: -Infinity, labels: null, centroids: null };
    const KMAX = Math.max(2, Math.min(maxCols | 0, 12));
    for (let k = 2; k <= KMAX; k++) {
      const { centroids, labels } = kmeans1D(xm, k);
      const inter = centroids.length > 1
        ? centroids.slice(1).reduce((s, c, i) => s + (c - centroids[i]), 0) / (centroids.length - 1)
        : 0;
      const buckets = Array.from({ length: k }, () => []);
      xm.forEach((v, i) => buckets[labels[i]].push(v));
      const intra = buckets.reduce((s, arr) => s + stddev(arr), 0) / k;
      // Reduced penalty for bank statements which may have uneven column distribution
      const tinyPenalty = buckets.filter(arr => arr.length < 2).length * 2;
      const score = inter - intra - tinyPenalty;
      if (score > best.score) best = { k, score, labels, centroids };
    }

    const cents = best.centroids;
    const wordLabels = words.map(w => {
      const xmid = w.x + w.w / 2;
      let besti = 0, bestd = Infinity;
      for (let i = 0; i < cents.length; i++) {
        const d = Math.abs(xmid - cents[i]);
        if (d < bestd) { bestd = d; besti = i; }
      }
      return besti;
    });
    const byCol = Array.from({ length: best.k }, () => []);
    words.forEach((w, i) => byCol[wordLabels[i]].push(w));
    let cols = [];
    for (let ci = 0; ci < byCol.length; ci++) {
      const pts = byCol[ci];
      if (!pts.length) continue;
      const x0 = Math.min(...pts.map(p => p.x));
      const x1 = Math.max(...pts.map(p => p.x + p.w));
      cols.push({
        x: Math.max(tableRect.x, x0),
        y: tableRect.y,
        w: Math.max(5, Math.min(tableRect.x + tableRect.w, x1) - Math.max(tableRect.x, x0)), // Reduced min width for bank statements
        h: tableRect.h,
      });
    }
    cols.sort((a, b) => a.x - b.x);
    if (!cols.length) cols = [tableRect];

    return { rows: rows.length ? rows : [tableRect], cols };
  }, [maxCols]);

  // build tables (autoBuild/manual/smartDetect)
  const buildTablesForPage = useCallback((page) => {
    const sels = selections[page] || [];
    if (viewport.width === 0 || viewport.height === 0) return { tables: [], loose: [] };

    const boxesAll = getTextBoxesForPage(page);

    const tables = [], rows = [], cols = [];
    for (const s of sels) {
      const r = fromNorm(s.rect, viewport.width, viewport.height);
      if (s.type === Tool.TABLE) tables.push({ ...s, rectPx: r });
      else if (s.type === Tool.ROW) rows.push({ ...s, rectPx: r });
      else if (s.type === Tool.COLUMN) cols.push({ ...s, rectPx: r });
    }

    let baseTables = tables.map((t) => {
      const tRect = t.rectPx;
      const inRows = rows
        .filter((r) => {
          const cx = r.rectPx.x + r.rectPx.w / 2; const cy = r.rectPx.y + r.rectPx.h / 2;
          return pointInRect(cx, cy, tRect) || overlapRatio(tRect, r.rectPx) >= OVERLAP_T;
        })
        .sort((a, b) => a.rectPx.y - b.rectPx.y)
        .map((r) => r.rectPx);
      const inCols = cols
        .filter((c) => {
          const cx = c.rectPx.x + c.rectPx.w / 2; const cy = c.rectPx.y + c.rectPx.h / 2;
          return pointInRect(cx, cy, tRect) || overlapRatio(tRect, c.rectPx) >= OVERLAP_T;
        })
        .sort((a, b) => a.rectPx.x - b.rectPx.x)
        .map((c) => c.rectPx);
      return { rect: tRect, rows: inRows, cols: inCols };
    });

    if (baseTables.length === 0 && rows.length > 0 && cols.length > 0 && autoBuild) {
      const mins = { x: Infinity, y: Infinity }, maxs = { x: -Infinity, y: -Infinity };
      const all = [...rows.map(r => r.rectPx), ...cols.map(c => c.rectPx)];
      all.forEach(r => { mins.x = Math.min(mins.x, r.x); mins.y = Math.min(mins.y, r.y); maxs.x = Math.max(maxs.x, r.x + r.w); maxs.y = Math.max(maxs.y, r.y + r.h); });
      const tRect = { x: mins.x, y: mins.y, w: maxs.x - mins.x, h: maxs.y - mins.y };
      const inRows = rows.sort((a,b)=>a.rectPx.y - b.rectPx.y).map(r=>r.rectPx);
      const inCols = cols.sort((a,b)=>a.rectPx.x - b.rectPx.x).map(c=>c.rectPx);
      baseTables = [{ rect: tRect, rows: inRows, cols: inCols }];
    }

    if (baseTables.length === 0 && smartDetect && boxesAll.length > 0) {
      const x0 = Math.min(...boxesAll.map(b => b.x));
      const y0 = Math.min(...boxesAll.map(b => b.y));
      const x1 = Math.max(...boxesAll.map(b => b.x + b.w));
      const y1 = Math.max(...boxesAll.map(b => b.y + b.h));
      const tRect = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
      baseTables = [{ rect: tRect, rows: [], cols: [] }];
    }

    // manual attachments from Loose
    const manual = manualLinks[page] || {};
    baseTables = baseTables.map((Tb, ti) => {
      const add = manual[ti] || { addRows: [], addCols: [] };
      const rowsMerged = [...Tb.rows, ...add.addRows].sort((a,b)=>a.y - b.y);
      const colsMerged = [...Tb.cols, ...add.addCols].sort((a,b)=>a.x - b.x);
      return { ...Tb, rows: rowsMerged, cols: colsMerged };
    });

    // infer missing rows/cols
    baseTables = baseTables.map((Tb) => {
      if (!smartDetect) return Tb;
      const needRows = (Tb.rows?.length || 0) === 0;
      const needCols = (Tb.cols?.length || 0) === 0;
      if (!needRows && !needCols) return Tb;
      const inferred = inferGrid(Tb.rect, boxesAll);
      return {
        ...Tb,
        rows: needRows ? inferred.rows : Tb.rows,
        cols: needCols ? inferred.cols : Tb.cols,
      };
    });

    // loose
    const allAssignedRects = new Set();
    baseTables.forEach((T) => {
      T.rows.forEach((r) => allAssignedRects.add(JSON.stringify(r)));
      T.cols.forEach((c) => allAssignedRects.add(JSON.stringify(c)));
    });

    const loose = [];
    for (const s of [...rows, ...cols]) {
      const key = JSON.stringify(s.rectPx);
      if (allAssignedRects.has(key)) continue;
      const cx = s.rectPx.x + s.rectPx.w / 2, cy = s.rectPx.y + s.rectPx.h / 2;
      const inAny = baseTables.some(t => pointInRect(cx, cy, t.rect) || overlapRatio(t.rect, s.rectPx) >= OVERLAP_T);
      if (!inAny) loose.push({ type: s.type, rect: s.rectPx });
    }

    return { tables: baseTables, loose };
  }, [selections, viewport.width, viewport.height, autoBuild, smartDetect, manualLinks, getTextBoxesForPage, inferGrid]);

  // text -> cells
  useEffect(() => {
    if (!pdfDoc) return;
    const pages = Object.keys(textCache).map((k) => +k);
    if (!pages.length) return;

    setPageData((prev) => {
      const next = { ...prev };
      for (const p of pages) {
        const structure = buildTablesForPage(p);
        const boxes = getTextBoxesForPage(p);

        const tablesOut = structure.tables.map((T) => {
          const rowsRects = T.rows.length ? T.rows : [T.rect];
          const colsRects = T.cols.length ? T.cols : [T.rect];
          const cells = rowsRects.map((rr) =>
            colsRects.map((cc) => {
              const rc = rectIntersection(T.rect, rr);
              const cellRect = rc ? rectIntersection(rc, cc) : null;
              return cellRect ? collectTextInRect(cellRect, boxes) : "";
            })
          );
          return { rect: T.rect, rows: rowsRects, cols: colsRects, cells };
        });

        const looseOut = structure.loose.map((frag) => ({
          type: frag.type, rect: frag.rect, text: collectTextInRect(frag.rect, boxes),
        }));

        next[p] = { tables: tablesOut, loose: looseOut };
      }
      return next;
    });
  }, [selections, textCache, viewport.width, viewport.height, pdfDoc, buildTablesForPage, getTextBoxesForPage, collectTextInRect]);

  // default orders for DnD
  useEffect(() => {
    setTableOrders((prev) => {
      const out = { ...prev };
      for (const [pStr, pdata] of Object.entries(pageData)) {
        const p = Number(pStr);
        pdata.tables?.forEach((T, ti) => {
          out[p] = out[p] || {};
          const cur = out[p][ti];
          const needRow = !cur || (cur.row?.length !== T.rows.length);
          const needCol = !cur || (cur.col?.length !== T.cols.length);
          out[p][ti] = {
            row: needRow ? Array.from({ length: T.rows.length }, (_, i) => i) : cur.row,
            col: needCol ? Array.from({ length: T.cols.length }, (_, i) => i) : cur.col,
          };
        });
      }
      return out;
    });
  }, [pageData]);

  const currentPageData = pageData[pageNum] || { tables: [], loose: [] };

  // ===== CSV/XLSX helpers =====
  function buildCSV(rows) {
    return rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  }
  async function ensureXLSX() {
    if (typeof window === "undefined") throw new Error("XLSX is only available in browser.");
    if (window.XLSX) return window.XLSX;
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Failed to load XLSX library"));
      document.head.appendChild(s);
    });
    return window.XLSX;
  }
  async function buildAndDownloadXLSX(rows, filenameBase) {
    try {
      const XLSX = await ensureXLSX();
      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
      const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filenameBase}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("XLSX export failed (library load). Falling back to CSV.");
      const rowsCSV = collectOrderedRows(true);
      const csv = buildCSV(rowsCSV);
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filenameBase}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }
  }

  // ====== TRANSACTION PARSER (heurystyka) ======
  const MONTHS_EN = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
  };

  function parseDateHeuristic(s) {
    const str = s.trim();

    // 1) Feb 17, 2025 / Feb 17 2025
    const m1 = str.match(/\b([A-Za-z]{3,})\s+(\d{1,2}),?\s+(\d{4})\b/);
    if (m1) {
      const mon = MONTHS_EN[m1[1].slice(0,3).toLowerCase()];
      if (mon) return `${m1[3]}-${String(mon).padStart(2,'0')}-${String(m1[2]).padStart(2,'0')}`;
    }

    // 2) 17/02/2025 or 17-02-2025 or 17.02.2025
    const m2 = str.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/);
    if (m2) {
      const dd = +m2[1], mm = +m2[2], yyyy = m2[3].length === 2 ? +(`20${m2[3]}`) : +m2[3];
      if (mm<=12 && dd<=31) return `${yyyy}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`;
    }

    // 3) 2025-02-17
    const m3 = str.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
    if (m3) {
      return `${m3[1]}-${String(m3[2]).padStart(2,'0')}-${String(m3[3]).padStart(2,'0')}`;
    }

    return null;
  }

  function normalizeNumberToken(tok) {
    let t = tok.replace(/\s+/g, '').replace(/[$€£zł]|PLN|USD|EUR/gi, '');
    let neg = false;
    if (/^\(.*\)$/.test(t)) { neg = true; t = t.slice(1,-1); }
    if (t.includes(',') && t.includes('.')) {
      const lastComma = t.lastIndexOf(',');
      const lastDot = t.lastIndexOf('.');
      if (lastComma > lastDot) {
        t = t.replace(/\./g, '').replace(',', '.');
      } else {
        t = t.replace(/,/g, '');
      }
    } else if (t.includes(',')) {
      const parts = t.split(',');
      if (parts[parts.length - 1].length === 2) {
        t = t.replace(/\./g, '').replace(/\s/g,'').replace(',', '.');
      } else {
        t = t.replace(/,/g, '');
      }
    } else {
      t = t.replace(/,/g, '');
    }
    const val = parseFloat(t);
    if (isNaN(val)) return null;
    return neg ? -val : val;
  }

  function detectCurrency(s) {
    const m = s.match(/\b(PLN|USD|EUR)\b|[€$]|zł/gi);
    if (!m) return null;
    const hit = m[0].toUpperCase();
    if (hit.includes('PLN') || hit.includes('ZŁ')) return 'PLN';
    if (hit.includes('EUR') || hit.includes('€')) return 'EUR';
    if (hit.includes('USD') || hit.includes('$')) return 'USD';
    return null;
  }

  // Enhanced function to parse multiple transactions from a single line
  function parseMultipleTransactions(line) {
    const src = (line || '').replace(/\s{2,}/g, ' ').trim();
    if (!src) return [{}];

    // Special pattern for bank statements with two transactions in one row
    // Pattern: Date Description Amount Date Description Ref Number Amount
    const bankStatementPattern = /^(\S+\s+\d{1,2},?\s+\d{4}|\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}-\d{2}-\d{2})\s+(.+?)\s+(-?[\d,.$€£złPLNEURUSD]+)\s+(\S+\s+\d{1,2},?\s+\d{4}|\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}-\d{2}-\d{2})\s+(.+?)\s+(\S+)\s+(-?[\d,.$€£złPLNEURUSD]+)$/;
    const match = src.match(bankStatementPattern);
    
    if (match) {
      // Extract first transaction
      const firstDate = match[1];
      const firstDesc = match[2];
      const firstAmount = match[3];
      
      // Extract second transaction
      const secondDate = match[4];
      const secondDesc = match[5];
      const refNumber = match[6];
      const secondAmount = match[7];
      
      // Parse amounts
      const firstParsedAmount = normalizeNumberToken(firstAmount);
      const secondParsedAmount = normalizeNumberToken(secondAmount);
      
      // Format dates
      const firstFormattedDate = parseDateHeuristic(firstDate);
      const secondFormattedDate = parseDateHeuristic(secondDate);
      
      return [
        {
          "Date": firstFormattedDate,
          "Description": firstDesc,
          "Amount": firstParsedAmount,
          "Debit": firstParsedAmount < 0 ? Math.abs(firstParsedAmount) : null,
          "Credit": firstParsedAmount > 0 ? firstParsedAmount : null
        },
        {
          "Date": secondFormattedDate,
          "Description": secondDesc,
          "Amount": secondParsedAmount,
          "Debit": secondParsedAmount < 0 ? Math.abs(secondParsedAmount) : null,
          "Credit": secondParsedAmount > 0 ? secondParsedAmount : null,
          "Reference Number": refNumber
        }
      ];
    }

    // Look for multiple date patterns which might indicate multiple transactions
    const datePatterns = [
      /\b([A-Za-z]{3,})\s+(\d{1,2}),?\s+(\d{4})\b/g,
      /\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/g,
      /\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/g
    ];

    let dateMatches = [];
    for (const pattern of datePatterns) {
      let match;
      while ((match = pattern.exec(src)) !== null) {
        dateMatches.push({
          match: match[0],
          index: match.index,
          fullMatch: match
        });
      }
    }

    // Sort by position in string
    dateMatches.sort((a, b) => a.index - b.index);

    // If we found multiple dates, split the line into multiple transactions
    if (dateMatches.length > 1) {
      const transactions = [];
      for (let i = 0; i < dateMatches.length; i++) {
        const start = dateMatches[i].index;
        const end = i < dateMatches.length - 1 ? dateMatches[i + 1].index : src.length;
        const segment = src.substring(start, end).trim();
        const parsed = parseSingleTransaction(segment);
        if (Object.keys(parsed).length > 0) {
          transactions.push(parsed);
        }
      }
      return transactions.length > 0 ? transactions : [parseSingleTransaction(src)];
    }

    // If only one or no dates, parse as single transaction
    return [parseSingleTransaction(src)];
  }

  // Original single transaction parser, renamed for clarity
  function parseSingleTransaction(line) {
    const src = (line || '').replace(/\s{2,}/g, ' ').trim();
    if (!src) return {};

    const dt = parseDateHeuristic(src);

    const numTokens = [];
    const tokenRegex = /-?\(?\d[\d\s.,]*\)?/g;
    let m;
    while ((m = tokenRegex.exec(src)) !== null) {
      const n = normalizeNumberToken(m[0]);
      if (n !== null) numTokens.push({ raw: m[0], val: n, start: m.index, end: m.index + m[0].length });
    }

    let balance = null, amount = null;
    if (numTokens.length >= 1) {
      balance = numTokens[numTokens.length - 1].val;
    }
    if (numTokens.length >= 2) {
      amount = numTokens[numTokens.length - 2].val;
    }

    const currency = detectCurrency(src);

    let credit = null, debit = null;
    if (amount !== null) {
      if (amount < 0) debit = Math.abs(amount);
      else credit = amount;
    }

    let desc = src;
    if (dt) {
      const dMonth = Object.keys(MONTHS_EN).find(k => new RegExp(`\\b${k}`, 'i').test(src));
      if (dMonth) {
        desc = desc.replace(/\b([A-Za-z]{3,})\s+\d{1,2},?\s+20\d{2}\b/, '').trim();
      } else {
        desc = desc.replace(/\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/, '').trim();
        desc = desc.replace(/\b20\d{2}-\d{1,2}-\d{1,2}\b/, '').trim();
      }
    }
    if (numTokens.length) {
      const last = numTokens[numTokens.length - 1];
      desc = desc.slice(0, last.start).trim();
    }
    desc = desc.replace(/\s{2,}/g, ' ').replace(/[•·]+/g, '').trim();

    const out = {};
    if (dt) out["Date"] = dt;
    if (desc) out["Description"] = desc;
    if (credit !== null) out["Credit"] = credit;
    if (debit !== null) out["Debit"] = debit;
    if (amount !== null) out["Amount"] = amount;
    if (balance !== null) out["Balance"] = balance;
    if (currency) out["Currency"] = currency;

    return out;
  }

  // Updated single transaction parser that uses the enhanced logic
  function parseTransactionLine(line) {
    const transactions = parseMultipleTransactions(line);
    return transactions[0] || {};
  }

  // ===== Zbierz dane wg kolejności DnD + mapowanie (opcjonalnie) =====
  const collectOrderedRows = useCallback((includeHeaders) => {
    const rows = [];
    const header = TRANSACTION_COLUMNS.filter(c => selectedCols.has(c));
    if (includeHeaders && header.length) rows.push(header);

    const pages = Object.keys(pageData).map((n) => +n)
      .filter((p) => (pageData[p]?.tables?.length || pageData[p]?.loose?.length || 0) > 0)
      .sort((a, b) => a - b);

    for (const p of pages) {
      const d = pageData[p];
      const orders = tableOrders[p] || {};

      d.tables.forEach((T, ti) => {
        const ord = orders[ti] || {};
        const orderedRows = (ord.row?.length === T.cells.length) ? ord.row : Array.from({ length: T.cells.length }, (_, i) => i);
        const orderedCols = (T.cells[0] && ord.col?.length === T.cells[0].length) ? ord.col : Array.from({ length: (T.cells[0]?.length || 0) }, (_, i) => i);

        orderedRows.forEach((ri) => {
          const rawCells = orderedCols.map((ci) => T.cells[ri]?.[ci] ?? "");
          if (mapDetectedRows && header.length) {
            const joined = rawCells.join(" ").replace(/\s{2,}/g, " ").trim();
            // Use enhanced parsing that can detect multiple transactions
            const transactions = parseMultipleTransactions(joined);
            transactions.forEach((parsed) => {
              const outRow = header.map((h) => parsed[h] ?? "");
              rows.push(outRow);
            });
          } else {
            rows.push(rawCells);
          }
        });
      });

      (d.loose || []).forEach((frag) => {
        const text = (frag.text || "").trim();
        if (mapDetectedRows && header.length) {
          // Use enhanced parsing that can detect multiple transactions
          const transactions = parseMultipleTransactions(text);
          transactions.forEach((parsed) => {
            const outRow = header.map((h) => parsed[h] ?? "");
            rows.push(outRow);
          });
        } else {
          rows.push([text]);
        }
      });
    }

    if (rows.length === 0) rows.push(header.length ? header.slice(0) : []);
    return rows;
  }, [pageData, tableOrders, selectedCols, mapDetectedRows]);

  // Export handlers
  const doExport = async () => {
    const base = String(docName || "file").replace(/\.[^.]+$/, "");
    const rows = collectOrderedRows(true);
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
      await buildAndDownloadXLSX(rows, base);
    }
    setShowExport(false);
  };

  // ---- UI
  if (fullWindow) {
    return (
      <div className="w-full h-screen overflow-hidden">
        <div className="w-full h-full relative inline-block select-none"
          ref={containerRef}
          style={{ lineHeight: 0 }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
        >
          <canvas ref={canvasRef} className="shadow border w-full h-full" />
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
                  left: r.x, top: r.y, width: r.w, height: r.h,
                  border: `2px solid ${s.color}`,
                  boxShadow: active ? `0 0 0 2px ${s.color}40` : "none",
                  background: `${s.color}1a`,
                }}
                onMouseDown={(e) => {
                  const rect = containerRef.current.getBoundingClientRect();
                  const x = clamp(e.clientX - rect.left, 0, viewport.width);
                  const y = clamp(e.clientY - rect.top, 0, viewport.height);
                  setActiveIndex(i);
                  const h = SHOW_HANDLES ? hitTestHandle(x, y, i) : null;
                  const rpx = { ...r };
                  if (h) setDragging({ mode: "resize", handle: h, startMouse: { x, y }, startRect: rpx });
                  else setDragging({ mode: "move", handle: null, startMouse: { x, y }, startRect: rpx });
                }}
              >
                <HandleDots r={r} active={active} onMouseDown={() => {}} />
                <div className="absolute text-[11px] font-semibold px-1.5 py-0.5 rounded-br" style={{ left: 0, top: 0, color: "#fff", background: s.color }}>
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
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="text-sm px-2 py-1 border rounded">Page {pageNum}/{pageCount}</div>

        <div className="flex items-center gap-1">
          <button
            className={`px-3 py-1 border rounded text-white ${tool === Tool.TABLE ? "ring-2 ring-offset-1" : ""}`}
            style={{ background: COLORS.table[0], borderColor: COLORS.table[0], opacity: tool === Tool.TABLE ? 1 : 0.85 }}
            onClick={() => setTool(Tool.TABLE)}
          >[1] Create Table</button>
          <button
            className={`px-3 py-1 border rounded text-white ${tool === Tool.COLUMN ? "ring-2 ring-offset-1" : ""}`}
            style={{ background: COLORS.column[0], borderColor: COLORS.column[0], opacity: tool === Tool.COLUMN ? 1 : 0.85 }}
            onClick={() => setTool(Tool.COLUMN)}
          >[2] Add Column</button>
          <button
            className={`px-3 py-1 border rounded text-white ${tool === Tool.ROW ? "ring-2 ring-offset-1" : ""}`}
            style={{ background: COLORS.row[0], borderColor: COLORS.row[0], opacity: tool === Tool.ROW ? 1 : 0.85 }}
            onClick={() => setTool(Tool.ROW)}
          >[3] Add Row</button>
        </div>

        <span className="mx-1" />
        <button className="px-3 py-1 border rounded hover:bg-gray-100" onClick={() => setScale((s)=>Math.min(4, Math.round((s + 0.1) * 100)/100))}>[+] Zoom</button>
        <button className="px-3 py-1 border rounded hover:bg-gray-100" onClick={() => setScale((s)=>Math.max(0.2, Math.round((s - 0.1) * 100)/100))}>[-] Zoom</button>
        <button className="px-3 py-1 border rounded hover:bg-gray-100" onClick={() => { setActiveIndex(-1); setPageNum((n)=>Math.max(1, n-1)); }}>&lt; Prev</button>
        <button className="px-3 py-1 border rounded hover:bg-gray-100" onClick={() => { setActiveIndex(-1); setPageNum((n)=>Math.min(pageCount, n+1)); }}>Next &gt;</button>
        <button className="px-3 py-1 border rounded hover:bg-gray-100" onClick={() => setReloadTick((t) => t + 1)}>Reload</button>

        <div className="ml-auto flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={autoBuild} onChange={(e)=>setAutoBuild(e.target.checked)} />
            Auto-build table from row/col
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={smartDetect} onChange={(e)=>setSmartDetect(e.target.checked)} />
            Smart-detect rows/cols
          </label>

          {/* Export gear */}
          <button
            onClick={()=>setShowExport(true)}
            className="px-4 py-2 rounded-md text-white font-semibold bg-emerald-600 hover:bg-emerald-700 flex items-center gap-2"
            title="Export Statement"
          >
            <span>Export Statement</span>
            <span aria-hidden>⚙️</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[auto_540px] gap-6">
        {/* LEFT: canvas */}
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
                  left: r.x, top: r.y, width: r.w, height: r.h,
                  border: `2px solid ${s.color}`,
                  boxShadow: active ? `0 0 0 2px ${s.color}40` : "none",
                  background: `${s.color}1a`,
                }}
                onMouseDown={(e) => {
                  const rect = containerRef.current.getBoundingClientRect();
                  const x = clamp(e.clientX - rect.left, 0, viewport.width);
                  const y = clamp(e.clientY - rect.top, 0, viewport.height);
                  setActiveIndex(i);
                  const h = SHOW_HANDLES ? hitTestHandle(x, y, i) : null;
                  const rpx = { ...r };
                  if (h) setDragging({ mode: "resize", handle: h, startMouse: { x, y }, startRect: rpx });
                  else setDragging({ mode: "move", handle: null, startMouse: { x, y }, startRect: rpx });
                }}
              >
                <HandleDots r={r} active={active} onMouseDown={() => {}} />
                <div className="absolute text-[11px] font-semibold px-1.5 py-0.5 rounded-br" style={{ left: 0, top: 0, color: "#fff", background: s.color }}>
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

        {/* RIGHT: results + DnD */}
        <div className="border rounded-lg p-3 bg-white/60 overflow-auto max-h-[80vh]">
          <div className="font-semibold mb-2">Wyniki (page {pageNum})</div>

          {currentPageData.tables.length === 0 && currentPageData.loose.length === 0 ? (
            <div className="text-sm text-gray-500">Brak danych — narysuj TABLE, włącz Auto-build, albo Smart-detect.</div>
          ) : null}

          {currentPageData.tables.map((T, ti) => {
            const ord = tableOrders[pageNum]?.[ti] || { row: [], col: [] };
            const rowOrder = ord.row?.slice() || [];
            const colOrder = ord.col?.slice() || [];
            const setRowOrder = (next) => setTableOrders((prev)=>({ ...prev, [pageNum]: { ...(prev[pageNum]||{}), [ti]: { row: next, col: colOrder } } }));
            const setColOrder = (next) => setTableOrders((prev)=>({ ...prev, [pageNum]: { ...(prev[pageNum]||{}), [ti]: { row: rowOrder, col: next } } }));

            // DnD sorting
            let dragCol = -1; let dragRow = -1;
            const onColDragStart = (i)=> (e)=>{ dragCol = i; e.dataTransfer.effectAllowed = 'move'; };
            const onColDragOver  = ()=> (e)=>{ e.preventDefault(); };
            const onColDrop      = (i)=> (e)=>{ e.preventDefault(); if(dragCol===-1) return;
              const base = colOrder.length?colOrder:Array.from({length:(T.cells[0]?.length||0)},(_,j)=>j);
              setColOrder(arrayMove(base, dragCol, i)); };

            const onRowDragStart = (i)=> (e)=>{ dragRow = i; e.dataTransfer.effectAllowed = 'move'; };
            const onRowDragOver  = ()=> (e)=>{ e.preventDefault(); };
            const onRowDrop      = (i)=> (e)=>{ e.preventDefault(); if(dragRow===-1) return;
              const base = rowOrder.length?rowOrder:Array.from({length:T.cells.length},(_,j)=>j);
              setRowOrder(arrayMove(base, dragRow, i)); };

            const orderedRows = rowOrder.length ? rowOrder : Array.from({length: T.cells.length}, (_,i)=>i);
            const orderedCols = colOrder.length ? colOrder : Array.from({length: (T.cells[0]?.length||0)}, (_,i)=>i);

            // Loose attach
            const acceptLoose = (typeExpected) => (e) => {
              e.preventDefault();
              const payload = e.dataTransfer.getData("loose");
              if (!payload) return;
              const data = JSON.parse(payload);
              if (data.type !== typeExpected) return;
              setManualLinks((prev) => {
                const next = { ...prev };
                next[pageNum] = next[pageNum] || {};
                const cur = next[pageNum][ti] || { addRows: [], addCols: [] };
                if (typeExpected === "row") cur.addRows = [...cur.addRows, data.rect];
                else cur.addCols = [...cur.addCols, data.rect];
                next[pageNum][ti] = cur;
                return next;
              });
              setDraggingLoose(null);
              setDragHover(null);
            };
            const onDragEnterZone = (zone) => (e) => { e.preventDefault(); if (!draggingLoose) return; setDragHover({ table: ti, zone }); };
            const onDragLeaveZone = (zone) => (e) => { e.preventDefault(); if (!draggingLoose) return; setDragHover((h) => (h && h.table === ti && h.zone === zone ? null : h)); };

            const isHoverCol = dragHover && dragHover.table === ti && dragHover.zone === "col" && draggingLoose?.type === "column";
            const isHoverRow = dragHover && dragHover.table === ti && dragHover.zone === "row" && draggingLoose?.type === "row";

            return (
              <div key={ti} className="mb-6">
                <div className="text-sm font-medium mb-2">Table #{ti + 1} — {T.rows.length} rows × {T.cols.length} cols</div>

                {/* Drop zones */}
                <div className="flex flex-wrap gap-3 mb-2 text-xs">
                  <div
                    onDragOver={(e)=>e.preventDefault()}
                    onDragEnter={onDragEnterZone("row")}
                    onDragLeave={onDragLeaveZone("row")}
                    onDrop={acceptLoose("row")}
                    className="px-2 py-1 border rounded"
                    style={{ background: isHoverRow ? "#fed7aa" : "#fff7ed", borderColor: isHoverRow ? "#ea580c" : "#fdba74", color: "#7c2d12" }}
                  >
                    {isHoverRow ? "Release to add row" : "Drop row here"}
                  </div>
                  <div
                    onDragOver={(e)=>e.preventDefault()}
                    onDragEnter={onDragEnterZone("col")}
                    onDragLeave={onDragLeaveZone("col")}
                    onDrop={acceptLoose("column")}
                    className="px-2 py-1 border rounded"
                    style={{ background: isHoverCol ? "#bbf7d0" : "#f0fdf4", borderColor: isHoverCol ? "#16a34a" : "#86efac", color: "#14532d" }}
                  >
                    {isHoverCol ? "Release to add column" : "Drop column here"}
                  </div>
                </div>

                {/* Column reorder bar */}
                <div className="flex items-center gap-2 mb-2 text-xs">
                  <span className="text-gray-500">Columns:</span>
                  {orderedCols.map((ci, idx)=> (
                    <div key={ci}
                         draggable
                         onDragStart={onColDragStart(idx)}
                         onDragOver={onColDragOver(idx)}
                         onDrop={onColDrop(idx)}
                         className="px-2 py-1 border rounded cursor-move select-none"
                         style={{ background: COLORS.column[0], color: '#fff' }}>
                      C{ci+1}
                    </div>
                  ))}
                </div>

                <div className="overflow-auto">
                  <table className="min-w-full border text-sm">
                    <tbody>
                      {orderedRows.map((ri, rIdx) => (
                        <tr key={ri}>
                          {orderedCols.map((ci) => (
                            <td key={ci} className="border px-2 py-1 align-top">
                              {T.cells[ri]?.[ci] || <span className="text-gray-400">—</span>}
                            </td>
                          ))}
                          <td className="px-2">
                            <div
                              draggable
                              onDragStart={onRowDragStart(rIdx)}
                              onDragOver={onRowDragOver(rIdx)}
                              onDrop={onRowDrop(rIdx)}
                              className="inline-block text-xs px-2 py-1 border rounded cursor-move select-none"
                              style={{ background: COLORS.row[0], color: '#fff' }}
                            >
                              R{ri+1}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {isHoverRow && (
                        <tr>
                          <td colSpan={(orderedCols.length || 1) + 1} className="px-2 py-1 border-2 border-dashed" style={{ borderColor: "#ea580c" }}>
                            + Row will be added here
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}

          {/* Loose list */}
          {currentPageData.loose.length > 0 && (
            <>
              <div className="text-sm font-medium mt-4 mb-1">Loose selections (drag to table)</div>
              <ul className="flex flex-wrap gap-2 text-xs">
                {currentPageData.loose.map((L, i) => (
                  <li key={i}
                      draggable
                      onDragStart={(e)=>{
                        setDraggingLoose(L);
                        e.dataTransfer.setData("loose", JSON.stringify({ type: L.type, rect: L.rect }));
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={()=>{ setDraggingLoose(null); setDragHover(null); }}
                      className="px-2 py-1 border rounded cursor-move select-none"
                      style={{ background: L.type === Tool.COLUMN ? "#dcfce7" : "#ffedd5", borderColor: L.type === Tool.COLUMN ? "#22c55e" : "#f59e0b" }}
                  >
                    <span className="font-semibold">{L.type}</span>{": "}{L.text || "—"}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      {/* ===== Export modal ===== */}
      {showExport && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={()=>setShowExport(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl p-5" onClick={(e)=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Export Statement</h3>
              <button className="text-gray-500 hover:text-gray-700" onClick={()=>setShowExport(false)}>✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium mb-1">Select File Type</div>
                <div className="flex gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="radio" name="ft" value="xlsx" checked={exportType==="xlsx"} onChange={()=>setExportType("xlsx")} />
                    XLSX
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" name="ft" value="csv" checked={exportType==="csv"} onChange={()=>setExportType("csv")} />
                    CSV
                  </label>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Zaznaczone poniżej nagłówki zostaną dodane jako pierwszy wiersz w eksporcie {exportType.toUpperCase()}.
                </p>
              </div>

              <div>
                <div className="text-sm font-medium mb-2">Transaction Columns</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  {TRANSACTION_COLUMNS.map((label) => (
                    <label key={label} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedCols.has(label)}
                        onChange={()=>toggleCol(label)}
                      />
                      {label}
                    </label>
                  ))}
                </div>
                <div className="mt-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={mapDetectedRows}
                      onChange={(e)=>setMapDetectedRows(e.target.checked)}
                    />
                    Try to map detected rows to selected columns
                  </label>
                  <p className="text-xs text-gray-500">
                    Heurystyka: data, kwoty (Amount/Credit/Debit), saldo (Balance), waluta, opis (Description).
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button className="px-4 py-2 rounded-md border hover:bg-gray-50" onClick={()=>setShowExport(false)}>Cancel</button>
              <button className="px-4 py-2 rounded-md text-white font-semibold bg-emerald-600 hover:bg-emerald-700" onClick={doExport}>
                Export {exportType.toUpperCase()}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
