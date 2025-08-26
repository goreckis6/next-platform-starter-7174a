// app/api/ai-parse/route.js
import OpenAI from 'openai';

export const runtime = "nodejs";
const J = (b, s=200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Add your API key in environment variables
});

// AI parsing function using OpenAI
async function parseWithAI(text) {
  try {
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
    
    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a specialized assistant that extracts bank transaction data from statements and converts it into structured JSON format. You should extract all available transaction details including dates, descriptions, amounts, balances, and reference numbers when present."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });
    
    // Extract the response content
    const content = response.choices[0].message.content.trim();
    
    // Try to parse the JSON response
    try {
      const transactions = JSON.parse(content);
      return transactions;
    } catch (parseError) {
      // If JSON parsing fails, try to extract JSON from markdown code blocks
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        try {
          const transactions = JSON.parse(jsonMatch[1]);
          return transactions;
        } catch (innerParseError) {
          console.error("Error parsing AI response:", innerParseError);
          throw new Error("Failed to parse AI response as JSON: " + innerParseError.message);
        }
      } else {
        throw new Error("AI response is not valid JSON and does not contain a JSON code block");
      }
    }
  } catch (error) {
    console.error("OpenAI API error:", error);
    throw error;
  }
}

export async function POST(request) {
  try {
    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === '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') {
      return J({
        error: "OpenAI API key not configured. Please set the OPENAI_API_KEY environment variable."
      }, 500);
    }
    
    const data = await request.json().catch(() => null);
    if (!data) return J({ error: "Invalid JSON body." }, 400);

    const { text } = data;
    if (!text) return J({ error: "Missing text." }, 400);
    
    // Call the AI parsing function
    const transactions = await parseWithAI(text);
    
    return J({ transactions });
  } catch (e) {
    console.error("[/api/ai-parse] error:", e);
    return J({
      error: "AI parsing failed: " + (e.message || "Unknown error"),
      details: e.stack || "No stack trace available"
    }, 500);
  }
}