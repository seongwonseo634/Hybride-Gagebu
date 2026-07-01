import { generateFinancialAdvice } from '../../utils/_gemini';

export const onRequestPost = async (context: any) => {
  const apiKey = context.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ 
      error: 'GEMINI_API_KEY가 설정되지 않았습니다. Cloudflare Pages 설정에서 환경 변수를 등록해주세요.' 
    }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const { transactions, assets, budgets, question } = await context.request.json();
    const advice = await generateFinancialAdvice(apiKey, { transactions, assets, budgets }, question);
    return new Response(JSON.stringify({ advice }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e: any) {
    console.error("AI Report Function Error:", e);
    const errorString = e?.toString() || "";
    let message = 'AI 분석 중 예기치 않은 오류가 발생했습니다.';
    let statusCode = 500;
    
    if (errorString.includes("429") || errorString.includes("RESOURCE_EXHAUSTED")) {
      message = 'AI 서비스 사용량이 초과되었습니다. 잠시 후 다시 시도해 주세요.';
      statusCode = 429;
    }
    
    if (errorString.includes("503") || errorString.includes("UNAVAILABLE")) {
      message = 'AI 서비스가 현재 매우 바쁩니다. 잠시 후 다시 시도해 주세요.';
      statusCode = 503;
    }
    
    return new Response(JSON.stringify({ 
      error: e?.message || message, 
      code: statusCode === 429 ? 'QUOTA_EXHAUSTED' : (statusCode === 503 ? 'UNAVAILABLE' : 'ERROR') 
    }), {
      status: statusCode,
      headers: { "Content-Type": "application/json" }
    });
  }
};
