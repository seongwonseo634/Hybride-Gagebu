import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot, User } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { toast } from 'sonner';

interface Message {
  role: 'user' | 'ai';
  text: string;
}

export function FinancialChat({ contextData }: { contextData: any }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{ role: 'ai', text: '안녕하세요! 금융 데이터에 대해 궁금한 점이 있으신가요?' }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, context: contextData }),
      });
      const data = await response.json();
      setMessages(prev => [...prev, { role: 'ai', text: data.response }]);
    } catch (error) {
      toast.error('응답을 가져오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-20 right-6 z-50">
      {isOpen ? (
        <Card className="w-80 h-96 flex flex-col neo rounded-2xl overflow-hidden animate-in slide-in-from-bottom-4">
          <div className="p-4 bg-primary text-primary-foreground flex justify-between items-center">
            <span className="font-bold flex items-center gap-2"><Bot className="w-4 h-4" /> AI 금융 비서</span>
            <button onClick={() => setIsOpen(false)}><X className="w-4 h-4" /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-background">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                  {m.text}
                </div>
              </div>
            ))}
            {loading && <div className="text-sm text-muted-foreground p-3">입력 중...</div>}
            <div ref={messagesEndRef} />
          </div>
          <div className="p-3 border-t flex gap-2">
            <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="질문을 입력하세요..." onKeyPress={(e) => e.key === 'Enter' && handleSend()} />
            <Button onClick={handleSend} size="icon"><Send className="w-4 h-4" /></Button>
          </div>
        </Card>
      ) : (
        <Button onClick={() => setIsOpen(true)} className="rounded-full w-14 h-14 neo-button flex items-center justify-center p-0 shadow-lg bg-emerald-500 text-white">
          <MessageSquare className="w-6 h-6" />
        </Button>
      )}
    </div>
  );
}
