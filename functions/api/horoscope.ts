import { fortunes } from '../utils/_horoscopes';

export const onRequestPost = async (context: any) => {
  try {
    const { zodiac } = await context.request.json();
    const zodiacFortune = fortunes.find(f => f.zodiac === zodiac) || fortunes[0];
    const getRandom = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
    
    const result = {
        zodiac: zodiacFortune.zodiac,
        love: getRandom(zodiacFortune.love),
        wealth: getRandom(zodiacFortune.wealth),
        health: getRandom(zodiacFortune.health),
        luckyColor: getRandom(zodiacFortune.luckyColors),
        luckyNumber: getRandom(zodiacFortune.luckyNumbers)
    };
    
    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e: any) {
    console.error("Horoscope Function Error:", e);
    return new Response(JSON.stringify({ error: e?.message || '운세 정보를 가져오는 데 실패했습니다.' }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
