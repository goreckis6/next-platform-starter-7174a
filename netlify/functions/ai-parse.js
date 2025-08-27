// netlify/functions/ai-parse.js
// Stabilne parse: OpenAI function-calling + twardy schemat + fallbacki.

exports.handler = async function (event) {
  const J = (b, s = 200) => ({
    statusCode: s,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(b),
  });

  if (event.httpMethod !== "POST") return J({ error: "Use POST" }, 405);

  // --- wejście
  let data = null;
  try { data = JSON.parse(event.body || "{}"); } catch {}
  let text = (data && typeof data.text === "string") ? data.text.trim() : "";
  if (!text) return J({ error: "Missing 'text' in JSON body." }, 400);

  // minimalizacja + limit znaków (bezpiecznie na Netlify)
  text = text
    .replace(/\s+$/gm, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .slice(0, 70_000);

  const key = process.env.OPENAI_API_KEY;
  if (!key) return J({ error: "OPENAI_API_KEY missing in Function runtime." }, 500);

  // --- pomocnicze
  const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
  const firstArrayOfObjects = (v) => {
    // Znajdź pierwszą tablicę obiektów gdziekolwiek w JSON-ie (fallback).
    if (Array.isArray(v) && v.every(isObj)) return v;
    if (isObj(v)) {
      // preferuj "transactions"
      if (Array.isArray(v.transactions) && v.transactions.every(isObj)) return v.transactions;
      for (const k of Object.keys(v)) {
        const hit = firstArrayOfObjects(v[k]);
        if (hit) return hit;
      }
    }
    return null;
  };

  try {
    const { default: OpenAI } = await import("openai"); // ESM dynamic import
    const client = new OpenAI({ apiKey: key });

    // --- twardy schemat dla function calling
    const tool = {
      type: "function",
      function: {
        name: "return_transactions",
        description: "Return extracted bank transactions as structured data.",
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {
            transactions: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: true, // pozwalamy na dodatkowe klucze, ale wskazujemy pola docelowe
                properties: {
                  "Date": { type: "string" },
                  "Source Date": { type: "string" },
                  "Description": { type: "string" },
                  "Credit": { type: ["number","string","null"] },
                  "Debit": { type: ["number","string","null"] },
                  "Amount": { type: ["number","string","null"] },
                  "Balance": { type: ["number","string","null"] },
                  "Currency": { type: "string" },
                  "Reference Number": { type: "string" },
                  "Reference 1": { type: "string" },
                  "Reference 2": { type: "string" },
                  "Transaction Type": { type: "string" },
                  "Transaction Category": { type: "string" },
                  "Branch": { type: "string" },
                  "Sender/Receiver Name": { type: "string" },
                  "Source Statement Page": { type: ["number","string","null"] }
                }
              }
            }
          },
          required: ["transactions"]
        }
      }
    };

    const messages = [
      {
        role: "system",
        content:
          "Extract bank transactions and CALL the function with a 'transactions' array only. Never include commentary.",
      },
      {
        role: "user",
        content:
          "From the text below, extract bank transactions and return them via the function call argument 'transactions'. The fields may include: Date (YYYY-MM-DD), Source Date, Description, Credit, Debit, Amount, Balance, Currency, Reference Number, Reference 1, Reference 2, Transaction Type, Transaction Category, Branch, Sender/Receiver Name, Source Statement Page.\n\n" + text,
      },
    ];

    // --- główne wywołanie: function calling wymusza JSON-arguments
    const resp = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      max_tokens: 900,
      tools: [tool],
      tool_choice: { type: "function", function: "return_transactions" }, // wymuszamy tool
      messages,
    });

    // 1) Najpierw spróbuj odczytać arguments z tool_calls
    let transactions = null;
    const choice = resp.choices?.[0];
    const tc = choice?.message?.tool_calls?.[0];
    if (tc?.function?.arguments) {
      try {
        const args = JSON.parse(tc.function.arguments);
        const arr = args?.transactions;
        if (Array.isArray(arr)) transactions = arr;
      } catch {} // przejdź do fallbacków
    }

    // 2) Fallback: model mógł jednak zwrócić content
    if (!transactions) {
      const content = (choice?.message?.content || "").trim();
      if (content) {
        try {
          const parsed = JSON.parse(content);
          transactions = firstArrayOfObjects(parsed);
        } catch {
          const m = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
          if (m?.[1]) {
            try {
              const parsed2 = JSON.parse(m[1]);
              transactions = firstArrayOfObjects(parsed2);
            } catch {}
          }
        }
      }
    }

    // 3) Ostatni fallback: brak danych => błąd warstwy 502
    if (!Array.isArray(transactions)) {
      return J({ error: "AI did not return an array of transactions." }, 502);
    }

    // (opcjonalnie) lekkie czyszczenie typów liczbowych w polach kwotowych
    const numish = (v) => {
      if (v == null) return v;
      if (typeof v === "number") return v;
      const s = String(v).replace(/\s/g, "").replace(",", "."); // 1 234,56 -> 1234.56
      const m = s.match(/^[-+]?(\d+(\.\d+)?|\.\d+)$/);
      return m ? parseFloat(s) : v;
    };
    transactions = transactions.map((t) => {
      const out = { ...t };
      out["Credit"] = numish(out["Credit"]);
      out["Debit"] = numish(out["Debit"]);
      out["Amount"] = numish(out["Amount"]);
      out["Balance"] = numish(out["Balance"]);
      return out;
    });

    return J({ transactions });
  } catch (e) {
    const msg =
      e?.response?.data?.error?.message ||
      e?.message ||
      "Unknown error";
    return J({ error: "AI parsing failed: " + msg }, 500);
  }
};
