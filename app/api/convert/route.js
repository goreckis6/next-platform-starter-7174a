// app/api/convert/route.js
export const runtime = "nodejs";
const J = (b, s=200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

export async function POST(request) {
  try {
    const data = await request.json().catch(() => null);
    if (!data) return J({ error: "Invalid JSON body." }, 400);

    const { uuid, selections } = data;
    if (!uuid) return J({ error: "Missing uuid." }, 400);
    if (!selections || typeof selections !== "object") return J({ error: "Missing selections." }, 400);

    const rows = [["uuid","page","type","x","y","w","h"]];
    for (const [pageStr, arr] of Object.entries(selections)) {
      if (!Array.isArray(arr)) continue;
      for (const item of arr) {
        const r = item?.rect || {};
        rows.push([
          uuid,
          pageStr,
          String(item?.type || ""),
          Number(r.x ?? 0).toFixed(6),
          Number(r.y ?? 0).toFixed(6),
          Number(r.w ?? 0).toFixed(6),
          Number(r.h ?? 0).toFixed(6),
        ]);
      }
    }
    const csv = rows.map(r => r.join(",")).join("\n");
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="converted-${uuid}.csv"`,
        "Cache-Control": "no-store",
      }
    });
  } catch (e) {
    console.error("[/api/convert] error:", e);
    return J({ error: "Conversion failed." }, 500);
  }
}
