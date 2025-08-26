// app/api/ai-parse/route.js
import OpenAI from "openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const J = (b, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { "Content-Type": "application/json" },
  });

let _client = null;
function getOpenAI() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    const hint =
      "OPENAI_API_KEY is missing in runtime. Add it in Netlify → Site settings → Build & deploy → Environment variables (All contexts) and redeploy.";
    const err = new Error(hint);
    err.expose = true;
    throw err;
  }
  if (!_client) _client = new OpenAI({ apiKey: key });
  return _client;
}

async function parseWithAI(text) {
  const client = getOpenAI();

  // Krótki system + user. Model nowy i tani.
  const resp = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    max_tokens: 2000,
    messages: [
      {
        role: "system",
        content:
          "Extract bank transactions as JSON array. Fields: Date (YYYY-MM-DD), Description, Credit, Debit, Amount, Balance, Currency, Reference Number, Reference 1, Reference 2, Transaction Type, Transaction Category, Branch, Sender/Receiver Name, Source Date, Source Statement Page.",
      },
      {
        role: "user",
        content:
          `Parse the following bank statement text and return ONLY JSON array of transaction objects (no commentary):\n\n${text}`,
      },
    ],
  });

  const content = (resp.choices?.[0]?.message?.content || "").trim();

  // Spróbuj czysty JSON, potem ```json
  try {
    return JSON.parse(content);
  } catch {
    const m = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (m?.[1]) return JSON.parse(m[1]);
    const e = new Error("Model did not return valid JSON.");
    e.expose = true;
    throw e;
  }
}

export async function POST(request) {
  try {
    const data = await request.json().catch(() => null);
    if (!data || typeof data.text !== "string" || !data.text.trim())
      return J({ error: "Missing 'text' in JSON body." }, 400);

    // Prosta gardziel na zbyt duże payloady
    if (data.text.length > 800_000) {
      return J({
        error:
          "Input text too large for single request. Consider splitting per page.",
      }, 413);
    }

    const transactions = await parseWithAI(data.text);
    if (!Array.isArray(transactions))
      return J({ error: "AI did not return an array of transactions." }, 502);

    return J({ transactions });
  } catch (e) {
    console.error("[/api/ai-parse] error:", e);
    // Jeżeli błąd jest “bezpieczny do pokazania”, zwróć użytkownikowi.
    if (e?.expose) return J({ error: e.message }, 500);

    // Błędy z OpenAI mają zwykle response?.data?.error
    const msg =
      e?.response?.data?.error?.message ||
      e?.message ||
      "Unknown error calling OpenAI";
    return J({ error: "AI parsing failed: " + msg }, 500);
  }
}
