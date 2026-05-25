import { GoogleGenAI } from "@google/genai";

let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// Robust JSON cleaning and parsing helper to parse responses reliably
function cleanAndParseJson(text: string | undefined): any {
  if (!text) return {};
  let cleaned = text.trim();
  
  // Strip Markdown JSON codeblocks if present
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.substring(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.substring(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.substring(0, cleaned.length - 3);
  }
  cleaned = cleaned.trim();
  
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("Failed to parse JSON from AI response, trying fallback match:", text, e);
    const startIdx = cleaned.indexOf('{');
    const endIdx = cleaned.lastIndexOf('}');
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      try {
        return JSON.parse(cleaned.substring(startIdx, endIdx + 1));
      } catch (innerError) {
        console.error("Fallback JSON parsing failed too:", innerError);
      }
    }
    return {};
  }
}

export async function parseEmailContent(emailContent: string) {
  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: `Parse the following email content to extract shopping/purchase history information. 
    Return the result as a JSON object with keys: itemName, storeName, amount (as a number), date.
    
    CRITICAL: If the email is NOT a purchase confirmation or receipt, ignore it and return an empty JSON object {}.
    If information is missing for a purchase, use null.
    
    Email content:
    ${emailContent}
    `,
    config: {
        responseMimeType: "application/json"
    }
  });

  return cleanAndParseJson(response.text);
}

export async function parseReceipt(base64Image: string, mimeType: string) {
  const ai = getAiClient();
  let retries = 2;
  while (retries >= 0) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [
          {
            role: 'user',
            parts: [
              { text: `Extract the following information from this receipt image: date (YYYY-MM-DD), store name (description), amount (as a number), and a category (one of: '식비', '교통/차량', '쇼핑/뷰티', '문화/여가', '건강/운동', '공과금/요금', '주거/통신', '교육', '경조사', '기타'). 
              Return the result as a JSON object with keys: date, description, amount, category. If information is missing, return null for that field.` },
              { inlineData: { data: base64Image, mimeType: mimeType } }
            ]
          }
        ],
        config: {
            responseMimeType: "application/json"
        }
      });

      return cleanAndParseJson(response.text);
    } catch (error) {
      if (retries === 0) {
        console.error("Gemini API Error Detail:", error);
        throw error;
      }
      retries--;
      console.warn("Gemini API call failed, retrying...", retries);
    }
  }
  throw new Error("Failed after retries");
}

export async function classifyTransactionCategory(description: string) {
  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: `Classify the following transaction description into one of these categories: 
    '식비', '교통/차량', '쇼핑/뷰티', '문화/여가', '건강/운동', '공과금/요금', '주거/통신', '교육', '경조사', '기타'.
    
    Return the result as a JSON object with key 'category'.
    
    Description:
    ${description}
    `,
    config: {
        responseMimeType: "application/json"
    }
  });

  return cleanAndParseJson(response.text);
}

export async function generateFinancialAdvice(data: { transactions: any[], assets: any[], budgets: any[] }, userQuestion?: string) {
  const ai = getAiClient();
  
  // Safe validation and mapping of arrays to avoid potential TypeError when mapping undefined
  const safeTransactions = Array.isArray(data?.transactions) ? data.transactions : [];
  const safeAssets = Array.isArray(data?.assets) ? data.assets : [];
  const safeBudgets = Array.isArray(data?.budgets) ? data.budgets : [];

  const summary = `
    Transactions (recent 50): ${JSON.stringify(safeTransactions.map(t => ({ date: t?.date, type: t?.type, cat: t?.category, desc: t?.description, amount: t?.amount })))}
    Assets: ${JSON.stringify(safeAssets)}
    Budgets: ${JSON.stringify(safeBudgets)}
  `;

  const instruction = userQuestion 
    ? `You are an AI financial assistant. Answer the user's question based on the following data: "${userQuestion}". 
       If the data is insufficient to answer the question, state that. Keep the tone helpful and personalized.`
    : `You are a professional financial coach. Analyze the following financial data and provide 3-4 concise, actionable advice in Korean.
       Format your response as a single string of 4-5 sentences, using emojis.
       Include advice on recurring payments or asset allocation if data is available.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash", 
      contents: [
        {
          role: 'user',
          parts: [{ text: `
            ${instruction}
            
            Data Summary:
            ${summary}
          `}]
        }
      ]
    });

    const text = response.text;
    return text || "분석 결과를 생성하지 못했습니다. 잠시 후 다시 시도해주세요.";
  } catch (error: any) {
    console.error("Gemini API Error Detail:", error);
    // Rethrow to allow server or caller to handle status codes
    throw error;
  }
}

export async function translateText(text: string, targetLanguage: string) {
  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: `Translate the following text to ${targetLanguage}. Return ONLY the translated text.
    
    Text:
    ${text}`
  });

  return response.text || "번역에 실패했습니다.";
}
