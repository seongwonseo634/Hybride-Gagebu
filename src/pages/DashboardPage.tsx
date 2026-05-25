import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, AreaChart, Area, ComposedChart } from 'recharts';
import { ArrowDownRight, ArrowUpRight, Wallet, Activity, Trash2, TrendingUp, TrendingDown, Target, Sparkles, AlertCircle, Users, CheckCircle2, Calendar, Lightbulb, PieChart as PieChartIcon, Download, FileText, Search, Inbox, X } from 'lucide-react';
import { CategoryIcon } from '../components/CategoryIcon';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { useAuth } from '../contexts/AuthContext';
import { Goal } from '../types';
import { collection, query, orderBy, doc, deleteDoc, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, createSnapshotListener } from '../lib/firebase';
import { PersonalTransaction, GroupTransaction, GroupDue } from '../types';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subMonths, startOfYear, endOfYear, subWeeks, parseISO, differenceInDays, getDay, isSameDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import { toPng } from 'html-to-image';

const DAYS_KO = ['일', '월', '화', '수', '목', '금', '토'];

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [allPersonalTxs, setAllPersonalTxs] = useState<PersonalTransaction[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'1w' | '1m' | '3m' | '6m' | '1y' | 'all'>(() => {
    return (localStorage.getItem('dashboard-timerange') as any) || '3m';
  });
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  useEffect(() => {
    localStorage.setItem('dashboard-timerange', timeRange);
  }, [timeRange]);
  
  // --- 추가된 기능: 검색어 상태 관리 ---
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isDownloading, setIsDownloading] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<PersonalTransaction | GroupTransaction | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const handleDownloadPDF = async () => {
    if (!reportRef.current) return;
    setIsDownloading(true);
    const toastId = toast.loading('프리미엄 리포트 PDF 생성 중...');
    
    try {
      const element = reportRef.current;
      
      const parent = element.parentElement;
      if (parent) {
        parent.style.position = 'absolute';
        parent.style.left = '0px';
        parent.style.top = '0px';
        parent.style.zIndex = '-100';
      }
      
      await new Promise(resolve => setTimeout(resolve, 800));
      
      let dataUrl;
      try {
        dataUrl = await toPng(element, { 
            pixelRatio: 1,
            backgroundColor: '#ffffff',
            cacheBust: true,
            style: { transform: 'scale(1)', transformOrigin: 'top left' }
        });
      } catch (firstErr) {
        console.warn('First pass failed, retrying...', firstErr);
        await new Promise(resolve => setTimeout(resolve, 1000));
        dataUrl = await toPng(element, { 
            pixelRatio: 1,
            backgroundColor: '#ffffff',
            cacheBust: true,
            style: { transform: 'scale(1)', transformOrigin: 'top left' }
        });
      }
      
      if (parent) {
        parent.style.position = 'absolute';
        parent.style.left = '-9999px';
        parent.style.top = '-9999px';
      }
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (element.offsetHeight * pdfWidth) / element.offsetWidth;
      
      pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
      
      const fileName = `Premium_Report_${format(new Date(), 'yyyyMMdd')}.pdf`;
      const pdfBlob = pdf.output('blob');

      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

      if (isMobile && typeof navigator !== 'undefined' && navigator.canShare) {
        try {
          const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
          if (navigator.canShare({ files: [file] })) {
             await navigator.share({
               files: [file],
               title: '금융 리포트',
               text: '생성된 프리미엄 금융 리포트입니다.',
             });
             toast.success('리포트 공유가 완료되었습니다.', { id: toastId });
             setIsDownloading(false);
             return;
          }
        } catch (shareErr) {
          console.error('Share API canceled or failed:', shareErr);
        }
      }
      
      pdf.save(fileName);
      toast.success('리포트 다운로드가 완료되었습니다.', { id: toastId });
    } catch (e: any) {
      console.error('PDF Generation Error:', e);
      toast.error(`리포트 생성에 실패했습니다. (${e.message || '알 수 없는 오류'})`, { id: toastId });
    } finally {
      setIsDownloading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    
    console.log('DashboardPage: Listening to transactions for user UID:', user.uid);
    console.log('DashboardPage: Transactions path:', `users/${user.uid}/transactions`);
    
    const q = query(
      collection(db, `users/${user.uid}/transactions`)
    );

    const unsubscribe = createSnapshotListener(q, (snapshot) => {
      console.log('DashboardPage: Snapshot received. Docs count:', snapshot.size);
      const txs = snapshot.docs.map(doc => {
          const data = doc.data();
          console.log('DashboardPage: Transaction ID:', doc.id, 'Date:', data.date);
          return { id: doc.id, ...data }
      }) as PersonalTransaction[];
      txs.sort((a,b) => (b.date || "").localeCompare(a.date || ""));
      console.log('DashboardPage: All transactions (sorted):', txs);
      setAllPersonalTxs(txs);
      setLoading(false);
      setError(null);
    }, (error) => {
      console.error('Snapshot error for user:', user.uid, error);
      setError('데이터를 불러오는 중 오류가 발생했습니다. 잠시 후 서버를 다시 연결합니다.');
      setLoading(false);
    }, `users/${user.uid}/transactions`);

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) {
      setGoals([]);
      return;
    }
    
    const q = query(
      collection(db, `users/${user.uid}/goals`),
      orderBy('createdAt', 'desc')
    );
    
    const unsubscribe = createSnapshotListener(q, (snapshot) => {
      const gs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Goal[];
      setGoals(gs);
    }, (error) => {
       console.error('Goal snapshot error', error);
    }, `users/${user.uid}/goals`);
    
    return () => unsubscribe();
  }, [user]);

  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    console.log('Attempting to delete transaction:', id, 'for user:', user?.uid);
    setIsDeleting(id);
    try {
      await deleteDoc(doc(db, `users/${user?.uid}/transactions`, id));
      
      setAllPersonalTxs(prev => prev.filter(t => t.id !== id));
      
      toast.success('내역이 삭제되었습니다.');
      console.log('Successfully deleted transaction:', id);
    } catch (error) {
      console.error('Delete error for transaction:', id, error);
      toast.error('삭제에 실패했습니다.');
    } finally {
      setIsDeleting(null);
    }
  };

  const isGroup = false;
  const allTxs: any[] = allPersonalTxs;

  const totalIncomeAllTime = allTxs.filter(t => t.type === 'income').reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const totalExpenseAllTime = allTxs.filter(t => t.type === 'expense').reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const netWorth = totalIncomeAllTime - totalExpenseAllTime;

  const [now] = useState(() => new Date());
  const { sd, ed, prevSd, prevEd } = useMemo(() => {
    let sd = new Date(), ed = new Date(), prevSd = new Date(), prevEd = new Date();
    switch (timeRange) {
      case '1w':
        sd = startOfWeek(now, { weekStartsOn: 1 });
        ed = endOfWeek(now, { weekStartsOn: 1 });
        prevSd = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
        prevEd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
        break;
      case '1m':
        sd = startOfMonth(now);
        ed = endOfMonth(now);
        prevSd = startOfMonth(subMonths(now, 1));
        prevEd = endOfMonth(subMonths(now, 1));
        break;
      case '3m':
        sd = startOfMonth(subMonths(now, 2));
        ed = endOfMonth(now);
        prevSd = startOfMonth(subMonths(now, 5));
        prevEd = endOfMonth(subMonths(now, 3));
        break;
      case '6m':
        sd = startOfMonth(subMonths(now, 5));
        ed = endOfMonth(now);
        prevSd = startOfMonth(subMonths(now, 11));
        prevEd = endOfMonth(subMonths(now, 6));
        break;
      case '1y':
        sd = startOfYear(now);
        ed = endOfYear(now);
        prevSd = startOfYear(subMonths(now, 12));
        prevEd = endOfYear(subMonths(now, 12));
        break;
      case 'all':
        // Robust 'all' range: year 2000 to 2100
        sd = new Date(2000, 0, 1);
        ed = new Date(2100, 0, 1);
        prevSd = sd;
        prevEd = ed;
        break;
    }
    return { sd, ed, prevSd, prevEd };
  }, [timeRange, allTxs.length, now]);

  const startDateStr = format(sd, 'yyyy-MM-dd');
  const endDateStr = format(ed, 'yyyy-MM-dd');
  const prevStartDateStr = format(prevSd, 'yyyy-MM-dd');
  const prevEndDateStr = format(prevEd, 'yyyy-MM-dd');

  const txsInDateRange = useMemo(() => {
    console.log('DashboardPage: Calculating txsInDateRange. All txs count:', allTxs.length, 'startDate:', startDateStr, 'endDate:', endDateStr);
    if (timeRange === 'all') return allTxs;
    const filtered = allTxs.filter(tx => {
        if (!tx.date) return false;
        const txDate = parseISO(tx.date);
        const isInRange = txDate >= sd && txDate <= ed;
        if (!isInRange) console.log('DashboardPage: Transaction out of range:', tx.id, tx.date);
        return isInRange;
    });
    console.log('DashboardPage: Filtered transactions count:', filtered.length);
    return filtered;
  }, [allTxs, timeRange, startDateStr, endDateStr]);

  const availableCategories = useMemo(() => {
    return Array.from(new Set(txsInDateRange.map(tx => tx.category))).sort();
  }, [txsInDateRange]);

  const currentTxs = useMemo(() => {
    return selectedCategory === 'all' 
      ? txsInDateRange 
      : txsInDateRange.filter(tx => tx.category === selectedCategory);
  }, [txsInDateRange, selectedCategory]);
    
  // --- 추가된 기능: 검색어에 따른 리스트 필터링 ---
  const filteredTxs = useMemo(() => {
    return currentTxs.filter(tx => 
      (tx.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (tx.category || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [currentTxs, searchQuery]);

  const prevTxs = useMemo(() => {
    return allTxs.filter(tx => tx.date >= prevStartDateStr && tx.date <= prevEndDateStr && (selectedCategory === 'all' || tx.category === selectedCategory));
  }, [allTxs, prevStartDateStr, prevEndDateStr, selectedCategory]);

  const income = currentTxs.filter(t => t.type === 'income').reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const expense = currentTxs.filter(t => t.type === 'expense').reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const savingsRate = income > 0 ? Math.max(0, Math.round(((income - expense) / income) * 100)) : 0;

  const prevIncome = prevTxs.filter(t => t.type === 'income').reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const prevExpense = prevTxs.filter(t => t.type === 'expense').reduce((acc, curr) => acc + (curr.amount || 0), 0);

  const expenseChange = prevExpense > 0 ? Math.round(((expense - prevExpense) / prevExpense) * 100) : 0;

  const expensesByCategory = currentTxs
    .filter(t => t.type === 'expense')
    .reduce((acc, curr) => {
      acc[curr.category] = (acc[curr.category] || 0) + (curr.amount || 0);
      return acc;
    }, {} as Record<string, number>);

  const donutChartData = Object.keys(expensesByCategory).map(key => ({
    name: key,
    value: expensesByCategory[key]
  })).sort((a, b) => b.value - a.value);
  const topCategory = donutChartData.length > 0 ? donutChartData[0] : null;

  const COLORS = ['#20c997', '#3b82f6', '#ff6b6b', '#f59e0b', '#8b5cf6', '#10b981', '#6366f1', '#ec4899', '#14b8a6'];

  const insights = [];
  if (timeRange === '1w') {
    if (expenseChange > 0) insights.push(`외식/쇼핑 등 전체 지출이 지난주 대비 ${expenseChange}% 증가했습니다.`);
    else if (expenseChange < 0) insights.push(`지난주보다 지출을 ${Math.abs(expenseChange)}% 절약했습니다!`);
    if (topCategory) insights.push(`이번 주 가장 많이 소비한 항목은 '${topCategory.name}'(₩${topCategory.value.toLocaleString()}) 입니다.`);
  } else if (timeRange === '1m') {
    insights.push(`이번 달 저축률은 ${savingsRate}% 입니다.`);
    const recurring = currentTxs.filter(t => t.description?.includes('구독') || t.description?.includes('넷플릭스') || t.category === '통신/구독');
    if (recurring.length > 0) insights.push(`정기결제로 추정되는 지출이 ${recurring.length}건 발견되었습니다.`);
  } else {
    insights.push(`조회 기간 동안 자산이 ₩${(income - expense).toLocaleString()} 증가했습니다.`);
    if (topCategory) insights.push(`전체 지출 중 '${topCategory.name}' 비중이 가장 높습니다.`);
  }

  let primaryChart = null;
  
  if (timeRange === '1w') {
    const days = [1, 2, 3, 4, 5, 6, 0];
    const weekData = days.map(dayIndex => {
      const dayStr = DAYS_KO[dayIndex];
      const dayTxs = currentTxs.filter(t => {
        if (!t.date) return false;
        try {
          return getDay(parseISO(t.date)) === dayIndex && t.type === 'expense';
        } catch {
          return false;
        }
      });
      const amount = dayTxs.reduce((sum, t) => sum + (t.amount || 0), 0);
      return { name: dayStr, value: amount };
    });
    
    primaryChart = (
      <div className="h-[250px] w-full">
        <ResponsiveContainer>
          <BarChart data={weekData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
            <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis fontSize={12} tickLine={false} axisLine={false} width={80} tickFormatter={(value) => value === 0 ? '0원' : value >= 10000 ? `${value/10000}만원` : `${value.toLocaleString()}원`} />
            <RechartsTooltip 
               formatter={(val: number) => `₩${val.toLocaleString()}`}
               contentStyle={{ borderRadius: '12px', border: 'none', backgroundColor: 'var(--neo-bg)' }}
               cursor={{fill: 'rgba(0,0,0,0.05)'}}
            />
            <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  } else if (timeRange === '1m') {
    const sortedTxs = [...currentTxs].filter(t => t.type === 'expense').sort((a,b) => (a.date || '').localeCompare(b.date || ''));
    let acc = 0;
    const monthDataMap = new Map<string, { amount: number, cumulative: number }>();
    sortedTxs.forEach(t => {
       acc += (t.amount || 0);
       if(monthDataMap.has(t.date)) {
         monthDataMap.get(t.date)!.amount += (t.amount || 0);
         monthDataMap.get(t.date)!.cumulative = acc;
       } else {
         monthDataMap.set(t.date, { amount: (t.amount || 0), cumulative: acc });
       }
    });

    const monthData = Array.from(monthDataMap.entries()).map(([date, data]) => ({
      date: date.slice(5),
      amount: data.amount,
      cumulative: data.cumulative
    }));

    primaryChart = (
      <ResponsiveContainer width="100%" height={250}>
        <ComposedChart data={monthData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
          <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} minTickGap={20} />
          <YAxis fontSize={12} tickLine={false} axisLine={false} width={80} tickFormatter={(value) => value === 0 ? '0원' : value >= 10000 ? `${value/10000}만원` : `${value.toLocaleString()}원`} />
          <RechartsTooltip 
             formatter={(val: number) => `₩${val.toLocaleString()}`}
             contentStyle={{ borderRadius: '12px', border: 'none', backgroundColor: 'var(--neo-bg)' }}
          />
          <Bar dataKey="amount" fill="#3b82f6" opacity={0.5} radius={[2, 2, 0, 0]} name="일일 지출" stackId="a" />
          <Line type="monotone" dataKey="cumulative" stroke="#ff6b6b" strokeWidth={3} dot={false} name="누적 지출" />
        </ComposedChart>
      </ResponsiveContainer>
    );
  } else {
    const monthlyMap = new Map<string, { income: number, expense: number }>();
    let curr = prevEd;
    if (timeRange === '3m') curr = startOfMonth(subMonths(now, 2));
    else if (timeRange === '6m') curr = startOfMonth(subMonths(now, 5));
    else if (timeRange === '1y') curr = startOfMonth(subMonths(now, 11));
    else if (timeRange === 'all') {
      if (allTxs.length > 0) {
        const sorted = [...allTxs].sort((a,b) => (a.date || '').localeCompare(b.date || ''));
        curr = startOfMonth(parseISO(sorted[0].date));
      } else {
        curr = startOfMonth(now);
      }
    }

    let count = 0;
    while(curr <= ed) {
       const mId = format(curr, 'yyyy-MM');
       monthlyMap.set(mId, { income: 0, expense: 0 });
       curr = new Date(curr.getFullYear(), curr.getMonth() + 1, 1);
       if (count++ > 120) break; // Safety break: 10 years max
    }

    currentTxs.forEach(t => {
       const m = t.date.slice(0, 7);
       if(monthlyMap.has(m)) {
          const cur = monthlyMap.get(m)!;
          if (t.type === 'income') cur.income += t.amount;
          else cur.expense += t.amount;
       }
    });

    const monthsData = Array.from(monthlyMap.entries()).sort((a,b) => a[0].localeCompare(b[0])).map(([m, data]) => ({
       name: m.slice(5),
       수입: data.income,
       지출: data.expense,
       순수익: data.income - data.expense
    }));

    primaryChart = (
      <ResponsiveContainer width="100%" height={250}>
        <ComposedChart data={monthsData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
          <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis fontSize={12} tickLine={false} axisLine={false} width={80} tickFormatter={(value) => value === 0 ? '0원' : value >= 10000 ? `${value/10000}만원` : `${value.toLocaleString()}원`} />
          <RechartsTooltip 
             formatter={(val: number) => `₩${val.toLocaleString()}`}
             contentStyle={{ borderRadius: '12px', border: 'none', backgroundColor: 'var(--neo-bg)' }}
          />
          <Bar dataKey="수입" fill="#20c997" radius={[4, 4, 0, 0]} />
          <Bar dataKey="지출" fill="#ff6b6b" radius={[4, 4, 0, 0]} />
          <Line type="monotone" dataKey="순수익" stroke="#8b5cf6" strokeWidth={3} />
        </ComposedChart>
      </ResponsiveContainer>
    );
  }

  const netWorthTrendData = useMemo(() => {
    let historySd = new Date();
    if (timeRange === '1w' || timeRange === '1m') {
      historySd = startOfMonth(subMonths(now, 5));
    } else if (timeRange === '3m') {
      historySd = startOfMonth(subMonths(now, 2));
    } else if (timeRange === '6m') {
      historySd = startOfMonth(subMonths(now, 5));
    } else {
      historySd = startOfMonth(subMonths(now, 11));
    }
    
    const beforeTxs = allTxs.filter(t => t.date < format(historySd, 'yyyy-MM-dd'));
    let initialNW = beforeTxs.reduce((acc, t) => t.type === 'income' ? acc + (t.amount || 0) : acc - (t.amount || 0), 0);

    const monthlyData = [];
    let currStart = historySd;
    let safetyCount = 0;
    while(currStart <= now) {
      if (safetyCount++ > 120) break;
      const mStr = format(currStart, 'yyyy-MM');
      const mtxs = allTxs.filter(t => t.date && t.date.startsWith(mStr));
      let mNet = mtxs.reduce((acc, t) => t.type === 'income' ? acc + (t.amount || 0) : acc - (t.amount || 0), 0);
      initialNW += mNet;
      
      monthlyData.push({
         name: format(currStart, 'M월'),
         value: initialNW
      });
      
      currStart = new Date(currStart.getFullYear(), currStart.getMonth() + 1, 1);
    }
    return monthlyData;
  }, [allTxs, timeRange]);

  const paymentRate = 0;

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto mb-20 md:mb-0 animate-in fade-in">
      <div className="flex flex-col sm:flex-row gap-4 sm:justify-between sm:items-end">
         <div className="flex flex-col gap-4">
            <div>
               <h2 className="text-2xl font-bold tracking-tight text-foreground">
                  {isGroup ? '모임 회계 분석 및 통계' : '분석 리포트'}
               </h2>
               <p className="text-muted-foreground text-sm mt-1">
                  {timeRange === '1w' ? '주간 지출 리듬을 확인하세요.' : timeRange === '1m' ? '월간 예산 대비 사용량을 분석합니다.' : '장기적인 자산 흐름을 파악하세요.'}
               </p>
            </div>
            
            <div className="flex flex-col gap-2 w-full max-w-full">
               <div className="flex items-center gap-1 w-full pb-1 overflow-x-auto custom-scrollbar">
                  <div className="neo-inset p-0.5 rounded-xl flex items-center shrink-0 bg-background">
                    {[
                       { id: '1w', label: '주간' },
                       { id: '1m', label: '월간' },
                       { id: '3m', label: '3개월' },
                       { id: '6m', label: '반기' },
                       { id: '1y', label: '연간' },
                       { id: 'all', label: '전체' }
                    ].map((tr) => (
                      <button 
                        key={tr.id}
                        className={`flex-none px-3 py-1.5 text-xs whitespace-nowrap font-bold rounded-lg transition-all ${timeRange === tr.id ? 'bg-[#20c997] text-white shadow-[0_4px_14px_0_rgba(32,201,151,0.5)]' : 'text-muted-foreground hover:text-foreground'}`}
                        onClick={() => { setTimeRange(tr.id as any); setSelectedCategory('all'); }}
                      >
                        {tr.label}
                      </button>
                    ))}
                 </div>
                 
                 {!isGroup && (
                   <button
                     onClick={handleDownloadPDF}
                     disabled={isDownloading}
                     className="neo shrink-0 border border-brand-mint/50 text-brand-mint hover:bg-brand-mint/10 px-4 py-1.5 rounded-xl flex items-center justify-center gap-2 font-bold transition-all disabled:opacity-50 text-sm ml-auto"
                   >
                     {isDownloading ? <Activity className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                     <span className="hidden sm:inline">프리미엄 리포트 다운로드</span>
                     <span className="sm:hidden">다운로드</span>
                   </button>
                 )}
               </div>
               
               {availableCategories.length > 0 && (
                 <div className="neo-inset p-1 rounded-xl flex items-center overflow-x-auto shrink-0 snap-x custom-scrollbar pb-2">
                   <button 
                     className={`flex-none px-3 py-1.5 text-xs whitespace-nowrap font-bold rounded-lg transition-all snap-start ${selectedCategory === 'all' ? 'bg-primary/20 text-primary' : 'text-muted-foreground'}`}
                     onClick={() => setSelectedCategory('all')}
                   >전체 카테고리</button>
                   {availableCategories.map(cat => (
                     <button 
                       key={cat}
                       className={`flex-none px-3 py-1.5 text-xs whitespace-nowrap font-bold rounded-lg transition-all snap-start ${selectedCategory === cat ? 'bg-primary/20 text-primary' : 'text-muted-foreground'}`}
                       onClick={() => setSelectedCategory(cat)}
                     >
                       {cat}
                     </button>
                   ))}
                 </div>
               )}
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Main Balance / Net Worth */}
        <div className="col-span-1 sm:col-span-2 neo bg-card p-6 rounded-2xl relative overflow-hidden group shadow-lg">
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/20 transition-all duration-700" />
          <div className="flex justify-between items-start relative z-10 mb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-xs font-black uppercase tracking-wider opacity-80 text-muted-foreground">
                   순자산 (Net Worth)
                </p>
                <span className="text-[10px] bg-brand-mint/20 text-brand-mint px-2 py-0.5 rounded-full font-black shadow-sm ring-1 ring-brand-mint/20">
                  전체 {allTxs.length.toLocaleString()}건
                </span>
                <button 
                  onClick={() => window.location.reload()} 
                  className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors"
                  title="새로고침"
                >
                  <Activity className="w-3 h-3 text-muted-foreground" />
                </button>
              </div>
              <p className="text-3xl sm:text-4xl font-black tracking-tighter text-brand-mint drop-shadow-sm">
                ₩{netWorth.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-2 font-bold flex items-center gap-1">
                 <ArrowUpRight className="w-3 h-3 text-brand-mint" />
                 전체 누적 수입: ₩{totalIncomeAllTime.toLocaleString()}
              </p>
            </div>
            <div className="p-3 bg-brand-mint/10 rounded-2xl shadow-sm backdrop-blur-sm">
              <Wallet className="w-8 h-8 text-brand-mint" />
            </div>
          </div>
          
          <div className="relative z-10 w-full h-24 mt-2">
             <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={netWorthTrendData}>
                 <defs>
                   <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                     <stop offset="5%" stopColor="#20c997" stopOpacity={0.2}/>
                     <stop offset="95%" stopColor="#20c997" stopOpacity={0}/>
                   </linearGradient>
                 </defs>
                 <XAxis dataKey="name" hide />
                 <YAxis domain={['auto', 'auto']} hide />
                 <RechartsTooltip 
                   formatter={(val: number) => `₩${val.toLocaleString()}`}
                   contentStyle={{ borderRadius: '8px', border: 'none', backgroundColor: 'var(--background)', color: 'var(--foreground)', fontSize: '12px' }}
                   itemStyle={{ color: 'var(--brand-mint)' }}
                   cursor={{ stroke: '#20c997' }}
                 />
                 <Area type="monotone" dataKey="value" stroke="#20c997" strokeWidth={2} fillOpacity={1} fill="url(#colorValue)" />
               </AreaChart>
             </ResponsiveContainer>
          </div>
        </div>

        <div className="neo p-4 flex flex-col justify-center space-y-2 rounded-2xl relative overflow-hidden">
          <div className="flex items-center space-x-2 text-muted-foreground z-10 relative">
            <Calendar className="w-4 h-4" />
            <span className="text-xs font-bold">{timeRange === '1w' ? '이번 주 지출' : '해당 기간 지출'}</span>
          </div>
          <div className="flex flex-wrap items-end gap-2 z-10 relative">
             <p className="text-xl sm:text-2xl font-extrabold truncate">₩{expense.toLocaleString()}</p>
          </div>
          {timeRange === '1w' && (
             <div className="mt-1 z-10 relative">
                <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-full ${expenseChange > 0 ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'}`}>
                   {expenseChange > 0 ? '▲' : '▼'} {Math.abs(expenseChange)}% (전주 대비)
                </span>
             </div>
          )}
        </div>

        <div className="neo p-4 flex flex-col justify-center space-y-2 rounded-2xl">
          <div className="flex items-center space-x-2 text-muted-foreground">
            <Target className="w-4 h-4" />
            <span className="text-xs font-bold">{isGroup ? '기간 내 수입' : '저축률'}</span>
          </div>
          <p className="text-xl sm:text-2xl font-extrabold truncate text-brand-mint">
             {isGroup ? `₩${income.toLocaleString()}` : `${savingsRate}%`}
          </p>
          {!isGroup && (
             <p className="text-[10px] font-bold text-muted-foreground mt-1">수입: ₩{income.toLocaleString()}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
         <div className="xl:col-span-2 space-y-6 min-w-0">
            {/* Primary Trend Chart */}
            <div className="neo rounded-2xl p-4">
               <h3 className="text-base font-bold flex items-center space-x-2 mb-6">
                  <Activity className="w-5 h-5 text-primary" />
                  <span>
                     {timeRange === '1w' ? '주간 요일별 지출' : 
                      timeRange === '1m' ? '월간 지출 추이 (누적)' : '기간별 자산 흐름'}
                  </span>
               </h3>
               {primaryChart}
            </div>

            {/* Category Donut */}
            <div className="neo rounded-2xl p-4">
               <h3 className="text-base font-bold flex items-center space-x-2 mb-4">
                 <PieChartIcon className="w-5 h-5 text-primary" />
                 <span>카테고리별 지출</span>
               </h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center neo-inset rounded-xl p-4">
               {donutChartData.length > 0 ? (
                  <div className="h-56 w-full">
                     <ResponsiveContainer width="100%" height="100%">
                     <PieChart>
                        <Pie
                           data={donutChartData}
                           cx="50%"
                           cy="50%"
                           innerRadius="60%"
                           outerRadius="80%"
                           paddingAngle={4}
                           dataKey="value"
                           stroke="none"
                           cornerRadius={5}
                        >
                           {donutChartData.map((entry, index) => (
                           <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                           ))}
                        </Pie>
                        <RechartsTooltip 
                           formatter={(value: number) => `₩${value.toLocaleString()}`}
                           contentStyle={{ borderRadius: '12px', border: 'none', backgroundColor: 'var(--neo-bg)' }}
                        />
                     </PieChart>
                     </ResponsiveContainer>
                  </div>
               ) : (
                  <div className="h-56 flex items-center justify-center text-sm font-bold text-muted-foreground">
                     지출 내역이 없습니다
                  </div>
               )}
               
               <div className="space-y-4 max-h-56 overflow-y-auto pr-2 hide-scrollbar">
                  {donutChartData.map((item, index) => (
                     <div key={item.name} className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                           <div className="flex items-center space-x-3 min-w-0 pr-2">
                              <div className="w-3 h-3 shrink-0 rounded-full shadow-sm" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                              <span className="text-sm font-bold truncate">{item.name}</span>
                           </div>
                           <div className="flex flex-col items-end shrink-0">
                              <div className="text-sm font-bold">₩{item.value.toLocaleString()}</div>
                              <div className="text-[10px] text-muted-foreground font-bold">{Math.round((item.value / expense) * 100)}%</div>
                           </div>
                        </div>
                        <div className="w-full bg-black/5 dark:bg-white/10 rounded-full h-1.5 ml-6">
                           <div className="h-1.5 rounded-full transition-all" style={{ backgroundColor: COLORS[index % COLORS.length], width: `${(item.value / expense) * 100}%` }} />
                        </div>
                     </div>
                  ))}
               </div>
               </div>
            </div>
         </div>

         {/* Sidebar Stats & List */}
         <div className="space-y-6 min-w-0 flex flex-col h-full">
            {!isGroup ? (
               <>
               <div className="neo rounded-2xl p-5 border-t-4 border-t-brand-coral/80">
                  <h3 className="text-base font-bold flex items-center gap-2 mb-4">
                     <Target className="w-5 h-5 text-brand-coral" />
                     현금 흐름 예측
                  </h3>
                  <div>
                     <p className="text-2xl font-extrabold mb-1">₩{(netWorth + 1500000).toLocaleString()}</p>
                     <p className="text-xs text-muted-foreground font-medium text-balance">
                        다음 급여일 전까지 <strong>여유 자금</strong>이 충분할 것으로 예상됩니다.
                     </p>
                  </div>
               </div>
               <div className="neo rounded-2xl p-5 border-t-4 border-t-indigo-500">
                  <h3 className="text-base font-bold flex items-center gap-2 mb-4">
                     <Target className="w-5 h-5 text-indigo-500" />
                     미래 목표 관리
                  </h3>
                  <div className="space-y-6">
                     {goals.map(goal => (
                        <div key={goal.id}>
                           <div className="flex justify-between items-end mb-2">
                              <div>
                                 <p className="text-sm font-bold">{goal.name}</p>
                                 <p className="text-[10px] text-muted-foreground mt-0.5">목표 진행률: {goal.targetAmount > 0 ? Math.round((goal.currentAmount / goal.targetAmount) * 100) : 0}%</p>
                              </div>
                              <p className="text-sm font-black text-indigo-600 dark:text-indigo-400">₩{goal.targetAmount.toLocaleString()}</p>
                           </div>
                           <div className="w-full bg-black/5 dark:bg-white/10 rounded-full h-2">
                              <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${goal.targetAmount > 0 ? Math.min(100, (goal.currentAmount / goal.targetAmount) * 100) : 0}%` }} />
                           </div>
                        </div>
                     ))}
                     <div className="text-xs text-muted-foreground italic">새로운 목표를 추가하려면 설정을 확인하세요.</div>
                  </div>
               </div>
               </>
            ) : (
               <div className="neo rounded-2xl p-5 border-t-4 border-t-green-500">
                  <h3 className="text-base font-bold flex items-center gap-2 mb-4">
                     <Users className="w-5 h-5 text-green-500" />
                     모임 회원 납부 통계
                  </h3>
                  <div className="space-y-4">
                     <div className="flex justify-between items-center pb-4 border-b border-black/5 dark:border-white/5">
                        <span className="text-sm font-bold text-muted-foreground">누적 납부율</span>
                        <span className="text-2xl font-black text-green-600">{paymentRate}%</span>
                     </div>
                     <div>
                        <p className="text-xs font-bold text-muted-foreground mb-2 flex items-center gap-1">
                           <CheckCircle2 className="w-3 h-3 text-brand-coral" />
                           미납자 알림 (예상)
                        </p>
                        <div className="text-sm font-medium bg-secondary/50 p-3 text-center rounded-xl text-muted-foreground">
                           진행 중인 청구 내역에서 미납 건을 확인하세요.
                        </div>
                     </div>
                  </div>
               </div>
            )}

            {/* --- 추가된 기능: 대시보드 실시간 검색창 & 빈 상태 UI --- */}
            <div className="neo rounded-2xl p-5 flex-1 max-h-[500px] flex flex-col hide-scrollbar">
               <div className="sticky top-0 bg-background/90 backdrop-blur-md pb-4 z-10 space-y-4">
                  <h3 className="text-base font-bold">해당 기간 최근 내역</h3>
                  
                  {/* 검색창 */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="내역이나 카테고리로 검색..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-10 py-2.5 rounded-xl text-sm bg-black/5 dark:bg-white/5 border border-transparent focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all text-foreground placeholder:text-muted-foreground"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10"
                      >
                        <X className="w-4 h-4 text-muted-foreground" />
                      </button>
                    )}
                  </div>
               </div>

               <div className="overflow-y-auto hide-scrollbar flex-1 pb-2">
                  {loading ? (
                     <div className="text-center py-4 text-muted-foreground font-bold text-sm">불러오는 중...</div>
                  ) : error ? (
                     <div className="text-center py-8 text-brand-coral font-bold text-sm">
                        <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        {error}
                        <button 
                          onClick={() => window.location.reload()}
                          className="block mt-4 mx-auto text-xs font-bold bg-brand-coral/10 py-1.5 px-3 rounded-full hover:bg-brand-coral/20"
                        >
                          새로고침
                        </button>
                     </div>
                  ) : allTxs.length === 0 ? (
                     <div className="text-center py-12 px-6 bg-black/5 rounded-2xl border border-dashed border-black/10">
                        <Inbox className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-30" />
                        <p className="font-bold text-muted-foreground mb-2">내역이 없습니다.</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          데이터가 보이지 않는다면 설정의 <b>'데이터 진단 및 복구'</b> 도구를 사용해 보세요.
                        </p>
                        <Button 
                          onClick={() => navigate('/settings')}
                          variant="outline"
                          className="mt-6 text-xs font-bold px-6 rounded-full border-primary/20 text-primary"
                        >
                          데이터 복구하러 가기
                        </Button>
                     </div>
                  ) : filteredTxs.length === 0 ? (
                     <div className="text-center py-12 px-6">
                        <Search className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-30" />
                        <p className="font-bold text-muted-foreground">검색 결과가 없습니다.</p>
                        <button onClick={() => setSearchQuery('')} className="text-xs font-bold text-primary mt-2">검색어 초기화</button>
                     </div>
                  ) : filteredTxs.length > 0 ? (
                     <div className="space-y-3">
                        {filteredTxs.slice(0, 30).map(tx => (
                        <div key={tx.id} onClick={() => setSelectedTransaction(tx as any)} className="flex items-center justify-between group p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-colors cursor-pointer">
                           <div className="flex items-center space-x-3">
                              <div className={`p-2 rounded-lg neo-inset text-brand-mint`}>
                                {tx.type === 'income' ? <ArrowDownRight className="w-4 h-4" /> : <CategoryIcon category={tx.category} className="w-4 h-4" />}
                              </div>
                              <div>
                              <p className="font-bold text-sm truncate max-w-[140px]">{tx.description || tx.category}</p>
                              <p className="text-[10px] text-muted-foreground font-bold">
                                 {tx.date.slice(5)} • {tx.category}
                              </p>
                              </div>
                           </div>
                           <div className="flex items-center space-x-2">
                              <span className={`text-sm font-bold ${tx.type === 'income' ? 'text-brand-mint' : ''}`}>
                              {tx.type === 'income' ? '+' : '-'}₩{(tx.amount || 0).toLocaleString()}
                              </span>
                              <button 
                                onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleDelete(tx.id); }} 
                                className="p-3 rounded-full text-muted-foreground hover:text-brand-coral hover:bg-brand-coral/10 transition-all opacity-60 hover:opacity-100"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                           </div>
                        </div>
                        ))}
                     </div>
                  ) : (
                     // 빈 상태 UI (Empty State)
                     <div className="flex flex-col items-center justify-center py-12 text-muted-foreground opacity-80">
                       <Inbox className="w-12 h-12 mb-4 opacity-30 text-primary" />
                       <p className="text-sm font-bold">
                         {searchQuery ? `'${searchQuery}' 검색 결과가 없습니다.` : "해당 기간에 조회된 내역이 없습니다."}
                       </p>
                       <p className="text-xs mt-2 opacity-60">
                         만약 데이터가 보이지 않는다면 상단의 '개인/모임' 모드를 확인해 보세요.
                       </p>
                       {searchQuery && (
                         <button 
                           onClick={() => setSearchQuery('')}
                           className="mt-4 text-xs font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-full hover:bg-primary/20 transition-colors"
                         >
                           검색어 초기화
                         </button>
                       )}
                     </div>
                  )}
               </div>
            </div>
         </div>
      </div>
      
      {/* Hidden Premium Report Generation Area */}
      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
        <div 
          id="pdf-report-container"
          ref={reportRef} 
          className="bg-white text-black p-10 w-[794px] min-h-[1123px] box-border border"
          style={{ fontFamily: "'Inter', 'Noto Sans KR', sans-serif" }}
        >
          <div className="flex flex-col h-full gap-8">
            {/* Header */}
          <div className="border-b-4 border-primary pb-6 flex justify-between items-end">
            <div>
              <h1 className="text-4xl font-extrabold text-primary mb-2">프리미엄 금융 리포트</h1>
              <p className="text-gray-500 font-medium">{user?.displayName || '회원'}님의 맞춤형 자산 분석</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold bg-primary/10 text-primary px-3 py-1 rounded-lg">
                재무 건강 점수: <span className="text-2xl">{Math.min(100, Math.max(0, savingsRate + 20))}점</span>
              </p>
              <p className="text-sm text-gray-400 mt-2">{format(new Date(), 'yyyy년 MM월 dd일')} 기준</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8">
            {/* 자산 요약 */}
            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Wallet className="w-5 h-5 text-primary" /> 순자산 요약
              </h2>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-500 font-medium">현재 순 자산 (총 수익 - 총 지출)</p>
                  <p className="text-3xl font-black text-gray-900">₩{netWorth.toLocaleString()}</p>
                </div>
                <div className="pt-4 border-t border-gray-200">
                  <p className="text-sm text-gray-500 font-medium mb-1">
                    최근 조회 기간 ({timeRange === '1w' ? '주간' : timeRange === '1m' ? '월간' : timeRange === '3m' ? '3개월' : timeRange === '6m' ? '반기' : '연간'})
                  </p>
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-xs text-green-600">수입: ₩{income.toLocaleString()}</p>
                      <p className="text-xs text-red-500">지출: ₩{expense.toLocaleString()}</p>
                    </div>
                    <p className="text-lg font-bold text-brand-mint">저축률 {savingsRate}%</p>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Insight */}
            <div className="bg-primary/5 rounded-2xl p-6 border border-primary/20">
              <h2 className="text-xl font-bold text-primary mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5" /> AI 재무 조언
              </h2>
              <ul className="space-y-3">
                {insights.length > 0 ? insights.map((insight, i) => (
                  <li key={i} className="flex gap-2 text-gray-700 text-sm font-medium leading-relaxed">
                    <span className="text-primary mt-1">•</span> {insight}
                  </li>
                )) : (
                  <li className="text-gray-500 text-sm">최근 충분한 데이터가 모이지 않아 조언을 생성하기 어렵습니다. 앞으로 꾸준히 내역을 추가해주세요!</li>
                )}
                {savingsRate > 50 ? (
                  <li className="flex gap-2 text-gray-700 text-sm font-medium leading-relaxed">
                    <span className="text-primary mt-1">•</span> 저축률이 매우 훌륭합니다. 이 자금을 활용해 공격적인 투자보다 안정적인 배당주를 고려해보세요.
                  </li>
                ) : (
                  <li className="flex gap-2 text-gray-700 text-sm font-medium leading-relaxed">
                    <span className="text-primary mt-1">•</span> 현재 저축보다 소비가 많거나 비슷합니다. 고정 지출 중 불필요한 구독이 있는지 점검해보세요.
                  </li>
                )}
              </ul>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8">
            {/* Top 5 Categories */}
            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <PieChartIcon className="w-5 h-5 text-indigo-500" /> 지출 카테고리 Top 5
              </h2>
              <div className="space-y-4 mt-6">
                {donutChartData.slice(0, 5).map((item, index) => (
                  <div key={item.name} className="flex flex-col gap-1">
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-bold text-gray-700">{index + 1}. {item.name}</span>
                      <span className="text-gray-900 font-bold">₩{item.value.toLocaleString()} ({Math.round((item.value / expense) * 100)}%)</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className="h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length], width: `${Math.min(100, (item.value / expense) * 100)}%` }} />
                    </div>
                  </div>
                ))}
                {donutChartData.length === 0 && (
                  <p className="text-sm text-gray-400 py-4 text-center">지출 데이터가 없습니다.</p>
                )}
              </div>
            </div>

            {/* Goal Progress */}
            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-brand-coral" /> 주요 목표 진행 상황
              </h2>
              <div className="space-y-6 mt-4">
                <div>
                   <div className="flex justify-between items-end mb-2">
                      <div>
                         <p className="text-sm font-bold text-gray-800">오사카 여행 자금 ✈️</p>
                         <p className="text-xs text-gray-500 mt-0.5">목표 진행률: 60%</p>
                      </div>
                      <p className="text-sm font-black text-indigo-600">₩1,200,000</p>
                   </div>
                   <div className="w-full bg-gray-100 rounded-full h-2.5">
                      <div className="bg-indigo-500 h-2.5 rounded-full" style={{ width: '60%' }} />
                   </div>
                </div>
                <div>
                   <div className="flex justify-between items-end mb-2">
                      <div>
                         <p className="text-sm font-bold text-gray-800">비상금 (파킹통장)</p>
                         <p className="text-xs text-gray-500 mt-0.5">목표 진행률: 90%</p>
                      </div>
                      <p className="text-sm font-black text-brand-mint">₩9,000,000</p>
                   </div>
                   <div className="w-full bg-gray-100 rounded-full h-2.5">
                      <div className="bg-brand-mint h-2.5 rounded-full" style={{ width: '90%' }} />
                   </div>
                </div>
                <div>
                   <div className="flex justify-between items-end mb-2">
                      <div>
                         <p className="text-sm font-bold text-gray-800">첫 차 구매금</p>
                         <p className="text-xs text-gray-500 mt-0.5">목표 진행률: 15%</p>
                      </div>
                      <p className="text-sm font-black text-brand-coral">₩3,500,000</p>
                   </div>
                   <div className="w-full bg-gray-100 rounded-full h-2.5">
                      <div className="bg-brand-coral h-2.5 rounded-full" style={{ width: '15%' }} />
                   </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 bg-gray-50 p-6 rounded-2xl border border-gray-200">
            <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-yellow-500" /> 총평
            </h3>
            <p className="text-gray-600 text-sm leading-8 font-medium">
              현재 재무 상태는 <strong>비교적 안정적</strong>입니다. 순자산 흐름이 긍정적인 방향으로 나아가고 있으며, 지정된 라이프 이벤트에 대비하기 위해 꾸준한 저축이 병행되고 있습니다. 다만 상위 지출 카테고리에서 소비성 지출 비율이 다소 높다면 이를 관리하여 목표 도달 시기를 한층 더 앞당길 수 있습니다. 지속적인 모니터링을 권장합니다.
            </p>
          </div>
          
          <div className="mt-auto text-center pt-8 border-t border-gray-100 pb-4">
             <p className="text-xl font-black text-gray-300 italic">Financial AI Studio</p>
          </div>
        </div>
        </div>
      </div>

      <Dialog open={!!selectedTransaction} onOpenChange={(open) => !open && setSelectedTransaction(null)}>
        <DialogContent className="sm:max-w-md neo rounded-2xl border-none">
           <DialogHeader>
             <DialogTitle className="text-xl font-bold">내역 상세 보기</DialogTitle>
           </DialogHeader>
           {selectedTransaction && (
             <div className="space-y-4 py-4">
                <div className="flex items-center justify-between pb-4 border-b border-black/5 dark:border-white/5">
                   <div className="space-y-1">
                      <p className="text-xs font-bold text-muted-foreground">금액</p>
                      <p className={`text-2xl font-black ${selectedTransaction.type === 'income' ? 'text-brand-mint' : 'text-foreground'}`}>
                         {selectedTransaction.type === 'income' ? '+' : '-'}₩{(selectedTransaction.amount || 0).toLocaleString()}
                      </p>
                   </div>
                   <div className={`p-3 rounded-2xl neo-inset ${selectedTransaction.type === 'income' ? 'text-brand-mint' : 'text-primary'}`}>
                      {selectedTransaction.type === 'income' ? <ArrowDownRight className="w-6 h-6" /> : <CategoryIcon category={selectedTransaction.category} className="w-6 h-6" />}
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-1">
                      <p className="text-xs font-bold text-muted-foreground">날짜</p>
                      <p className="text-sm font-bold">{selectedTransaction.date}</p>
                   </div>
                   <div className="space-y-1">
                      <p className="text-xs font-bold text-muted-foreground">카테고리</p>
                      <p className="text-sm font-bold">{selectedTransaction.category}</p>
                   </div>
                   <div className="space-y-1 col-span-2">
                      <p className="text-xs font-bold text-muted-foreground">내용 / 사용처</p>
                      <p className="text-sm font-bold">{selectedTransaction.description || '-'}</p>
                   </div>
                   {selectedTransaction.type === 'expense' && selectedTransaction.paymentMethod && (
                     <div className="space-y-1 col-span-2">
                        <p className="text-xs font-bold text-muted-foreground">결제 수단</p>
                        <p className="text-sm font-bold">{selectedTransaction.paymentMethod}</p>
                     </div>
                   )}
                </div>
             </div>
           )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
