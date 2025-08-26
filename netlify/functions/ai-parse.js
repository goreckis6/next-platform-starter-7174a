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
  if (!data || typeof data.text !== "string" || !data.text.trim()) {
    return J({ error: "Missing 'text' in JSON body." }, 400);
  }
  if (data.text.length > 400_000) {
    return J({ error: "Input text too large; split per pages/chunks." }, 413);
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key) return J({ error: "OPENAI_API_KEY missing in Netlify Function runtime." }, 500);

  try {
    const { default: OpenAI } = await import("openai"); // ESM dynamic import
    const client = new OpenAI({ apiKey: key });

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
            `Parse the following bank statement text and return ONLY JSON array of transaction objects (no commentary):\n\n${data.text}`,
        },
      ],
    });

    const content = (resp.choices?.[0]?.message?.content || "").trim();

    let transactions = null;
    try {
      transactions = JSON.parse(content);
    } catch {
      const m = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (m?.[1]) transactions = JSON.parse(m[1]);
    }

    if (!Array.isArray(transactions)) {
      return J({ error: "AI did not return an array." }, 502);
    }

    return J({ transactions });
  } catch (e) {
    const msg = e?.response?.data?.error?.message || e?.message || "Unknown error";
    return J({ error: "AI parsing failed: " + msg }, 500);
  }
};
