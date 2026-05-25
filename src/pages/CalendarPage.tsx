import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isSameDay, addMonths, subMonths, isWeekend, isSunday, isSaturday } from 'date-fns';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Trash2, AlertCircle, Inbox } from 'lucide-react';
import { collection, query, where, getDocs, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { PersonalTransaction } from '../types';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { useAuth } from '../contexts/AuthContext';
import { CategoryIcon } from '../components/CategoryIcon';

const holidays = [
  '2026-01-01', // 신정
  '2026-02-16', // 설날 연휴
  '2026-02-17', // 설날
  '2026-02-18', // 설날 연휴
  '2026-03-01', // 삼일절
  '2026-03-02', // 삼일절 대체공휴일
  '2026-05-05', // 어린이날
  '2026-05-24', // 부처님오신날
  '2026-05-25', // 부처님오신날 대체공휴일
  '2026-06-06', // 현충일
  '2026-08-15', // 광복절
  '2026-08-17', // 광복절 대체공휴일
  '2026-09-24', // 추석 연휴
  '2026-09-25', // 추석
  '2026-09-26', // 추석 연휴
  '2026-10-03', // 개천절
  '2026-10-05', // 개천절 대체공휴일
  '2026-10-09', // 한글날
  '2026-12-25', // 기독탄신일
];

const isPublicHoliday = (date: Date) => {
  return holidays.includes(format(date, 'yyyy-MM-dd'));
};

export default function CalendarPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [transactions, setTransactions] = useState<PersonalTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
        setLoading(false);
        return;
    }

    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    const q = query(
      collection(db, `users/${user.uid}/transactions`),
      orderBy('date', 'desc')
    );

    setLoading(true);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log('CalendarPage: Snapshot received. Docs count:', snapshot.size);
      const data: PersonalTransaction[] = [];
      snapshot.forEach((doc) => {
        const d = doc.data() as PersonalTransaction;
        data.push({ id: doc.id, ...d });
      });
      setTransactions(data);
      setLoading(false);
    }, (error) => {
      console.error("Calendar Snapshot Error:", error);
      toast.error("데이터를 실시간으로 불러오지 못했습니다.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, currentDate]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const selectedDateTransactions = transactions.filter(t => t.date === format(selectedDate, 'yyyy-MM-dd'));
  const dailyIncome = selectedDateTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + (t.amount || 0), 0);
  const dailyExpense = selectedDateTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + (t.amount || 0), 0);

  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    console.log('Attempting to delete transaction:', id, 'for user:', user?.uid);
    setIsDeleting(id);
    try {
      const transactionDocRef = doc(db, `users/${user?.uid}/transactions`, id);
      await deleteDoc(transactionDocRef);
      setTransactions(prev => prev.filter(t => t.id !== id));
      toast.success('내역이 삭제되었습니다.');
    } catch (error) {
      console.error('Delete error for transaction:', id, error);
      toast.error('삭제에 실패했습니다.');
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <div className="p-4 space-y-6 max-w-3xl mx-auto min-h-screen pb-24 animate-in fade-in">
      <Button onClick={() => navigate('/')} variant="ghost" className="text-sm font-bold text-emerald-600 mb-2">
           &lt;- 이전으로
      </Button>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">달력 및 일별 내역</h2>
        <div className="flex items-center space-x-2 neo-inset p-1 rounded-2xl">
          <Button variant="ghost" className="rounded-xl h-8 w-8 p-0" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="relative">
             <input 
                type="date" 
                className="absolute inset-0 opacity-0 cursor-pointer"
                onChange={(e) => {
                    if (e.target.value) setCurrentDate(new Date(e.target.value));
                }}
             />
             <span className="font-bold px-2 cursor-pointer">{format(currentDate, 'yyyy년 M월')}</span>
          </div>
          <Button variant="ghost" className="rounded-xl h-8 w-8 p-0" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="neo p-4 rounded-2xl">
        <div className="grid grid-cols-7 gap-2 text-center mb-2">
          {['일', '월', '화', '수', '목', '금', '토'].map((day) => (
            <div key={day} className={`text-xs font-bold py-2 ${['일', '토'].includes(day) ? 'text-brand-coral' : 'text-muted-foreground'}`}>
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-2 gap-x-1">
          {days.map((day, idx) => {
            const dayStr = format(day, 'yyyy-MM-dd');
            const dayTransactions = transactions.filter(t => t.date === dayStr);
            const income = dayTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + (t.amount || 0), 0);
            const expense = dayTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + (t.amount || 0), 0);
            
            const isSelected = isSameDay(day, selectedDate);
            const isCurrentMonth = isSameMonth(day, monthStart);
            const isToday = isSameDay(day, new Date());
            const weekend = isWeekend(day);
            const holiday = isPublicHoliday(day);
            const isRedDay = weekend || holiday;

            return (
              <div
                key={day.toString()}
                onClick={() => setSelectedDate(day)}
                className={`min-h-[70px] p-1 rounded-xl cursor-pointer transition-all flex flex-col justify-between
                  ${!isCurrentMonth ? 'opacity-40' : ''}
                  ${isSelected ? 'neo border-2 border-primary' : 'neo-inset hover:opacity-80'}
                `}
              >
                <div className={`text-xs font-bold text-right p-1 ${isToday ? 'text-primary' : isRedDay ? 'text-brand-coral' : ''}`}>
                  {format(day, 'd')}
                </div>
                <div className="space-y-0.5 text-[10px] leading-tight pb-1 px-1">
                  {income > 0 && <div className="text-brand-teal font-bold text-right">+{income.toLocaleString()}</div>}
                  {expense > 0 && <div className="text-brand-coral font-bold text-right">-{expense.toLocaleString()}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="font-bold text-lg">{format(selectedDate, 'M월 d일')} 내역 상세</h3>
          <div className="text-sm font-bold bg-muted px-4 py-1.5 rounded-full shadow-sm">
            <span className="text-brand-mint mr-3">↑ {dailyIncome.toLocaleString()}</span>
            <span className="text-brand-coral">↓ {dailyExpense.toLocaleString()}</span>
          </div>
        </div>

        {selectedDateTransactions.length > 0 ? (
          <div className="space-y-4">
            {selectedDateTransactions.map(tx => (
              <div key={tx.id} className="neo rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-xl neo-inset flex items-center justify-center text-primary">
                    <CategoryIcon category={tx.category} className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-bold text-base">{tx.description || tx.category}</p>
                    <p className="text-xs text-muted-foreground font-bold mt-1">
                      {tx.category} {tx.paymentMethod ? `• ${tx.paymentMethod}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3 text-right">
                  <p className={`font-bold text-lg ${tx.type === 'income' ? 'text-brand-mint' : 'text-foreground'}`}>
                    {tx.type === 'income' ? '+' : '-'}₩{(tx.amount || 0).toLocaleString()}
                  </p>
                  <button onClick={(e) => handleDelete(e, tx.id)} disabled={isDeleting === tx.id} className="w-10 h-10 flex items-center justify-center rounded-full text-muted-foreground hover:text-brand-coral hover:bg-brand-coral/10 transition-all disabled:opacity-50">
                    {isDeleting === tx.id ? <div className="w-5 h-5 border-2 border-t-brand-coral border-transparent rounded-full animate-spin" /> : <Trash2 className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground font-bold neo-inset rounded-xl p-4">
            선택한 날짜의 수입/지출 내역이 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}
