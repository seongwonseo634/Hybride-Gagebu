import React, { useState, useMemo, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subMonths, startOfYear, endOfYear, subWeeks } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, AreaChart, Area, ComposedChart, Legend } from 'recharts';
import { Target, Download, Sparkles, AlertCircle, Users, CheckCircle2, Calendar, Lightbulb, PieChart as PieChartIcon, ArrowRight, Bell, Trophy, ShieldAlert, CreditCard, ShoppingCart, Landmark, TrendingUp, BellRing, Trash2, CircleHelp } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import domtoimage from 'dom-to-image-more';
import { jsPDF } from 'jspdf';
import { collection, query, where, getDocs, orderBy, onSnapshot, doc, setDoc, deleteDoc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { PersonalTransaction } from '../types';

export default function ReportPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<PersonalTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<string>('');
  const [translatedAdvice, setTranslatedAdvice] = useState<string>('');
  const [userQuestion, setUserQuestion] = useState<string>('');
  
  const [timeRange, setTimeRange] = useState<'1w' | '1m' | '3m' | '6m' | '1y' | 'all'>(() => {
    return (localStorage.getItem('dashboard-timerange') as any) || '3m';
  });

  const [budgets, setBudgets] = useState<any[]>([]);
  const [tempBudgets, setTempBudgets] = useState<any[]>([]);
  
  const [assets, setAssets] = useState<any[]>([]);
  const [tempAssets, setTempAssets] = useState<any[]>([]);
  
  const [challenges, setChallenges] = useState<any[]>([]);
  const [challengeTitle, setChallengeTitle] = useState('');
  
  const [recurringPayments, setRecurringPayments] = useState<any[]>([]);

  useEffect(() => {
    localStorage.setItem('dashboard-timerange', timeRange);
  }, [timeRange]);

  // Data Fetching: Transactions
  useEffect(() => {
    if (!user) return;

    const q = query(
        collection(db, `users/${user.uid}/transactions`),
        orderBy('date', 'desc')
    );

    setLoading(true);
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const data: PersonalTransaction[] = [];
        snapshot.forEach((doc) => {
            const d = doc.data() as any;
            const dateVal = d.date || new Date().toISOString().split('T')[0];
            data.push({ id: doc.id, ...d, date: dateVal } as PersonalTransaction);
        });
        setTransactions(data);
        setLoading(false);
    }, (error) => {
        console.error("Report Snapshot Error:", error);
        handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/transactions`);
        setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Data Fetching: Preferences (Budgets, Assets etc)
  useEffect(() => {
    if (!user) return;
    const path = `users/${user.uid}`;
    
    // Budgets
    const unsubBudgets = onSnapshot(collection(db, `${path}/budgets`), (snap) => {
      setBudgets(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.SYNC, `${path}/budgets`);
    });

    // Assets
    const unsubAssets = onSnapshot(collection(db, `${path}/assets`), (snap) => {
      setAssets(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.SYNC, `${path}/assets`);
    });

    // Challenges
    const qChallenges = query(collection(db, `${path}/challenges`), orderBy('createdAt', 'desc'));
    const unsubChallenges = onSnapshot(qChallenges, (snap) => {
      setChallenges(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.SYNC, `${path}/challenges`);
    });

    // Recurring Payments
    const unsubRecurring = onSnapshot(collection(db, `${path}/recurring`), (snap) => {
      setRecurringPayments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.SYNC, `${path}/recurring`);
    });

    return () => {
      unsubBudgets();
      unsubAssets();
      unsubChallenges();
      unsubRecurring();
    };
  }, [user]);

  const saveBudgets = async (newBudgets: any[]) => {
    if (!user) return;
    const path = `users/${user.uid}`;
    try {
      for (const b of newBudgets) {
        await setDoc(doc(db, `${path}/budgets`, b.id), b);
      }
      toast.success('예산이 저장되었습니다.');
    } catch (e) {
      toast.error('예산 저장 실패');
    }
  };

  const saveAssets = async (newAssets: any[]) => {
    if (!user) return;
    const path = `users/${user.uid}`;
    try {
      // Find deleted assets
      const existingIds = assets.map(a => a.id);
      const newIds = newAssets.map(a => a.id);
      const toDelete = existingIds.filter(id => !newIds.includes(id));
      for (const id of toDelete) await deleteDoc(doc(db, `${path}/assets`, id));

      for (const a of newAssets) {
        await setDoc(doc(db, `${path}/assets`, a.id), a);
      }
      toast.success('자산 정보가 저장되었습니다.');
    } catch (e) {
      toast.error('자산 저장 실패');
    }
  };

  const saveChallenge = async (title: string) => {
    if (!user || !title) return;
    const path = `users/${user.uid}`;
    try {
      await addDoc(collection(db, `${path}/challenges`), {
        title,
        desc: '새로운 목표를 달성할 때까지 화이팅!',
        icon: 'target',
        createdAt: serverTimestamp()
      });
      toast.success('도전 과제가 등록되었습니다!');
    } catch (e) {
      toast.error('과제 등록 실패');
    }
  };

  const activeBudgets = useMemo(() => {
    // Current month transactions for budget calculation
    const now = new Date();
    const sm = startOfMonth(now);
    const em = endOfMonth(now);
    const smStr = format(sm, 'yyyy-MM-dd');
    const emStr = format(em, 'yyyy-MM-dd');
    const currentMonthExpenses = transactions.filter(t => t.type === 'expense' && t.date >= smStr && t.date <= emStr);

    return budgets.map(b => {
        const spent = currentMonthExpenses
          .filter(t => t.category === b.category)
          .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
        return { ...b, spent: spent / 10000 }; 
    });
  }, [budgets, transactions]);

  const toggleNotification = async (item: any) => {
    if (!user) return;
    const path = `users/${user.uid}`;
    try {
      await updateDoc(doc(db, `${path}/recurring`, item.id), {
        isNotified: !item.isNotified
      });
      toast.success('알림 설정이 변경되었습니다.');
    } catch (e) {
      toast.error('알림 설정 변경 실패');
    }
  };

  // AI Advice Generator
  const requestAiAdvice = async (question?: string) => {
    if (filteredTransactions.length === 0) {
      toast.info('분석할 데이터가 부족합니다. 내역을 먼저 추가해 주세요!');
      return;
    }
    setIsAiLoading(true);
    setTranslatedAdvice(''); // Clear previous translation
    toast.info('AI 분석 중입니다...');
    try {
      // Call modern server API
      const response = await fetch('/api/ai/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          transactions: filteredTransactions.slice(0, 50), 
          assets,
          budgets,
          question: question || userQuestion
        })
      });
      const data = await response.json();
      if (response.ok) {
        setAiAdvice(data.advice || '분석 결과를 가져오지 못했습니다.');
        
        // If this was a specific question, clear the input
        if (question) setUserQuestion('');
      } else {
        if (response.status === 429) {
          setAiAdvice("⛔ AI 서비스 월간 사용량이 초과되었습니다.\n\nAI Studio(ai.studio) 설정에서 월간 사용 한도(Spending Cap)를 조정하시면 즉시 다시 이용하실 수 있습니다.\n\n💡 조언 기능 외에 다른 모든 가계부 기능은 정상적으로 이용 가능합니다.");
        } else {
          setAiAdvice(`AI 분석에 실패했습니다: ${data.error || '알 수 없는 오류'}`);
        }
      }
    } catch (e) {
      toast.error('AI 분석 중 오류가 발생했습니다.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const requestTranslation = async (targetLanguage: string) => {
    if (!aiAdvice) return;
    setIsAiLoading(true);
    toast.info('번역 중입니다...');
    try {
        const response = await fetch('/api/ai/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                text: aiAdvice,
                targetLanguage
            })
        });
        const data = await response.json();
        if (response.ok) {
            setTranslatedAdvice(data.translatedText);
        } else {
            toast.error('번역에 실패했습니다.');
        }
    } catch (e) {
        toast.error('번역 중 오류가 발생했습니다.');
    } finally {
        setIsAiLoading(false);
    }
  };

  const deleteChallenge = async (id: string) => {
    if (!user) return;
    const path = `users/${user.uid}`;
    try {
      await deleteDoc(doc(db, `${path}/challenges`, id));
      toast.success('도전 과제가 삭제되었습니다.');
    } catch (e) {
      toast.error('삭제 실패');
    }
  };

  const filteredTransactions = useMemo(() => {
    if (timeRange === 'all') return transactions;
    
    const now = new Date();
    let sd = new Date(), ed = new Date();
    switch (timeRange) {
      case '1w':
        sd = startOfWeek(now, { weekStartsOn: 1 });
        ed = endOfWeek(now, { weekStartsOn: 1 });
        break;
      case '1m':
        sd = startOfMonth(now);
        ed = endOfMonth(now);
        break;
      case '3m':
        sd = startOfMonth(subMonths(now, 2));
        ed = endOfMonth(now);
        break;
      case '6m':
        sd = startOfMonth(subMonths(now, 5));
        ed = endOfMonth(now);
        break;
      case '1y':
        sd = startOfYear(now);
        ed = endOfYear(now);
        break;
    }
    const startDateStr = format(sd, 'yyyy-MM-dd');
    const endDateStr = format(ed, 'yyyy-MM-dd');

    return transactions.filter(t => t.date >= startDateStr && t.date <= endDateStr);
  }, [transactions, timeRange]);

  const expenseCategoryData = useMemo(() => {
    if (!filteredTransactions.length) return [];
    
    const expenses = filteredTransactions.filter(t => t.type === 'expense');
    const grouped = expenses.reduce((acc, t) => {
        const cat = t.category || '기타';
        const amount = Number(t.amount) || 0;
        acc[cat] = (acc[cat] || 0) + amount;
        return acc;
    }, {} as Record<string, number>);

    return Object.entries(grouped).map(([name, value], index) => ({
        name,
        value,
        color: ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#d946ef'][index % 8]
    }));
  }, [filteredTransactions]);
  
  const trendData = useMemo(() => {
    const data = [];
    const now = new Date();
    // Decide trend range based on timeRange
    let monthsToShow = 12;
    if (timeRange === '3m') monthsToShow = 3;
    if (timeRange === '6m') monthsToShow = 6;
    if (timeRange === '1y') monthsToShow = 12;
    if (timeRange === 'all') monthsToShow = 12; // default to 12 for all

    for (let i = monthsToShow - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthLabel = `${d.getMonth() + 1}월`;
        const yearMonth = format(d, 'yyyy-MM');

        const monthTransactions = transactions.filter(t => {
            if (!t.date) return false;
            const tDateParts = t.date.split('-');
            const yearMonthParts = yearMonth.split('-');
            return tDateParts[0] === yearMonthParts[0] && 
                   (tDateParts[1]?.padStart(2, '0') === yearMonthParts[1]);
        });

        const income = monthTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
        const expense = monthTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + (Number(t.amount) || 0), 0);

        data.push({ name: monthLabel, 수입: income, 지출: expense });
    }
    return data;
  }, [transactions, timeRange]);

  const [budgetOpen, setBudgetOpen] = useState(false);
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [assetOpen, setAssetOpen] = useState(false);
  const componentRef = React.useRef<HTMLDivElement>(null);
  
  const handlePdfExport = async () => {
    const element = componentRef.current;
    if (!element) {
        toast.error('리포트 내용을 불러올 수 없습니다.');
        return;
    }
    
    toast.info('PDF를 생성하는 중입니다... (10~20초 소요될 수 있습니다)');
    
    try {
        const dataUrl = await domtoimage.toPng(element, {
            quality: 1,
            bgcolor: document.documentElement.classList.contains('dark') ? '#020617' : '#ffffff',
            filter: (node) => {
                if (node instanceof HTMLElement) {
                    if (node.hasAttribute('data-html2canvas-ignore') || 
                        node.classList.contains('pdf-ignore') ||
                        node.id === 'back-btn') {
                        return false;
                    }
                }
                return true;
            },
            style: {
                transform: 'scale(1)',
                transformOrigin: 'top left'
            }
        });
        
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth(); // typically 210
        const pdfHeightLimit = pdf.internal.pageSize.getHeight(); // typically 297
        
        const imgWidth = pdfWidth;
        const imgHeight = (element.offsetHeight * pdfWidth) / element.offsetWidth;
        
        let heightLeft = imgHeight;
        let position = 0;
        
        // Add the first page
        pdf.addImage(dataUrl, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeightLimit;
        
        // Continue adding pages for overflowing content
        while (heightLeft > 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(dataUrl, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pdfHeightLimit;
        }
        
        pdf.save('가계부_종합리포트.pdf');
        
        toast.success('✨ 프리미엄 보고서가 성공적으로 다운로드 되었습니다!');
    } catch (error: any) {
        console.error("PDF generation error: ", error);
        toast.error("브라우저 제한으로 PDF 생성에 실패했습니다. 새 탭에서 열어 시도해주세요.");
    }
  };
  
  const EXPENSE_CATEGORIES = ['식비', '교통/차량', '쇼핑/뷰티', '문화/여가', '건강/운동', '공과금/요금', '주거/통신', '교육', '경조사'];
  
  const totalAssets = useMemo(() => assets.reduce((acc, a) => acc + (Number(a.value) || 0), 0), [assets]);
  const [inviteLink, setInviteLink] = useState('');

  // Recurring Payments Inference
  const inferredRecurringPayments = useMemo(() => {
    if (recurringPayments.length > 0) return recurringPayments;
    
    // Keywords for obvious recurring payments
    const recurringKeywords = [
      { key: '넷플릭스', name: 'Netflix', icon: '🎬' },
      { key: 'netflix', name: 'Netflix', icon: '🎬' },
      { key: '유튜브', name: 'YouTube Premium', icon: '📺' },
      { key: 'youtube', name: 'YouTube Premium', icon: '📺' },
      { key: 'skt', name: 'SKT 통신비', icon: '📱' },
      { key: 'kt', name: 'KT 통신비', icon: '📱' },
      { key: 'lg u', name: 'LGU+ 통신비', icon: '📱' },
      { key: '보험', name: '보험료', icon: '🛡️' },
      { key: '아파트', name: '관리비', icon: '🏠' },
      { key: '도시가스', name: '가스요금', icon: '🔥' },
      { key: '전기', name: '전기요금', icon: '💡' },
      { key: '쿠팡', name: '쿠팡 와우', icon: '📦' }
    ];

    const inferred: any[] = [];
    const now = new Date();
    const todayDay = now.getDate();
    
    // Helper to check if a day is within 3 days (imminent)
    const isImminent = (payDay: number) => {
        if (!payDay) return false;
        const diff = payDay - todayDay;
        // If it's within 3 days from now, OR if it passed recently (e.g. today or yesterday)
        return (diff >= 0 && diff <= 3);
    };

    // 1. Keyword based match
    recurringKeywords.forEach(rk => {
      const foundTxs = transactions.filter(t => 
        t.type === 'expense' && 
        (t.description?.toLowerCase().includes(rk.key) || t.merchant?.toLowerCase().includes(rk.key))
      ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      if (foundTxs.length > 0) {
        const lastTx = foundTxs[0];
        const payDay = new Date(lastTx.date).getDate();
        inferred.push({
          id: `keyword-${rk.name}`,
          name: rk.name,
          amount: Math.round(Number(lastTx.amount)),
          icon: rk.icon,
          date: `매월 ${payDay}일`,
          payDay,
          isNotified: isImminent(payDay),
          isInferred: true
        });
      }
    });

    // 2. Pattern based match
    const matchedNames = new Set(inferred.map(i => i.name.toLowerCase()));
    const merchants = transactions
      .filter(t => t.type === 'expense')
      .reduce((acc, t) => {
          const key = (t.merchant || t.description || '').replace(/[0-9]/g, '').trim();
          if (!key || key.length < 2) return acc;
          if (matchedNames.has(key.toLowerCase())) return acc;
          if (!acc[key]) acc[key] = [];
          acc[key].push(t);
          return acc;
      }, {} as Record<string, PersonalTransaction[]>);

    (Object.entries(merchants) as [string, PersonalTransaction[]][]).forEach(([name, txs]) => {
      if (txs.length >= 2) {
        const sorted = [...txs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const intervals: number[] = [];
        for (let i = 1; i < sorted.length; i++) {
            const diffDays = Math.round((new Date(sorted[i].date).getTime() - new Date(sorted[i-1].date).getTime()) / (1000 * 60 * 60 * 24));
            intervals.push(diffDays);
        }
        
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const avgAmount = txs.reduce((sum, t) => sum + (Number(t.amount) || 0), 0) / txs.length;
        const isMonthlyPattern = avgInterval >= 25 && avgInterval <= 31; // Strictly once a month approx
        const similarAmounts = txs.every(t => Math.abs((Number(t.amount) || 0) - avgAmount) < avgAmount * 0.15);
        
        if (isMonthlyPattern && similarAmounts) {
          const payDay = new Date(sorted[sorted.length-1].date).getDate();
          if (inferred.length < 5) { // User said it's too long, limit list
            inferred.push({
              id: `inferred-${name}`,
              name,
              amount: Math.round(avgAmount),
              icon: '🔄',
              date: `매월 ${payDay}일경 결제`,
              payDay,
              isNotified: isImminent(payDay),
              isInferred: true
            });
          }
        }
      }
    });
    return inferred.slice(0, 5); // Limit length
  }, [transactions, recurringPayments]);

  const totalInferredAssetsValue = useMemo(() => {
    if (assets.length > 0) return totalAssets;
    // If no assets, use cumulative net balance as an estimate
    const income = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
    return income - expense;
  }, [transactions, assets, totalAssets]);

  const handleShareFamily = () => {
    const inviteUrl = `${window.location.origin}/#/groups`;
    setInviteLink(inviteUrl);
    
    if (navigator.clipboard) {
      navigator.clipboard.writeText(`우리가족 자산 공유 모임에 초대합니다!\n${inviteUrl}`)
        .then(() => toast.success('가족 초대 링크가 성공적으로 복사되었습니다. 카카오톡 등으로 공유해보세요!'))
        .catch(err => toast.error('복사 기능이 브라우저에 의해 차단되었습니다. 아래에 생성된 링크를 직접 복사해주세요.'));
    } else {
      toast.info('복사 기능이 제한되었습니다. 아래 텍스트 상자의 링크를 수동으로 복사해주세요.', { duration: 5000 });
    }
  };

  return (
    <div ref={componentRef} id="report-content" className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto mb-20 md:mb-0 animate-in fade-in">
       <Button onClick={() => navigate('/')} variant="ghost" className="text-sm font-bold text-emerald-600 mb-2" data-html2canvas-ignore>
           &lt;- 이전으로
       </Button>
      {transactions.length === 0 && !loading && (
        <div className="neo p-8 rounded-2xl bg-secondary/10 border border-dashed border-primary/20 text-center space-y-4">
          <div className="flex justify-center flex-col items-center gap-2">
            <Bell className="w-10 h-10 text-primary opacity-30" />
          </div>
          <h4 className="font-extrabold text-lg">데이터가 없습니다</h4>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-xs mx-auto">
            내역이 보이지 않는다면 설정에서 '데이터 정밀 진단'을 눌러 복구하거나 CSV 파일을 다시 업로드해 보세요.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <Button size="sm" variant="outline" className="h-9 px-4 font-bold" onClick={() => navigate('/settings')}>데이터 진단</Button>
            <Button size="sm" variant="default" className="h-9 px-4 font-bold" onClick={() => navigate('/input')}>새 내역 추가</Button>
          </div>
        </div>
      )}
      {transactions.length > 0 && transactions.length < 5 && !loading && (
        <div className="p-4 text-center text-xs text-muted-foreground bg-secondary/20 rounded-xl">
          💡 데이터가 더 많이 쌓이면 AI 코치가 더 정확한 조언을 드릴 수 있습니다. (현재 {transactions.length}건)
        </div>
      )}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">종합 분석 및 리포트</h2>
          <p className="text-sm text-muted-foreground mt-1">나의 재무 상태를 입체적으로 분석합니다</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="neo-inset p-1 rounded-xl flex items-center bg-white/50 dark:bg-black/20" data-html2canvas-ignore>
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
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${timeRange === tr.id ? 'bg-[#20c997] text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => setTimeRange(tr.id as any)}
              >
                {tr.label}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" className="bg-white/50 dark:bg-black/20" onClick={handlePdfExport} data-html2canvas-ignore>
            <Download className="w-4 h-4 mr-2" /> PDF 내보내기
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* 미래 자산 예측 배너 (원본 유지) */}
        <div className="col-span-1 md:col-span-2 lg:col-span-3">
           <div className="neo p-5 rounded-2xl bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 flex flex-col md:flex-row items-center justify-between gap-4 cursor-pointer hover:scale-[1.01] transition-transform" onClick={() => navigate('/predict')} data-html2canvas-ignore>
              <div>
                 <h3 className="font-bold flex items-center gap-2 text-lg"><TrendingUp className="w-5 h-5 text-blue-500" /> 미래 자산 예측하러 가기</h3>
                 <p className="text-sm text-muted-foreground mt-1">"내 돈이 어디로 갔는가?"를 넘어, "앞으로 내 자산이 어떻게 변할 것인가?"를 시뮬레이션 해보세요.</p>
              </div>
              <Button className="shrink-0 rounded-full text-brand-mint border border-brand-mint bg-transparent" variant="outline">
                 미래자산 시뮬레이터로 <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
           </div>
        </div>

        {/* --- 추가된 기능: 최근 12개월 수입/지출 추세 차트 --- */}
        <div className="col-span-1 md:col-span-2 lg:col-span-2">
          <div className="neo rounded-2xl p-6 border border-white/10">
            <h3 className="font-bold flex items-center gap-2 mb-6"><TrendingUp className="w-5 h-5 text-indigo-500" /> 최근 12개월 수입 및 지출 추세</h3>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} opacity={0.3} />
                  <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value/10000}만`} />
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'var(--neo-bg)' }}
                    formatter={(value: any) => `${value.toLocaleString()}원`}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="수입" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="지출" stroke="#ef4444" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* --- 추가된 기능: 지출 카테고리 도넛 차트 --- */}
        <div className="col-span-1">
          <div className="neo rounded-2xl p-6 border border-white/10 h-full">
            <h3 className="font-bold flex items-center gap-2 mb-6"><PieChartIcon className="w-5 h-5 text-rose-500" /> 카테고리별 지출</h3>
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie data={expenseCategoryData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                        {expenseCategoryData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                    </Pie>
                    <RechartsTooltip formatter={(value: any) => `${value.toLocaleString()}원`}/>
                    <Legend iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* 5. 재무 건강 점수 & 6. AI 재무 코치 (원본 유지) */}
        <div className="col-span-1 md:col-span-2 lg:col-span-2 space-y-6">
          <div className="neo rounded-2xl p-6 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-6 opacity-10">
               <Sparkles className="w-32 h-32" />
             </div>
             <div className="relative z-10 flex flex-col md:flex-row gap-6 items-center">
                <div className="flex-shrink-0 text-center space-y-2">
                   <div className="relative w-32 h-32 rounded-full border-8 border-emerald-100 dark:border-emerald-900/50 flex items-center justify-center">
                     <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                       <circle cx="56" cy="56" r="56" fill="transparent" stroke="currentColor" strokeWidth="8" className="text-emerald-500" strokeDasharray="351" strokeDashoffset="52" strokeLinecap="round" style={{ transform: 'translate(8px, 8px)' }} />
                     </svg>
                     <div className="text-center">
                        <span className="text-4xl font-black text-emerald-600 dark:text-emerald-400">
                           {filteredTransactions.length > 5 ? '85' : filteredTransactions.length > 0 ? '60' : '-'}
                        </span>
                        <span className="text-sm font-bold text-muted-foreground block">/ 100점</span>
                     </div>
                   </div>
                   <p className="text-sm font-bold">재무 건강 점수</p>
                </div>
                   <div className="flex-1 space-y-3">
                   <h3 className="font-bold flex items-center gap-1.5 cursor-default">
                     <Sparkles className="w-4 h-4 text-emerald-500" /> AI 코치의 조언
                     <Dialog>
                       <DialogTrigger className="p-1.5 -m-1.5 opacity-50 hover:opacity-100 transition-opacity" title="분석 정보">
                         <CircleHelp className="w-4 h-4 text-muted-foreground" />
                       </DialogTrigger>
                       <DialogContent className="neo rounded-2xl border-none">
                          <DialogHeader>
                            <DialogTitle>AI 코치의 분석 데이터 정보</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-3 text-sm leading-relaxed">
                            <p>AI 코치는 다음 데이터를 바탕으로 조언을 생성합니다:</p>
                            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                              <li><span className="font-bold text-foreground">최근 50건의 거래 내역</span></li>
                              <li><span className="font-bold text-foreground">현재 자산 구성 (현금, 예금 등)</span></li>
                              <li><span className="font-bold text-foreground">이번 달 예산 설정 및 사용률</span></li>
                            </ul>
                            <p className="bg-secondary/30 p-2 rounded-lg text-xs italic">
                              💡 모임 모드일 경우 모임원들과 동일한 데이터를 공유하여 같은 조언이 보여지며, 개인 모드일 경우 본인의 데이터만 분석합니다.
                            </p>
                          </div>
                       </DialogContent>
                     </Dialog>
                   </h3>
                   <div className="space-y-4">
                      <p className="text-sm bg-white/60 dark:bg-black/40 p-3 rounded-xl shadow-sm border border-black/5 dark:border-white/5 italic text-muted-foreground whitespace-pre-wrap">
                         {translatedAdvice || aiAdvice ? (translatedAdvice || aiAdvice) : (filteredTransactions.length > 0 
                           ? "💬 궁금한 점을 물어보거나 '데이터 분석'을 요청하세요!" 
                           : "💬 해당 기간의 거래 내역을 추가하시면 AI 코치가 맞춤형 재무 진단을 제공해 드립니다.")}
                      </p>
                      {aiAdvice && !translatedAdvice && (
                        <div className="flex gap-2">
                           <Button size="sm" variant="outline" className="text-xs" onClick={() => requestTranslation('English')}>영어 번역</Button>
                           <Button size="sm" variant="outline" className="text-xs" onClick={() => requestTranslation('Japanese')}>일본어 번역</Button>
                        </div>
                      )}
                      {translatedAdvice && (
                        <Button size="sm" variant="ghost" className="w-full text-xs" onClick={() => setTranslatedAdvice('')}>원본 보기</Button>
                      )}
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">AI에게 재무 질문하기</Label>
                        <div className="flex gap-2">
                          <Input 
                            placeholder="예: 이번 달 식비 예산 얼마나 남았어?" 
                            value={userQuestion}
                            onChange={(e) => setUserQuestion(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && requestAiAdvice()}
                          />
                          <Button size="icon" variant="outline" onClick={() => requestAiAdvice()} disabled={isAiLoading || !userQuestion}>
                            <ArrowRight className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" className="w-full text-xs" onClick={() => requestAiAdvice('재무 전반에 대한 조언을 해줘')} disabled={isAiLoading}>
                         {isAiLoading ? '분석 중...' : '데이터 정밀 분석 요청하기'}
                      </Button>
                    </div>
                </div>
             </div>
          </div>

          {/* 2. 예산 관리 시스템 (원본 유지) */}
          <div className="neo rounded-2xl p-5 space-y-4">
             <div className="flex justify-between items-center">
                <h3 className="font-bold flex items-center gap-2"><Target className="w-5 h-5 text-brand-coral" /> 예산 관리 (이번 달)</h3>
                
              <Dialog open={budgetOpen} onOpenChange={setBudgetOpen}>
                <DialogTrigger className="inline-flex items-center justify-center rounded-lg h-7 px-2.5 text-xs font-bold transition-colors hover:bg-muted dark:hover:bg-muted/50" onClick={() => setTempBudgets([...budgets])}>
                   예산 설정
                </DialogTrigger>
                <DialogContent className="max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>카테고리별 예산 설정</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    {tempBudgets.map((tb, idx) => (
                      <div key={tb.id} className="flex items-end gap-2 bg-secondary/50 p-2 rounded-xl">
                        <div className="flex-1 space-y-2">
                           <Label>카테고리</Label>
                           <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" value={tb.category} onChange={e => {
                              const newB = [...tempBudgets];
                              newB[idx].category = e.target.value;
                              setTempBudgets(newB);
                           }}>
                              {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                           </select>
                        </div>
                        <div className="flex-1 space-y-2">
                           <Label>예산 (만원)</Label>
                           <Input type="number" value={tb.limit} onChange={e => {
                               const newB = [...tempBudgets];
                               newB[idx].limit = Number(e.target.value);
                               setTempBudgets(newB);
                           }} />
                        </div>
                        <Button variant="ghost" size="icon" className="mb-0.5 text-red-500 w-10 h-10" onClick={() => {
                           setTempBudgets(tempBudgets.filter((_, i) => i !== idx));
                        }}>×</Button>
                      </div>
                    ))}
                    <Button variant="outline" className="w-full text-xs" onClick={() => {
                       setTempBudgets([...tempBudgets, { id: Math.random().toString(), category: EXPENSE_CATEGORIES[0], limit: 10, spent: 0, color: '#94a3b8' }]);
                    }}>+ 카테고리 추가</Button>
                  </div>
                  <Button onClick={() => {
                     setBudgets(tempBudgets);
                     toast.success('예산이 성공적으로 업데이트되었습니다.');
                     setBudgetOpen(false);
                  }}>저장하기</Button>
                </DialogContent>
              </Dialog>
           </div>
           <div className="space-y-5">
              {activeBudgets.length > 0 ? activeBudgets.map(b => {
                 const pct = Math.min(100, Math.round((b.spent / b.limit) * 100)) || 0;
                 return (
                  <div key={b.id}>
                     <div className="flex justify-between text-sm mb-1">
                        <span className="font-bold">{b.category} ({b.limit}만원 예산)</span>
                        <span className="font-bold" style={{ color: b.color }}>{Math.round(b.spent * 10000).toLocaleString()}원 ({pct}%)</span>
                     </div>
                     <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full transition-all" style={{ width: `${pct}%`, backgroundColor: b.color }} />
                     </div>
                     { (b.spent / b.limit) > 0.9 && <p className="text-[10px] text-red-500 mt-1 font-bold">⚠️ 예산 초과 위험!</p> }
                  </div>
                 )
              }) : (
                 <div className="py-10 text-center text-muted-foreground text-sm italic bg-secondary/20 rounded-xl">
                   설정된 예산이 없습니다. 우측 상단 '예산 설정'을 눌러보세요.
                 </div>
               )}
           </div>
          </div>
        </div>

        {/* Right Column (원본 유지) */}
        <div className="space-y-6">
          {/* 4. 상점별 소비 분석 */}
          <div className="neo rounded-2xl p-5">
             <h3 className="font-bold flex items-center gap-2 mb-4"><ShoppingCart className="w-5 h-5 text-green-500" /> 고지출 상점 분석</h3>
             <div className="space-y-3">
                {filteredTransactions.length > 0 ? (
                  (() => {
                    const getNormalizedName = (name: string): string => {
                        const lowName = name.toLowerCase();
                        if (lowName.includes('costco') || lowName.includes('코스트코')) return '코스트코';
                        return name.trim();
                    };

                    const uniqueTransactions: PersonalTransaction[] = Array.from(new Map<string, PersonalTransaction>(filteredTransactions.map(t => [t.id, t])).values());
                    const merchantMap: Record<string, { amount: number, displayName: string }> = uniqueTransactions
                      .filter(t => t.type === 'expense')
                      .reduce((acc, t) => {
                        const rawName = t.description.trim();
                        if (!rawName) return acc;
                        const name = getNormalizedName(rawName);
                        
                        if (!acc[name]) acc[name] = { amount: 0, displayName: rawName.length > name.length ? name : (rawName.includes('코스트코') ? '코스트코' : rawName) };
                        acc[name].displayName = (name === '코스트코') ? '코스트코' : name;
                        
                        acc[name].amount += Number(t.amount) || 0;
                        return acc;
                      }, {} as Record<string, { amount: number, displayName: string }>);
                    
                    return Object.entries(merchantMap)
                      .sort((a, b) => b[1].amount - a[1].amount)
                      .slice(0, 3);
                  })().map(([merchant, data], i) => {
                    return (
                      <div key={i} className="flex justify-between items-center p-2 rounded-xl bg-secondary/50">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-white dark:bg-black flex items-center justify-center font-bold text-sm text-primary">
                            {(data.displayName as string)?.charAt(0) || '?'}
                          </div>
                          <div>
                            <p className="font-bold text-sm">{data.displayName}</p>
                          </div>
                        </div>
                        <span className="font-bold text-sm">₩{data.amount.toLocaleString()}</span>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-8 text-center text-muted-foreground text-xs italic">
                    분석할 데이터가 없습니다
                  </div>
                )}
             </div>
          </div>
          <div className="neo rounded-2xl p-5">
             <div className="flex justify-between items-center mb-4">
               <h3 className="font-bold flex items-center gap-2"><Trophy className="w-5 h-5 text-yellow-500" /> 도전 과제 & 알림</h3>
               
               <Dialog open={challengeOpen} onOpenChange={setChallengeOpen}>
                 <DialogTrigger className="inline-flex items-center justify-center rounded-lg h-7 px-2.5 text-xs font-bold transition-colors hover:bg-muted dark:hover:bg-muted/50">
                    + 새 과제 등록
                 </DialogTrigger>
                 <DialogContent>
                   <DialogHeader>
                     <DialogTitle>새로운 도전 과제 만들기</DialogTitle>
                     <DialogDescription>나만의 재무 목표를 설정하고 달성해보세요.</DialogDescription>
                   </DialogHeader>
                   <div className="space-y-4 py-4">
                     <div className="space-y-2">
                        <Label>도전 과제 이름</Label>
                        <Input placeholder="예: 한 달 동안 배달음식 안 먹기" value={challengeTitle} onChange={e => setChallengeTitle(e.target.value)} />
                     </div>
                   </div>
                   <Button onClick={() => {
                     saveChallenge(challengeTitle);
                     setChallengeOpen(false);
                     setChallengeTitle('');
                   }}>등록하기</Button>
                 </DialogContent>
               </Dialog>
             </div>
             <div className="space-y-3">
                {challenges.length > 0 ? challenges.map(c => (
                  <div key={c.id} className="flex gap-3 items-center bg-yellow-50 dark:bg-yellow-900/10 p-3 rounded-xl border border-yellow-200 dark:border-yellow-900/30 group relative">
                     {c.icon === 'trophy' ? <Trophy className="w-8 h-8 text-yellow-500 shrink-0" /> : <Target className="w-8 h-8 text-yellow-500 shrink-0" />}
                     <div className="flex-1">
                        <p className="font-bold text-sm">{c.title}</p>
                        <p className="text-[10px] text-muted-foreground">{c.desc}</p>
                     </div>
                     <Button variant="ghost" size="icon" className="w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => deleteChallenge(c.id)}>
                        <Trash2 className="w-3 h-3 text-red-500" />
                     </Button>
                  </div>
                )) : (
                  <div className="p-4 text-center text-[10px] text-muted-foreground italic bg-secondary/20 rounded-xl">
                    등록된 도전 과제가 없습니다
                  </div>
                )}
                
                {activeBudgets.filter(b => (b.spent / b.limit) > 0.9).map(b => (
                  <div key={`alert-budget-${b.id}`} className="flex gap-3 items-center bg-red-50 dark:bg-red-900/10 p-3 rounded-xl border border-red-200 dark:border-red-900/30 animate-pulse">
                    <Bell className="w-8 h-8 text-red-500 shrink-0" />
                    <div>
                        <p className="font-bold text-sm text-red-600 dark:text-red-400">예산 초과 경고</p>
                        <p className="text-[10px] text-muted-foreground italic">'{b.category}' 지출이 예산의 {Math.round((b.spent / b.limit) * 100)}%를 사용했습니다.</p>
                    </div>
                  </div>
                ))}

                <div className="bg-blue-50 dark:bg-blue-900/10 p-3 rounded-xl border border-blue-200 dark:border-blue-900/30">
                  <p className="text-[10px] text-blue-600 dark:text-blue-400 leading-relaxed">
                    <span className="font-bold">💡 재무 알림 정보:</span> 도전 과제는 스스로 설정한 목표이며, 예산 초과 경고는 설정한 예산의 90%를 넘겼을 때 시스템에서 자동으로 알려주는 기능입니다.
                  </p>
                </div>
             </div>
          </div>

        <div className="neo rounded-2xl p-5">
           <h3 className="font-bold flex items-center gap-2 mb-4"><BellRing className="w-5 h-5 text-purple-500" /> 정기결재(알림)</h3>
           <div className="space-y-3 mb-4">
              {inferredRecurringPayments.length > 0 ? inferredRecurringPayments.map((item) => (
                <div key={item.id} className={`flex items-center justify-between p-2 rounded-xl bg-secondary/50 ${item.isInferred ? 'border border-dashed border-primary/20' : ''}`}>
                   <div className="flex items-center gap-2">
                      <span className="text-lg">{item.icon}</span>
                      <div>
                         <p className="font-bold text-sm flex items-center gap-1">
                            {item.name}
                            {item.isInferred && <span className="text-[8px] bg-primary/10 text-primary px-1 rounded">추정</span>}
                         </p>
                         <p className={`text-[10px] font-bold ${item.isNotified ? 'text-red-500' : 'text-muted-foreground'}`}>
                           결제 예정: {item.date || '미정'}
                         </p>
                      </div>
                   </div>
                   <div className="flex items-center gap-3">
                      <span className="font-bold text-sm">₩{Math.round(item.amount || 0).toLocaleString()}</span>
                      <button 
                        onClick={() => {
                          if (!item.isInferred) {
                            toggleNotification(item);
                          } else {
                            toast.info('데이터 분석으로 발견된 정기 지출입니다. 날짜가 임박하면 종이 선명해집니다.');
                          }
                        }}
                        className={`p-1.5 rounded-full transition-all ${
                          item.isNotified 
                            ? 'bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400 scale-110 shadow-sm opacity-100' 
                            : 'bg-black/5 text-gray-300 dark:bg-white/5 opacity-40'
                        }`}
                      >
                        <Bell className={`w-3.5 h-3.5 ${item.isNotified ? 'animate-bounce text-red-500' : ''}`} />
                      </button>
                   </div>
                </div>
              )) : (
                <div className="py-8 text-center text-muted-foreground text-sm italic">
                  정기 지출 추정 내역이 없습니다
                </div>
              )}
           </div>
           <Button variant="outline" className="w-full text-xs h-8" onClick={() => navigate('/calendar')}>결제 캘린더 크게 보기</Button>
        </div>
      </div>

        {/* 10. 투자 자산 관리 (원본 유지) */}
        <div className="neo rounded-2xl p-5">
           <div className="flex justify-between items-center mb-4">
             <h3 className="font-bold flex items-center gap-2"><Landmark className="w-5 h-5 text-emerald-500" /> 투자 자산 포트폴리오</h3>
             <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="text-[10px] h-7 px-2" onClick={() => toast.info('마이데이터 계좌 연동 기능을 준비 중입니다.')}>계좌 연동</Button>
                
                <Dialog open={assetOpen} onOpenChange={setAssetOpen}>
                  <DialogTrigger className="inline-flex items-center justify-center rounded-lg h-7 px-2 border border-border bg-white/50 text-[10px] font-bold transition-colors hover:bg-muted dark:hover:bg-muted/50" onClick={() => setTempAssets([...assets])}>
                     직접 편집
                  </DialogTrigger>
                  <DialogContent className="max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>내 자산 직접 편집</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      {tempAssets.map((ta, idx) => (
                        <div key={ta.id} className="flex gap-2 items-center bg-secondary/50 p-2 rounded-xl">
                          <Input className="flex-1" placeholder="자산명 (예: 삼성전자)" value={ta.name} onChange={e => {
                             const newA = [...tempAssets];
                             newA[idx].name = e.target.value;
                             setTempAssets(newA);
                          }} />
                          <Input className="w-24 text-right" type="number" placeholder="금액" value={ta.value / 10000} onChange={e => {
                             const newA = [...tempAssets];
                             newA[idx].value = Number(e.target.value) * 10000;
                             setTempAssets(newA);
                          }} />
                          <span className="text-xs text-muted-foreground mr-1 shrink-0">만원</span>
                          <Button variant="ghost" size="icon" className="w-8 h-8 text-red-500 shrink-0" onClick={() => {
                             setTempAssets(tempAssets.filter((_, i) => i !== idx));
                          }}>×</Button>
                        </div>
                      ))}
                      <Button variant="outline" className="w-full text-xs" onClick={() => {
                         const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4'];
                         setTempAssets([...tempAssets, { id: Math.random().toString(36).substr(2, 9), name: '새 자산', value: 0, color: colors[tempAssets.length % colors.length] }]);
                      }}>+ 새로운 자산 추가</Button>
                    </div>
                    <Button onClick={() => {
                       saveAssets(tempAssets);
                       setAssetOpen(false);
                    }}>저장하기</Button>
                  </DialogContent>
                </Dialog>
             </div>
           </div>
           
           {(assets.length > 0 || totalInferredAssetsValue !== 0) ? (
             <>
               <div className="flex items-center justify-center h-32 mb-4 relative">
                  <ResponsiveContainer width="100%" height="100%">
                     <PieChart>
                       <Pie
                         data={assets.length > 0 ? assets.filter(a => a.value > 0) : [{ name: '현재 가용 자산(추정)', value: totalInferredAssetsValue, color: '#10b981' }]}
                         innerRadius="60%"
                         outerRadius="100%"
                         paddingAngle={2}
                         dataKey="value"
                         stroke="none"
                       >
                         {assets.length > 0 ? assets.filter(a => a.value > 0).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                         )) : <Cell fill="#10b981" />}
                       </Pie>
                       <RechartsTooltip formatter={(val: any) => `₩${(val || 0).toLocaleString()}`} contentStyle={{ borderRadius: '12px', border: 'none', backgroundColor: 'var(--neo-bg)' }}/>
                     </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                     <span className="text-[10px] text-muted-foreground font-bold">{assets.length > 0 ? '총 운영 자산' : '보유 자산(추정)'}</span>
                     <span className="font-black text-sm">{((totalInferredAssetsValue || 0) / 10000).toLocaleString()}만원</span>
                  </div>
               </div>
               <div className="space-y-2 max-h-24 overflow-y-auto">
                  {assets.length > 0 ? assets.map((a) => (
                    <div key={a.id} className="flex justify-between items-center text-xs">
                       <div className="flex items-center gap-1.5 break-all line-clamp-1">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: a.color }}></div>
                          <span className="font-bold">{a.name}</span>
                       </div>
                       <span className="shrink-0 pl-2">{((a.value || 0) / 10000).toLocaleString()}만원</span>
                    </div>
                  )) : (
                    <div className="flex justify-between items-center text-xs">
                       <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-brand-mint"></div>
                          <span className="font-bold italic">전체 수지 균형 기반</span>
                       </div>
                    </div>
                  )}
               </div>
             </>
           ) : (
             <div className="h-40 flex items-center justify-center flex-col text-muted-foreground text-sm">
                <Landmark className="w-8 h-8 mb-2 opacity-20" />
                <p>등록된 자산이 없습니다.</p>
             </div>
           )}
        </div>

        {/* 9. 가족 공유 모드 (원본 유지) */}
        <div className="neo rounded-2xl p-5 flex flex-col justify-between overflow-hidden relative">
           <div className="absolute -right-4 -bottom-4 opacity-5 pointer-events-none">
              <Users className="w-40 h-40" />
           </div>
           <div>
              <h3 className="font-bold flex items-center gap-2 mb-2"><Users className="w-5 h-5 text-orange-500" /> 가족 공유 모드</h3>
              <p className="text-xs text-muted-foreground leading-relaxed relative z-10">
                 부부 또는 가족과 함께 자산을 투명하게 관리하세요.<br/>
                 공동 생활비 통장, 부부 합산 자산을 한눈에 확인할 수 있습니다.
              </p>
           </div>
           
           <div className="mt-6 flex flex-col gap-2 relative z-10">
              <div className="flex -space-x-2">
                 <div className="w-8 h-8 rounded-full bg-indigo-100 border-2 border-white dark:border-background flex items-center justify-center text-xs font-bold text-indigo-700">나</div>
                 <div className="w-8 h-8 rounded-full bg-orange-100 border-2 border-white dark:border-background flex items-center justify-center text-xs font-bold text-orange-700">배</div>
              </div>
              <Button className="w-full text-xs font-bold mt-2" onClick={handleShareFamily}>가족 초대하기</Button>
              {inviteLink && (
                 <div className="mt-2 text-xs">
                    <p className="text-[10px] text-muted-foreground mb-1">아래 링크를 복사하여 공유하세요.</p>
                    <Input readOnly value={inviteLink} className="h-8 text-[10px]" onFocus={e => e.target.select()} />
                 </div>
              )}
           </div>
        </div>

      </div>

      <div className="flex justify-center mt-6 block md:hidden" data-html2canvas-ignore>
         <Button variant="outline" className="w-full h-12 neo-button bg-brand-mint text-white border-none font-bold shadow-md" onClick={handlePdfExport}>
          <Download className="w-4 h-4 mr-2" /> PDF 월간 종합 리포트 저장
        </Button>
      </div>

    </div>
  );
}
