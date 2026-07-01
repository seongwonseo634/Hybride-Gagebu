import { generateFinancialAdvice } from '../utils/_gemini';

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
    const { message, context: chatContext } = await context.request.json();
    const safeContext = chatContext || {};
    const advice = await generateFinancialAdvice(apiKey, { 
        transactions: safeContext.transactions || [], 
        assets: safeContext.assets || [], 
        budgets: safeContext.budgets || [] 
    }, message);
    
    return new Response(JSON.stringify({ response: advice }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e: any) {
    console.error("Chat Function Error:", e);
    return new Response(JSON.stringify({ error: e?.message || '비서가 응답할 수 없습니다.' }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
