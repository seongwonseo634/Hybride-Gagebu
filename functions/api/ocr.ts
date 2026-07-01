import { parseReceipt } from '../utils/_gemini';

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
    const { base64Data, mimeType } = await context.request.json();
    const result = await parseReceipt(apiKey, base64Data, mimeType);
    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e: any) {
    console.error("OCR Function Error:", e);
    return new Response(JSON.stringify({ error: e?.message || 'OCR 처리 중 오류가 발생했습니다.' }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
