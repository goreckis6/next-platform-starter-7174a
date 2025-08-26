// netlify/functions/ai-parse.js
exports.handler = async function (event) {
  const J = (b, s = 200) => ({
    statusCode: s,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(b),
  });

  if (event.httpMethod !== "POST") return J({ error: "Use POST" }, 405);

  let data = null;
  try { data = JSON.parse(event.body || "{}"); } catch {}
  const text = (data && typeof data.text === "string") ? data.text.trim() : "";
  if (!text) return J({ error: "Missing 'text' in JSON body." }, 400);

  // Twardy limit – Netlify ma krótki timeout, skracamy payload serwera
  const TRIMMED = text.slice(0, 70_000);

  const key = process.env.OPENAI_API_KEY;
  if (!key) return J({ error: "OPENAI_API_KEY missing in Function runtime." }, 500);

  try {
    const { default: OpenAI } = await import("openai"); // ESM import
    const client = new OpenAI({ apiKey: key });

    // Zwięzły prompt + JSON mode (szybciej, mniej tokenów)
    const messages = [
      {
        role: "system",
        content:
          "Return ONLY JSON with key 'transactions' -> array of bank transactions. Fields allowed: Date (YYYY-MM-DD), Source Date, Description, Credit, Debit, Amount, Balance, Currency, Reference Number, Reference 1, Reference 2, Transaction Type, Transaction Category, Branch, Sender/Receiver Name, Source Statement Page.",
      },
      {
        role: "user",
        content: "Extract transactions from the text below. Respond ONLY with JSON:\n\n" + TRIMMED,
      },
    ];

    const resp = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      max_tokens: 800,                 // mniejsze = szybciej
      response_format: { type: "json_object" }, // wymuś JSON
      messages,
    });

    const content = (resp.choices?.[0]?.message?.content || "").trim();

    let parsed = null;
    try { parsed = JSON.parse(content); } catch {}
    let transactions = Array.isArray(parsed) ? parsed
                     : (parsed && Array.isArray(parsed.transactions)) ? parsed.transactions
                     : null;

    if (!transactions) {
      // awaryjnie wyciągnij z ```json
      const m = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (m?.[1]) {
        const p2 = JSON.parse(m[1]);
        transactions = Array.isArray(p2) ? p2
                     : (p2 && Array.isArray(p2.transactions)) ? p2.transactions
                     : null;
      }
    }

    if (!Array.isArray(transactions)) {
      return J({ error: "AI did not return an array of transactions." }, 502);
    }

    return J({ transactions });
  } catch (e) {
    const msg = e?.response?.data?.error?.message || e?.message || "Unknown error";
    return J({ error: "AI parsing failed: " + msg }, 500);
  }
};
