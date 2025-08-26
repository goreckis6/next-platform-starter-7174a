// app/api/diag/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const J = (b, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { "Content-Type": "application/json" },
  });

export async function GET() {
  const key = process.env.OPENAI_API_KEY || "";
  return J({
    hasKey: Boolean(key),
    keyLen: key.length || 0,
    sample: key ? `${key.slice(0, 4)}...${key.slice(-4)}` : null, // tylko podgląd
    node: process.version,                 // wersja Node w runtime
    envKnown: Object.keys(process.env).length, // liczba dostępnych env (bez wartości)
  });
}
