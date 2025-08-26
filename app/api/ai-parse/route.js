// app/api/ai-parse/route.js
import OpenAI from "openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // upewnia się, że route nie będzie prerenderowany

const J = (b, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { "Content-Type": "application/json" },
  });

// Lazy, singleton client (bez tworzenia w top-level)
let _client = null;
function getOpenAI() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error(
      "OpenAI API key not configured. Set the OPENAI_API_KEY environment variable."
    );
  }
  if (!_client) {
    _client = new OpenAI({ apiKey: key });
  }
  return _client;
}

// AI parsing function using OpenAI
async function parseWithAI(text) {
  // Create a prompt for the AI to parse bank statement transactions
  const prompt = `
Parse the following bank statement text and extract transaction details in JSON format.
Each transaction should have the following fields:
- Date: Transaction date in YYYY-MM-DD format
- Description: Transaction description
- Amount: Transaction amount (positive for credits, negative for debits)
- Balance: Account balance after transaction (if available)
- Reference Number: Transaction reference number (if available)

Bank statement text:
${text}

Please provide the response in JSON format as an array of transaction objects.
`;

  const openai = getOpenAI();

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini", // nowszy, tańszy i lepszy niż 3.5
    messages: [
      {
        role: "system",
        content:
          "You are a specialized assistant that extracts bank transaction data from statements and converts it into structured JSON format. You should extract all available transaction details including dates, descriptions, amounts, balances, and reference numbers when present.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.3,
    max_tokens: 2000,
  });

  const content = (response.choices?.[0]?.message?.content || "").trim();

  // Spróbuj sparsować czysty JSON
  try {
    return JSON.parse(content);
  } catch {
    // Lub wyciągnij JSON z bloku ```json
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch?.[1]) {
      return JSON.parse(jsonMatch[1]);
    }
    throw new Error("AI response is not valid JSON.");
  }
}

export async function POST(request) {
  try {
    const data = await request.json().catch(() => null);
    if (!data) return J({ error: "Invalid JSON body." }, 400);

    const { text } = data;
    if (!text) return J({ error: "Missing text." }, 400);

    const transactions = await parseWithAI(text);
    return J({ transactions });
  } catch (e) {
    console.error("[/api/ai-parse] error:", e);
    const msg = e?.message || "Unknown error";
    return J(
      { error: "AI parsing failed: " + msg, details: e?.stack || null },
      500
    );
  }
}
