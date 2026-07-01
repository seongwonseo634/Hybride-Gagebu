// Cloudflare Pages Function Gemini API Helper
// Using native fetch to ensure maximum compatibility in Edge runtime

function cleanAndParseJson(text: string | undefined): any {
  if (!text) return {};
  let cleaned = text.trim();
  
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

async function generateWithFallback(apiKey: string, params: {
  model?: string;
  contents: any;
  config?: any;
}) {
  const modelsToTry = [
    "gemini-2.5-flash",
    "gemini-1.5-flash"
  ];

  if (params.model && !modelsToTry.includes(params.model)) {
    modelsToTry.unshift(params.model);
  }

  let lastError: any = null;

  let resolvedContents = params.contents;
  if (typeof resolvedContents === 'string') {
    resolvedContents = [
      {
        role: 'user',
        parts: [{ text: resolvedContents }]
      }
    ];
  } else if (Array.isArray(resolvedContents)) {
    // If it's the OCR image structure or similar
    resolvedContents = resolvedContents.map(c => {
      if (c && typeof c === 'object' && c.parts) {
        return c;
      }
      return {
        role: 'user',
        parts: Array.isArray(c) ? c : [c]
      };
    });
  }

  for (const modelName of modelsToTry) {
    const resolvedModelName = (modelName === "gemini-3.5-flash" || modelName === "gemini-flash-latest") 
      ? "gemini-2.5-flash" 
      : modelName;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${resolvedModelName}:generateContent?key=${apiKey}`;

    const generationConfig: any = {};
    if (params.config) {
      if (params.config.responseMimeType) {
        generationConfig.responseMimeType = params.config.responseMimeType;
      }
      if (params.config.responseSchema) {
        generationConfig.responseSchema = params.config.responseSchema;
      }
      if (params.config.temperature !== undefined) {
        generationConfig.temperature = params.config.temperature;
      }
    }

    const body: any = {
      contents: resolvedContents,
    };

    if (Object.keys(generationConfig).length > 0) {
      body.generationConfig = generationConfig;
    }

    if (params.config?.systemInstruction) {
      body.systemInstruction = {
        parts: [{ text: params.config.systemInstruction }]
      };
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const json = await response.json();
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
      return { text };
    } catch (error: any) {
      lastError = error;
      console.warn(`Gemini model ${resolvedModelName} failed. Error:`, error);
    }
  }

  throw new Error(`All Gemini Models failed. Last error: ${lastError?.message || lastError}`);
}

export async function parseReceipt(apiKey: string, base64Image: string, mimeType: string) {
  const response = await generateWithFallback(apiKey, {
    model: "gemini-2.5-flash",
    contents: [
      {
        role: 'user',
        parts: [
          { text: `Extract the following details from this receipt image: date (YYYY-MM-DD), store name (description), amount (as an integer number), and category. 
          If any values cannot be detected with confidence:
          - For 'date', return an empty string "" or today's date in YYYY-MM-DD format.
          - For 'description' (store name), return an empty string "" or a very short description of the item.
          - For 'amount', return 0.
          
          Identify one of the core categories: '식비', '교통/차량', '쇼핑/뷰티', '문화/여가', '건강/운동', '공과금/요금', '주거/통신', '교육', '경조사', '기타'.` },
          { inlineData: { data: base64Image, mimeType: mimeType } }
        ]
      }
    ],
    config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            date: { 
              type: "STRING", 
              description: "The payment date in YYYY-MM-DD format. Return empty string if not found." 
            },
            description: { 
              type: "STRING", 
              description: "The store name or brand name. Return empty string if not found." 
            },
            amount: { 
              type: "INTEGER", 
              description: "The total payment integer amount (e.g. 15000). Return 0 if not found." 
            },
            category: { 
              type: "STRING", 
              enum: ['식비', '교통/차량', '쇼핑/뷰티', '문화/여가', '건강/운동', '공과금/요금', '주거/통신', '교육', '경조사', '기타'],
              description: "The best matching financial category." 
            }
          },
          required: ["date", "description", "amount", "category"]
        }
    }
  });

  return cleanAndParseJson(response.text);
}

export async function classifyTransactionCategory(apiKey: string, description: string) {
  const response = await generateWithFallback(apiKey, {
    model: "gemini-2.5-flash",
    contents: `Classify the following transaction description into the most relevant category: "${description}"`,
    config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            category: {
              type: "STRING",
              enum: ['식비', '교통/차량', '쇼핑/뷰티', '문화/여가', '건강/운동', '공과금/요금', '주거/통신', '교육', '경조사', '기타'],
              description: "The best fitting category for this transaction description form."
            }
          },
          required: ["category"]
        }
    }
  });

  return cleanAndParseJson(response.text);
}

export async function generateFinancialAdvice(apiKey: string, data: { transactions: any[], assets: any[], budgets: any[] }, userQuestion?: string) {
  const safeTransactions = Array.isArray(data?.transactions) ? data.transactions : [];
  const safeAssets = Array.isArray(data?.assets) ? data.assets : [];
  const safeBudgets = Array.isArray(data?.budgets) ? data.budgets : [];

  const summary = `
    [거래 내역 (최근 50건, 원화 기준)]
    ${JSON.stringify(safeTransactions.map(t => ({ date: t?.date, type: t?.type === 'expense' ? '지출' : '수입', category: t?.category, description: t?.description, amount: t?.amount })))}

    [보유 자산 내역 (원화 기준)]
    ${JSON.stringify(safeAssets.map(a => ({ name: a?.name, value: a?.value })))}

    [예산 설정 내역 (원화 기준)]
    ${JSON.stringify(safeBudgets.map(b => ({ category: b?.category, limit: (Number(b?.limit) || 0) * 10000, spent: (Number(b?.spent) || 0) * 10000 })))}
  `;

  const systemInstruction = `You are a professional, warm, and friendly AI financial assistant and coach. 
Your goal is to provide insightful, smart, and highly actionable suggestions based on the user's financial data.
All inputs (transaction amounts, asset values, and budget limits) are in Korean Won (KRW). Keep units aligned.
Provide rich responses in Korean, formatted beautifully with headers, bold text, bullet points, and clean line breaks to ensure peak visual readability.`;

  const prompt = userQuestion 
    ? `사용자의 재무 데이터와 현재 질문이 주어졌습니다. 친근하고 구체적으로 답변해 주세요.

금융 데이터 요약:
${summary}

사용자 질문:
"${userQuestion}"

재무 데이터와 예산 정보를 참고하여 질문에 3~4문장의 깔끔하고 실용적인 한국어 답변을 작성해 주세요. 질문자가 예산이나 최근 지출액을 명확히 파악할 수 있도록 구체적인 금액 수치(원)를 언급해 주세요.`
    : `사용자의 전체 재무 데이터를 정밀하게 조석하여 현재 재무 건강도를 진단하고 3-4가지의 실천 가능한 구체적 조언을 해주세요.

금융 데이터 요약:
${summary}

다음 구조를 참고하여 깔끔한 한국어 보고서로 작성해주세요:
1. 📊 **현재 요약**: 수입, 지출 및 자산 비중 요약
2. 💡 **맞춤형 재무 제안 (3-4개 조언)**:
   - 예산 대비 실지출 비율에 따른 피드백 (예: 예산 초과 위험 카테고리 알림 및 비중 조절 제안)
   - 보유 자산 구성이나 지출 형태에 바탕을 둔 구체적인 절약 및 투자 팁
   - 정기결제나 불필요한 고정 지출에 관한 조언

 must write concrete number values in KRW.`;

  const response = await generateWithFallback(apiKey, {
    model: "gemini-2.5-flash", 
    contents: prompt,
    config: {
      systemInstruction: systemInstruction,
      temperature: 0.7,
    }
  });

  return response.text || "분석 결과를 생성하지 못했습니다. 잠시 후 다시 시도해주세요.";
}

export async function translateText(apiKey: string, text: string, targetLanguage: string) {
  const response = await generateWithFallback(apiKey, {
    model: "gemini-2.5-flash",
    contents: `Translate the following text to ${targetLanguage}. Return ONLY the translated text.\n\nText:\n${text}`
  });

  return response.text || "번역에 실패했습니다.";
}
