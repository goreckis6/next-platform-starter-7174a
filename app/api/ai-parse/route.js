// app/api/ai-parse/route.js
export const runtime = "nodejs";
const J = (b, s=200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

// Mock AI parsing function - in a real implementation, this would call an AI service
async function parseWithAI(text) {
  // This is a placeholder for actual AI parsing logic
  // In a real implementation, you would call an AI service like OpenAI API
  // For now, we'll return a mock response
  
  // Split text into lines
  const lines = text.split('\n').filter(line => line.trim() !== '');
  
  // Parse each line as a transaction
  const transactions = lines.map((line, index) => {
    // This is a simplified mock implementation
    // A real AI implementation would be much more sophisticated
    const parts = line.trim().split(/\s+/);
    
    // Try to identify date (assuming it's the first part)
    let date = null;
    if (parts.length > 0) {
      // Simple date detection
      const dateRegex = /^(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})|([A-Za-z]{3}\s+\d{1,2},?\s+\d{4})/;
      if (dateRegex.test(parts[0]) || dateRegex.test(parts[0] + ' ' + (parts[1] || ''))) {
        date = parts[0] + (parts[1] ? ' ' + parts[1] : '');
      }
    }
    
    // Try to identify amount (assuming it's near the end)
    let amount = null;
    for (let i = parts.length - 1; i >= 0; i--) {
      // Simple amount detection
      const amountRegex = /[\$€£zł]|(?:\d+[.,]?\d*)/;
      if (amountRegex.test(parts[i])) {
        amount = parts[i];
        break;
      }
    }
    
    // Description is everything else
    let description = line.trim();
    if (date) {
      description = description.replace(date, '').trim();
    }
    if (amount) {
      description = description.replace(amount, '').trim();
    }
    
    return {
      Date: date || '',
      Description: description || '',
      Amount: amount || ''
    };
  });
  
  return transactions;
}

export async function POST(request) {
  try {
    const data = await request.json().catch(() => null);
    if (!data) return J({ error: "Invalid JSON body." }, 400);

    const { text } = data;
    if (!text) return J({ error: "Missing text." }, 400);
    
    // In a real implementation, you would call an AI service here
    // For now, we'll use the mock function
    const transactions = await parseWithAI(text);
    
    return J({ transactions });
  } catch (e) {
    console.error("[/api/ai-parse] error:", e);
    return J({ error: "AI parsing failed." }, 500);
  }
}