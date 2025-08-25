// components/InspectClient.jsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getDocument } from "pdfjs-dist";
import "pdfjs-dist/build/pdf.worker.entry";

// Narzędzia/typy zaznaczeń
const Tool = {
  TABLE: "table",
  COLUMN: "column",
  ROW: "row",
};

// Palety kolorów dla typów (cyklicznie)
const COLORS = {
  table: ["#2563eb", "#1d4ed8", "#3b82f6"], // niebieskie odcienie
  column: ["#16a34a", "#22c55e", "#15803d"], // zielone
  row: ["#d97706", "#f59e0b", "#b45309"], // pomarańczowe
};

// UI pomocnicze
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

// Konwersja do współrzędnych znormalizowanych (0..1) i z powrotem (px)
const toNorm = (x, y, w, h, vw, vh) => ({ x: x / vw, y: y / vh, w: w / vw, h: h / vh });
const fromNorm = (nr, vw, vh) => ({ x: nr.x * vw, y: nr.y * vh, w: nr.w * vw, h: nr.h * vh });

// render uchwytów
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
          style={{
            left: x,
            top: y,
            width: 10,
            height: 10,
            borderRadius: 6,
            cursor,
          }}
          onMouseDown={(e) => onMouseDown(e, key)}
          title="Drag to resize"
        />
      ))}
    </>
  ) : null;

export default function InspectClient({ pdfUrl, uuid }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const [pdfDoc, setPdfDoc] = useState(null);
  const [pageNum, setPageNum] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [scale, setScale] = useState(1.25);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  // Zaznaczenia per strona:
  // selections[page] = [{ type: 'table'|'column'|'row', color: '#rrggbb', rect: {x,y,w,h} w normie }]
  const [selections, setSelections] = useState({});

  // aktywne narzędzie
  const [tool, setTool] = useState(Tool.TABLE);

  // liczniki kolorów (cykl po palecie)
  const colorIndexRef = useRef({ table: 0, column: 0, row: 0 });

  // rysowany prostokąt (draft, w px)
  const [draft, setDraft] = useState(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [dragging, setDragging] = useState(null); // {mode: 'move'|'resize', handle, startMouse:{x,y}, startRect:{x,y,w,h}}

  // ===== PDF ładowanie =====
  useEffect(() => {
    let mounted = true;
    (async () => {
      const doc = await getDocument(pdfUrl).promise;
      if (!mounted) return;
      setPdfDoc(doc);
      setPageCount(doc.numPages);
      setPageNum(1);
    })().catch(console.error);
    return () => {
      mounted = false;
    };
  }, [pdfUrl]);

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
  }, [pdfDoc, pageNum, scale]);

  useEffect(() => {
    renderPage().catch(console.error);
  }, [renderPage]);

  // ===== helpers dla aktualnej strony =====
  const current = selections[pageNum] || [];
  const setCurrent = (updater) =>
    setSelections((prev) => {
      const arr = prev[pageNum] || [];
      const next = typeof updater === "function" ? updater(arr) : updater;
      return { ...prev, [pageNum]: next };
    });

  // ===== Toolbar =====
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

  // ===== Kolor dla nowego zaznaczenia wg narzędzia =====
  const nextColorFor = (t) => {
    const list = COLORS[t];
    const i = colorIndexRef.current[t] % list.length;
    colorIndexRef.current[t] = i + 1;
    return list[i];
  };

  // ===== rysowanie zaznaczenia =====
  const onMouseDown = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const sx = clamp(e.clientX - rect.left, 0, viewport.width);
    const sy = clamp(e.clientY - rect.top, 0, viewport.height);

    // klik na istniejącym? — ustaw aktywne i przygotuj drag
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

    // start nowego (z aktualnym narzędziem)
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
      setCurrent((prev) => {
        // dla TABLE możesz chcieć 1 sztukę na stronę — wtedy odfiltruj stare TABLE
        // const rest = prev.filter((s) => s.type !== Tool.TABLE);
        // return [...rest, { type: draft.type, color: draft.color, rect: norm }];
        return [...prev, { type: draft.type, color: draft.color, rect: norm }];
      });
      setActiveIndex(current.length); // nowy indeks
    }
    setDraft(null);
  };

  // ===== hit test =====
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
    const inPt = (px, py) => Math.abs(x - px) <= size && Math.abs(y - py) <= size;

    if (inPt(r.x, r.y)) return "tl";
    if (inPt(r.x + r.w, r.y)) return "tr";
    if (inPt(r.x, r.y + r.h)) return "bl";
    if (inPt(r.x + r.w, r.y + r.h)) return "br";

    if (Math.abs(x - r.x) <= size && y >= r.y && y <= r.y + r.h) return "l";
    if (Math.abs(x - (r.x + r.w)) <= size && y >= r.y && y <= r.y + r.h) return "r";
    if (Math.abs(y - r.y) <= size && x >= r.x && x <= r.x + r.w) return "t";
    if (Math.abs(y - (r.y + r.h)) <= size && x >= r.x && x <= r.x + r.w) return "b";

    return null;
  };

  const onClick = (e) => {
    if (!containerRef.current || dragging || draft) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clamp(e.clientX - rect.left, 0, viewport.width);
    const y = clamp(e.clientY - rect.top, 0, viewport.height);
    setActiveIndex(hitTestBox(x, y));
  };

  // Klawiatura: Delete, skróty 1/2/3, zoom/prev/next
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

  // ===== UI =====
  return (
    <div className="w-full">
      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="text-sm px-2 py-1 border rounded">
          Page {pageNum}/{pageCount}
        </div>

        <div className="flex items-center gap-1">
          <button
            className={`px-3 py-1 border rounded hover:bg-gray-100 ${tool === Tool.TABLE ? "bg-gray-100" : ""}`}
            onClick={() => setTool(Tool.TABLE)}
            title="[1] Create Table"
          >
            [1] Create Table
          </button>
          <button
            className={`px-3 py-1 border rounded hover:bg-gray-100 ${tool === Tool.COLUMN ? "bg-gray-100" : ""}`}
            onClick={() => setTool(Tool.COLUMN)}
            title="[2] Add Column"
          >
            [2] Add Column
          </button>
          <button
            className={`px-3 py-1 border rounded hover:bg-gray-100 ${tool === Tool.ROW ? "bg-gray-100" : ""}`}
            onClick={() => setTool(Tool.ROW)}
            title="[3] Add Row"
          >
            [3] Add Row
          </button>
        </div>

        <span className="mx-1" />

        <button className="px-3 py-1 border rounded hover:bg-gray-100" onClick={zoomIn}>
          [+] Zoom In
        </button>
        <button className="px-3 py-1 border rounded hover:bg-gray-100" onClick={zoomOut}>
          [-] Zoom Out
        </button>
        <button className="px-3 py-1 border rounded hover:bg-gray-100" onClick={prevPage}>
          [&lt;] Previous Page
        </button>
        <button className="px-3 py-1 border rounded hover:bg-gray-100" onClick={nextPage}>
          [&gt;] Next Page
        </button>

        {/* Legendka kolorów */}
        <div className="ml-auto flex items-center gap-3 text-sm">
          <Legend label="Table" color={COLORS.table[0]} />
          <Legend label="Column" color={COLORS.column[0]} />
          <Legend label="Row" color={COLORS.row[0]} />
        </div>
      </div>

      {/* Canvas + overlay */}
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

        {/* Istniejące zaznaczenia */}
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
                  background: `${s.color}1a`, // ~10% fill
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
                    setDragging({
                      mode: "resize",
                      handle,
                      startMouse: { x, y },
                      startRect: { ...r },
                    });
                  }}
                />
                {/* etykieta typu w rogu */}
                <div
                  className="absolute text-[11px] font-semibold px-1.5 py-0.5 rounded-br"
                  style={{ left: 0, top: 0, color: "#fff", background: s.color }}
                >
                  {s.type.toUpperCase()}
                </div>
              </div>
            );
          })}

        {/* Nowo rysowany prostokąt */}
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
