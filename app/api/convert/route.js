// app/api/convert/route.js
export const runtime = "nodejs";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(request) {
  try {
    const data = await request.json().catch(() => null);
    if (!data) return json({ error: "Invalid JSON body." }, 400);

    const { uuid, selections } = data;
    if (!uuid) return json({ error: "Missing uuid." }, 400);
    if (!selections || typeof selections !== "object")
      return json({ error: "Missing selections." }, 400);

    // Budujemy CSV z nagłówkiem
    const rows = [["uuid", "page", "type", "x", "y", "w", "h"]];
    for (const [pageStr, arr] of Object.entries(selections)) {
      const page = Number(pageStr);
      if (!Array.isArray(arr)) continue;
      for (const item of arr) {
        const t = item?.type || "";
        const r = item?.rect || {};
        const vals = [
          uuid,
          String(page),
          String(t),
          Number(r.x)?.toFixed(6),
          Number(r.y)?.toFixed(6),
          Number(r.w)?.toFixed(6),
          Number(r.h)?.toFixed(6),
        ];
        rows.push(vals);
      }
    }

    // CSV jako tekst
    const csv = rows.map((r) => r.join(",")).join("\n");

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="converted-${uuid}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return json({ error: e?.message || "Conversion failed." }, 500);
  }
}
