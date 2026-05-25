import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.post('/api/ai/report', async (req, res) => {
    try {
      const { generateFinancialAdvice } = await import('./src/lib/geminiService');
      const { transactions, assets, budgets, question } = req.body;
      const advice = await generateFinancialAdvice({ transactions, assets, budgets }, question);
      res.json({ advice });
    } catch (e: any) {
      console.error("AI Report Route Error:", e);
      const errorString = e?.toString() || "";
      let message = 'AI 분석 중 예기치 않은 오류가 발생했습니다.';
      let statusCode = 500;
      
      if (errorString.includes("429") || errorString.includes("RESOURCE_EXHAUSTED")) {
        message = 'AI 서비스 월간 사용 한도가 초과되었습니다. AI Studio 설정에서 한도를 조정해 주세요.';
        statusCode = 429;
      }
      
      if (errorString.includes("503") || errorString.includes("UNAVAILABLE")) {
        message = 'AI 서비스가 현재 매우 바쁩니다. 잠시 후 다시 시도해 주세요.';
        statusCode = 503;
      }
      
      res.status(statusCode).json({ error: message, code: statusCode === 429 ? 'QUOTA_EXHAUSTED' : (statusCode === 503 ? 'UNAVAILABLE' : 'ERROR') });
    }
  });

  app.post('/api/categorize', async (req, res) => {
    try {
        const { classifyTransactionCategory } = await import('./src/lib/geminiService');
        const { description } = req.body;
        const result = await classifyTransactionCategory(description);
        res.json(result);
    } catch (e) {
        console.error("Categorize API Route Error:", e);
        res.status(500).json({ error: '분류 중 오류가 발생했습니다.' });
    }
  });

  app.post('/api/ai/translate', async (req, res) => {
    try {
        const { translateText } = await import('./src/lib/geminiService');
        const { text, targetLanguage } = req.body;
        const translatedText = await translateText(text, targetLanguage);
        res.json({ translatedText });
    } catch (e) {
        console.error("Translate API Route Error:", e);
        res.status(500).json({ error: '번역 중 오류가 발생했습니다.' });
    }
  });

  app.post('/api/ocr', async (req, res) => {
    try {
        const { parseReceipt } = await import('./src/lib/geminiService');
        const { base64Data, mimeType } = req.body;
        const result = await parseReceipt(base64Data, mimeType);
        res.json(result);
    } catch (e) {
        console.error("OCR API Route Error:", e);
        res.status(500).json({ error: 'OCR 처리 중 오류가 발생했습니다.' });
    }
  });

  app.post('/api/horoscope', async (req, res) => {
      const { fortunes } = await import('./src/lib/horoscopes');
      const { zodiac } = req.body;
      const zodiacFortune = fortunes.find(f => f.zodiac === zodiac) || fortunes[0];
      const getRandom = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
      
      res.json({
          zodiac: zodiacFortune.zodiac,
          love: getRandom(zodiacFortune.love),
          wealth: getRandom(zodiacFortune.wealth),
          health: getRandom(zodiacFortune.health),
          luckyColor: getRandom(zodiacFortune.luckyColors),
          luckyNumber: getRandom(zodiacFortune.luckyNumbers)
      });
  });

  app.post('/api/chat', async (req, res) => {
    try {
        const { generateFinancialAdvice } = await import('./src/lib/geminiService');
        const { message, context } = req.body;
        const advice = await generateFinancialAdvice({ 
            transactions: context.transactions || [], 
            assets: context.assets || [], 
            budgets: context.budgets || [] 
        }, message);
        res.json({ response: advice });
    } catch (e) {
        console.error("Chat API Route Error:", e);
        res.status(500).json({ error: '비서가 응답할 수 없습니다.' });
    }
  });

  app.get('/api/transactions', async (req, res) => {
    try {
      res.status(200).json({ error: 'Not implemented or need Firebase Admin' });
    } catch (e) { res.status(500).json({error: 'Failed'}); }
  });

  // Logging middleware for debugging
  app.use((req, res, next) => {
    console.log(`[DEBUG] Request: ${req.method} ${req.url}`);
    next();
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), 'dist')));
  }

  // Unified SPA fallback catch-all
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    const filePath = process.env.NODE_ENV === 'production' 
      ? path.join(process.cwd(), 'dist', 'index.html')
      : path.join(process.cwd(), 'index.html'); // Fallback for dev if vite middleware misses
    res.sendFile(filePath);
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
