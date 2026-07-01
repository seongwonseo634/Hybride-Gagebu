import { classifyTransactionCategory } from '../utils/_gemini';

export const onRequestPost = async (context: any) => {
  const apiKey = context.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'GEMINI_API_KEY가 설정되지 않았습니다.' }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const { description } = await context.request.json();
    const result = await classifyTransactionCategory(apiKey, description);
    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e: any) {
    console.error("Categorize Function Error:", e);
    return new Response(JSON.stringify({ error: e?.message || '분류 중 오류가 발생했습니다.' }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
