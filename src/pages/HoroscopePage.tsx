import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';

export default function HoroscopePage() {
    const navigate = useNavigate();
    const [zodiac, setZodiac] = useState('쥐띠');
    const [horoscope, setHoroscope] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const generateHoroscope = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/horoscope', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ zodiac }),
            });
            if (!response.ok) throw new Error('Failed to fetch');
            const data = await response.json();
            setHoroscope(data);
        } catch (e) {
            toast.error('운세를 불러오는데 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const zodiacMap = [
        { name: '쥐띠', emoji: '🐭' },
        { name: '소띠', emoji: '🐮' },
        { name: '호랑이띠', emoji: '🐯' },
        { name: '토끼띠', emoji: '🐰' },
        { name: '용띠', emoji: '🐲' },
        { name: '뱀띠', emoji: '🐍' },
        { name: '말띠', emoji: '🐴' },
        { name: '양띠', emoji: '🐏' },
        { name: '원숭이띠', emoji: '🐵' },
        { name: '닭띠', emoji: '🐔' },
        { name: '개띠', emoji: '🐶' },
        { name: '돼지띠', emoji: '🐷' }
    ];

    return (
        <div className="p-4 md:p-8 max-w-lg mx-auto space-y-6">
            <Button onClick={() => navigate('/')} variant="ghost" className="text-sm font-bold text-emerald-600 -ml-4">
               &lt;- 이전으로
            </Button>
            <h2 className="text-2xl font-bold text-center">오늘의 운세</h2>
            
            <select 
                value={zodiac} 
                onChange={(e) => setZodiac(e.target.value)}
                className="w-full p-2 border rounded-xl bg-gray-50 dark:bg-gray-900"
            >
                {zodiacMap.map(z => <option key={z.name} value={z.name}>{z.emoji} {z.name}</option>)}
            </select>

            <Button onClick={generateHoroscope} disabled={loading} className="w-full neo-button text-emerald-600 font-bold">
                {loading ? <Loader2 className="animate-spin" /> : <><Sparkles className="mr-2" /> 운세 확인하기</>}
            </Button>

            {horoscope && (
                <div className="neo p-6 rounded-3xl space-y-4">
                    <div className="text-center font-bold text-xl">
                        {zodiacMap.find(z => z.name === horoscope.zodiac)?.emoji} {horoscope.zodiac}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="neo-inset p-3 rounded-xl text-center">
                            <p className="text-xs text-muted-foreground">행운의 색</p>
                            <p className="font-bold text-lg">{horoscope.luckyColor}</p>
                        </div>
                        <div className="neo-inset p-3 rounded-xl text-center">
                            <p className="text-xs text-muted-foreground">행운의 숫자</p>
                            <p className="font-bold text-lg">{horoscope.luckyNumber}</p>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <p>💖 사랑운: {horoscope.love}</p>
                        <p>💰 재물운: {horoscope.wealth}</p>
                        <p>💪 건강운: {horoscope.health}</p>
                    </div>
                </div>
            )}
        </div>
    );
}
