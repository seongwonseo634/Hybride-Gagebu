import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Switch } from "../components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  TrendingUp,
  Calculator,
  Clock,
  Target,
  Rocket,
  ArrowRight,
  TrendingDown,
  CalendarDays,
  Car,
  Home,
  Heart,
  Plane,
  BrainCircuit,
  Zap,
  ShieldCheck,
  Sprout,
  PiggyBank,
  ChevronLeft
} from "lucide-react";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceDot,
  ComposedChart,
  Bar
} from "recharts";

export default function PredictPage() {
  const navigate = useNavigate();
  const [currentAssets, setCurrentAssets] = useState<number | "">(3000); // 3000만원
  const [monthlySaving, setMonthlySaving] = useState<number | "">(150); // 150만원
  const [expectedReturn, setExpectedReturn] = useState<number | "">(7); // 연 7% 수익률
  const [interestType, setInterestType] = useState<"단리" | "복리">("복리");
  const [targetFireAsset, setTargetFireAsset] = useState<number | "">(100000); // 10억
  const [currentAge, setCurrentAge] = useState<number | "">(30); // 현재 나이

  const safeVal = (v: number | "") => (typeof v === "number" ? v : 0);

  // --- FIRE 시뮬레이터 ---
  const generateFireProjection = () => {
    let assets = safeVal(currentAssets) * 10000;
    const monthlyAddition = safeVal(monthlySaving) * 10000;
    const monthlyRate = safeVal(expectedReturn) / 100 / 12;
    const target = safeVal(targetFireAsset) * 10000;

    let months = 0;
    const data = [];
    const thisYear = new Date().getFullYear();

    let principal = assets;
    let accumulatedInterest = 0;

    data.push({
      year: thisYear,
      assets: assets,
      label: `${thisYear}년`,
    });

    while (assets < target && months < 600) {
      if (interestType === "복리") {
        assets = assets * (1 + monthlyRate) + monthlyAddition;
      } else {
        principal += monthlyAddition;
        accumulatedInterest += principal * monthlyRate;
        assets = principal + accumulatedInterest;
      }
      months++;
      if (months % 12 === 0) {
        data.push({
          year: thisYear + months / 12,
          assets: Math.round(assets),
          label: `${thisYear + months / 12}년`,
        });
      }
    }

    if (months % 12 !== 0 && assets >= target) {
      data.push({
        year: thisYear + Math.ceil(months / 12),
        assets: Math.round(assets),
        label: `${thisYear + Math.ceil(months / 12)}년`,
      });
    }
    return { data, months, finalAssets: Math.round(assets) };
  };

  const fireData = generateFireProjection();
  const yearsToFire = Math.floor(fireData.months / 12);
  const remainingMonths = fireData.months % 12;
  const age = safeVal(currentAge);

  // --- 6개월 예측 ---
  const [shortTermIncome, setShortTermIncome] = useState<number | "">(300);
  const [shortTermFixed, setShortTermFixed] = useState<number | "">(100);
  const [shortTermVariable, setShortTermVariable] = useState<number | "">(50);
  const [shortTermTarget, setShortTermTarget] = useState<number | "">(4000);
  
  const generateShortTerm = () => {
    let current = safeVal(currentAssets) * 10000;
    const income = safeVal(shortTermIncome) * 10000;
    const expenses = (safeVal(shortTermFixed) + safeVal(shortTermVariable)) * 10000;
    const net = income - expenses;
    
    const data = [];
    const today = new Date();
    data.push({ month: `${today.getMonth() + 1}월`, assets: current, info: "현재" });
    
    for (let i = 1; i <= 6; i++) {
        let nextDate = new Date(today.getFullYear(), today.getMonth() + i, 1);
        current += net;
        data.push({ month: `${nextDate.getMonth() + 1}월`, assets: current, info: i === 6 ? "예측완료" : "진행중" });
    }
    return data;
  };
  const shortTermData = generateShortTerm();
  const shortTermNet = safeVal(shortTermIncome) - safeVal(shortTermFixed) - safeVal(shortTermVariable);

  // --- 라이프 이벤트 ---
  const [events, setEvents] = useState({
    marriage: false,
    moving: false,
    car: false,
    travel: false
  });
  const [customEvents, setCustomEvents] = useState<{name: string, cost: number, yearOffset: number, id: string}[]>([]);
  const [newCustomEvent, setNewCustomEvent] = useState({ name: "", cost: "", yearOffset: "" });

  const addCustomEvent = () => {
    if (newCustomEvent.name && newCustomEvent.cost && newCustomEvent.yearOffset) {
        setCustomEvents([...customEvents, {
            id: Date.now().toString(),
            name: newCustomEvent.name,
            cost: Number(newCustomEvent.cost) * 10000,
            yearOffset: Number(newCustomEvent.yearOffset)
        }]);
        setNewCustomEvent({ name: "", cost: "", yearOffset: "" });
    }
  };

  const EVENT_COSTS = {
      marriage: { cost: 50000000, yearOffset: 1, name: "결혼 (-5천만)" },
      moving: { cost: 100000000, yearOffset: 2, name: "이사 (-1억)" },
      car: { cost: 40000000, yearOffset: 1, name: "차량 구매 (-4천만)" },
      travel: { cost: 5000000, yearOffset: 0.5, name: "해외 여행 (-5백만)" },
  };

  const generateEventProjection = () => {
    let assets = safeVal(currentAssets) * 10000;
    const yearlyNet = safeVal(monthlySaving) * 10000 * 12;
    const data = [];
    const thisYear = new Date().getFullYear();
    
    data.push({ year: thisYear, label: `${thisYear}년`, baseAssets: assets, eventAssets: assets });
    
    for (let i = 1; i <= 10; i++) {
        let baseAssets = assets + (yearlyNet * i);
        let eventAssets = baseAssets;
        
        let triggers = [];
        if (events.marriage && i >= EVENT_COSTS.marriage.yearOffset) { 
            eventAssets -= EVENT_COSTS.marriage.cost; 
            if (i === Math.ceil(EVENT_COSTS.marriage.yearOffset)) triggers.push("결혼"); 
        }
        if (events.moving && i >= EVENT_COSTS.moving.yearOffset) { 
            eventAssets -= EVENT_COSTS.moving.cost; 
            if (i === Math.ceil(EVENT_COSTS.moving.yearOffset)) triggers.push("이사"); 
        }
        if (events.car && i >= EVENT_COSTS.car.yearOffset) { 
            eventAssets -= EVENT_COSTS.car.cost; 
            if (i === Math.ceil(EVENT_COSTS.car.yearOffset)) triggers.push("차량구매"); 
        }
        if (events.travel && i >= Math.ceil(EVENT_COSTS.travel.yearOffset)) { 
            eventAssets -= EVENT_COSTS.travel.cost; 
            if (i === Math.ceil(EVENT_COSTS.travel.yearOffset)) triggers.push("해외여행"); 
        }
        
        customEvents.forEach(ce => {
             if (i >= Math.ceil(ce.yearOffset)) {
                 eventAssets -= ce.cost;
                 if (i === Math.ceil(ce.yearOffset)) triggers.push(ce.name);
             }
        });
        
        data.push({ 
            year: thisYear + i, 
            label: `${thisYear + i}년`, 
            baseAssets, 
            eventAssets, 
            eventsAt: triggers.join(', ')
        });
    }
    return data;
  };
  const eventData = generateEventProjection();

  // --- 소비 유형 분석 ---
  const SPENDING_TYPES = [
      { id: 'stable', name: '안정형 (방어적)', icon: <ShieldCheck className="w-8 h-8 text-blue-500"/>, desc: '리스크를 피하고 꾸준한 저축을 선호합니다.', advice: '안정적인 현금흐름이 훌륭하지만, 일부는 인플레이션 방어를 위해 투자(인덱스 펀드 등)를 고려해보세요.', color: 'from-blue-500 to-cyan-500' },
      { id: 'planner', name: '계획형 (전략적)', icon: <BrainCircuit className="w-8 h-8 text-indigo-500"/>, desc: '예산을 철저히 세우고 계획대로 소비합니다.', advice: '모든 것이 계획대로 진행되고 있습니다. 가끔은 나를 위한 투자나 예비비(비상금) 한도를 늘려 유연성을 가져보세요.', color: 'from-indigo-500 to-purple-500' },
      { id: 'impulsive', name: '충동형 (현재집중)', icon: <Zap className="w-8 h-8 text-amber-500"/>, desc: '감정이나 상황에 따라 즉흥적인 지출이 많습니다.', advice: '소비의 기쁨도 중요하지만, \'3일 고민하기\' 규칙을 도입해 충동 소비를 줄이고 자동 저축 시스템을 구축해보세요.', color: 'from-amber-400 to-orange-500' },
      { id: 'growth', name: '성장형 (투자중심)', icon: <Sprout className="w-8 h-8 text-green-500"/>, desc: '자산 증식과 자기계발 등 미래가치에 집중합니다.', advice: '미래를 향한 투자가 멋집니다. 다만 투자 리스크 모니터링과 충분한 현금성 자금 보유(비상금) 균형을 꼭 유지하세요.', color: 'from-green-400 to-emerald-500' }
  ];
  const [selectedAnalysis, setSelectedAnalysis] = useState('planner');

  // --- 목적 기반 저축 ---
  const [goalName, setGoalName] = useState<string>("주택자금");
  const [goalTargetAmount, setGoalTargetAmount] = useState<number | "">(5000); // 5000만원
  const [goalTargetYears, setGoalTargetYears] = useState<number | "">(5); // 5년
  const [goalReturn, setGoalReturn] = useState<number | "">(3.5); // 3.5%

  const calculateMonthlyRequired = () => {
      const target = safeVal(goalTargetAmount) * 10000;
      const years = safeVal(goalTargetYears);
      const rate = safeVal(goalReturn);

      if (years <= 0 || target <= 0) return 0;
      const n = years * 12;

      if (rate <= 0) {
          return target / n;
      }

      const r_m = rate / 100 / 12;
      const P = target * r_m / (Math.pow(1 + r_m, n) - 1);
      return P;
  };

  const generateGoalChartData = () => {
    const P = calculateMonthlyRequired();
    const years = safeVal(goalTargetYears);
    const rate = safeVal(goalReturn);
    const r_m = rate / 100 / 12;
    const n = Math.ceil(years * 12);

    const data = [];
    const thisYear = new Date().getFullYear();
    let currentAssets = 0;
    
    for(let y = 0; y <= years; y++) {
         let monthsIn = y * 12;
         if (monthsIn > n) monthsIn = n;
         
         if (rate <= 0) {
             currentAssets = P * monthsIn;
         } else {
             currentAssets = P * (Math.pow(1 + r_m, monthsIn) - 1) / r_m;
         }

         data.push({
             label: `${thisYear + y}년`,
             assets: Math.round(currentAssets)
         });
    }

    return data;
  }
  const monthlyRequired = Math.round(calculateMonthlyRequired() / 10000); // 만원 단위로
  const goalChartData = generateGoalChartData();

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto mb-20 md:mb-0 animate-in fade-in">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" className="mb-2 pl-0 hover:bg-transparent -ml-2 text-emerald-500" onClick={() => navigate(-1)}>
            <ChevronLeft className="w-4 h-4 mr-1" /> 이전으로
          </Button>
          <h2 className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
            고급 분석 및 예측
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            다양한 시뮬레이션으로 내 자산의 미래를 그려보세요.
          </p>
        </div>
      </div>

      <Tabs defaultValue="fire" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto h-auto p-1 bg-white/50 dark:bg-black/20 border border-black/5 dark:border-white/5 rounded-xl mb-6 scrollbar-hide">
          <TabsTrigger value="fire" className="rounded-lg data-active:bg-white dark:data-active:bg-zinc-700 data-active:shadow-sm"><Target className="w-4 h-4 mr-2"/> 조기 은퇴 (FIRE)</TabsTrigger>
          <TabsTrigger value="6months" className="rounded-lg data-active:bg-white dark:data-active:bg-zinc-700 data-active:shadow-sm"><TrendingUp className="w-4 h-4 mr-2"/> 6개월 단기 예측</TabsTrigger>
          <TabsTrigger value="goal" className="rounded-lg data-active:bg-white dark:data-active:bg-zinc-700 data-active:shadow-sm"><PiggyBank className="w-4 h-4 mr-2"/> 목적 기반 저축</TabsTrigger>
          <TabsTrigger value="events" className="rounded-lg data-active:bg-white dark:data-active:bg-zinc-700 data-active:shadow-sm"><CalendarDays className="w-4 h-4 mr-2"/> 라이프 이벤트</TabsTrigger>
          <TabsTrigger value="type" className="rounded-lg data-active:bg-white dark:data-active:bg-zinc-700 data-active:shadow-sm"><BrainCircuit className="w-4 h-4 mr-2"/> 소비 유형 분석</TabsTrigger>
        </TabsList>

        {/* 1. FIRE 시뮬레이터 */}
        <TabsContent value="fire" className="outline-none">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-6">
                <div className="neo p-5 rounded-2xl flex flex-col gap-5 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 dark:from-indigo-900/10 dark:to-purple-900/10 border border-indigo-100 dark:border-indigo-900/30">
                    <h3 className="font-bold flex items-center gap-2 text-lg">
                    <Target className="w-5 h-5 text-indigo-500" /> FIRE 시뮬레이터 설정
                    </h3>
                    <div className="space-y-4">
                    <div className="space-y-2">
                        <div className="flex justify-between items-center gap-2">
                        <Label className="text-sm font-bold shrink-0">현재 나이</Label>
                        <div className="flex items-center gap-1 w-24">
                            <Input type="number" value={currentAge} onChange={(e) => setCurrentAge(e.target.value === "" ? "" : Number(e.target.value))} className="h-8 text-right bg-white dark:bg-black/50" />
                            <span className="text-sm shrink-0">세</span>
                        </div>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between items-center gap-2">
                        <Label className="text-sm font-bold shrink-0">현재 자산</Label>
                        <div className="flex items-center gap-1 w-32">
                            <Input type="number" value={currentAssets} onChange={(e) => setCurrentAssets(e.target.value === "" ? "" : Number(e.target.value))} className="h-8 text-right bg-white dark:bg-black/50" />
                            <span className="text-sm shrink-0">만원</span>
                        </div>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between items-center gap-2">
                        <Label className="text-sm font-bold shrink-0">월 저축/투자액</Label>
                        <div className="flex items-center gap-1 w-32">
                            <Input type="number" value={monthlySaving} onChange={(e) => setMonthlySaving(e.target.value === "" ? "" : Number(e.target.value))} className="h-8 text-right bg-white dark:bg-black/50" />
                            <span className="text-sm shrink-0">만원</span>
                        </div>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between items-center gap-2">
                        <div className="flex items-center gap-2 shrink-0">
                            <Label className="text-sm font-bold">기대 연 수익률</Label>
                            <Select value={interestType} onValueChange={(val: "단리" | "복리") => setInterestType(val)}>
                            <SelectTrigger className="h-8 px-2 w-20 text-xs bg-white dark:bg-black/50">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="단리">단리</SelectItem>
                                <SelectItem value="복리">복리</SelectItem>
                            </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center gap-1 w-24">
                            <Input type="number" value={expectedReturn} onChange={(e) => setExpectedReturn(e.target.value === "" ? "" : Number(e.target.value))} className="h-8 text-right bg-white dark:bg-black/50" />
                            <span className="text-sm shrink-0">%</span>
                        </div>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between items-center gap-2">
                        <Label className="text-sm font-bold shrink-0">은퇴 목표 자산</Label>
                        <div className="flex items-center gap-1 w-32">
                            <Input type="number" value={targetFireAsset} onChange={(e) => setTargetFireAsset(e.target.value === "" ? "" : Number(e.target.value))} className="h-8 text-right bg-white dark:bg-black/50" />
                            <span className="text-sm shrink-0">만원</span>
                        </div>
                        </div>
                    </div>
                    </div>
                </div>
                </div>

                <div className="lg:col-span-2 space-y-6">
                <div className="neo p-6 rounded-2xl border border-black/5 dark:border-white/5">
                    <div className="flex flex-col md:flex-row gap-6 mb-8">
                    <div className="flex-1 bg-white/50 dark:bg-black/20 p-5 rounded-2xl flex flex-col justify-center items-center text-center">
                        <p className="text-sm text-muted-foreground mb-1 font-bold">목표 달성 소요 기간</p>
                        <p className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-indigo-500">
                        {yearsToFire}년 {remainingMonths > 0 ? `${remainingMonths}개월` : ""}
                        </p>
                    </div>
                    <div className="flex-1 bg-white/50 dark:bg-black/20 p-5 rounded-2xl flex flex-col justify-center items-center text-center relative overflow-hidden">
                        <div className="absolute top-2 right-2 opacity-10"><Rocket className="w-16 h-16" /></div>
                        <p className="text-sm text-muted-foreground mb-1 font-bold">조기 은퇴 예상 나이</p>
                        <p className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-purple-500 to-pink-500">{age + yearsToFire}세</p>
                        <p className="text-[10px] text-muted-foreground mt-2">(현재나이 {age}세 기준)</p>
                    </div>
                    </div>

                    <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={fireData.data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorAssets" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickFormatter={(value) => {
                            if (value >= 100000000) return `${Math.round(value / 100000000)}억`;
                            return `${Math.round(value / 10000)}만`;
                        }} />
                        <RechartsTooltip
                            formatter={(value: number) => [`${(value / 10000).toLocaleString()}만원`, "자산"]}
                            contentStyle={{ borderRadius: "12px", border: "none", backgroundColor: "var(--neo-bg)", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                        />
                        <Area type="monotone" dataKey="assets" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorAssets)" />
                        </AreaChart>
                    </ResponsiveContainer>
                    </div>
                </div>
                </div>
            </div>
        </TabsContent>

        {/* 2. 6개월 단기 예측 */}
        <TabsContent value="6months" className="outline-none">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-6">
                    <div className="neo p-5 rounded-2xl flex flex-col gap-5 bg-gradient-to-br from-emerald-50/50 to-teal-50/50 dark:from-emerald-900/10 dark:to-teal-900/10 border border-emerald-100 dark:border-emerald-900/30">
                        <h3 className="font-bold flex items-center gap-2 text-lg">
                        <TrendingUp className="w-5 h-5 text-emerald-500" /> 단기 자산 흐름 설정
                        </h3>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <div className="flex justify-between items-center gap-2">
                                <Label className="text-sm font-bold shrink-0">월 평균 수입</Label>
                                <div className="flex items-center gap-1 w-32">
                                    <Input type="number" value={shortTermIncome} onChange={(e) => setShortTermIncome(e.target.value === "" ? "" : Number(e.target.value))} className="h-8 text-right bg-white dark:bg-black/50" />
                                    <span className="text-sm shrink-0">만원</span>
                                </div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between items-center gap-2">
                                <Label className="text-sm font-bold shrink-0">월 고정 지출</Label>
                                <div className="flex items-center gap-1 w-32">
                                    <Input type="number" value={shortTermFixed} onChange={(e) => setShortTermFixed(e.target.value === "" ? "" : Number(e.target.value))} className="h-8 text-right bg-white dark:bg-black/50" />
                                    <span className="text-sm shrink-0">만원</span>
                                </div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between items-center gap-2">
                                <Label className="text-sm font-bold shrink-0">월 변동 지출 (목표)</Label>
                                <div className="flex items-center gap-1 w-32">
                                    <Input type="number" value={shortTermVariable} onChange={(e) => setShortTermVariable(e.target.value === "" ? "" : Number(e.target.value))} className="h-8 text-right bg-white dark:bg-black/50" />
                                    <span className="text-sm shrink-0">만원</span>
                                </div>
                                </div>
                            </div>
                            <div className="space-y-2 pt-2 border-t border-black/10 dark:border-white/10">
                                <div className="flex justify-between items-center gap-2">
                                <Label className="text-sm font-bold shrink-0">6개월 후 단기 목표</Label>
                                <div className="flex items-center gap-1 w-32">
                                    <Input type="number" value={shortTermTarget} onChange={(e) => setShortTermTarget(e.target.value === "" ? "" : Number(e.target.value))} className="h-8 text-right bg-white dark:bg-black/50" />
                                    <span className="text-sm shrink-0">만원</span>
                                </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-2 space-y-6">
                    <div className="neo p-6 rounded-2xl border border-black/5 dark:border-white/5">
                        <div className="flex flex-col md:flex-row gap-6 mb-8">
                            <div className="flex-1 bg-white/50 dark:bg-black/20 p-5 rounded-xl border-l-4 border-emerald-500">
                                <p className="text-sm text-emerald-600 dark:text-emerald-400 mb-1 font-bold">건강한 저축률</p>
                                <p className="text-2xl font-black">
                                    {shortTermIncome ? Math.round(((shortTermNet) / safeVal(shortTermIncome)) * 100) : 0}%
                                </p>
                            </div>
                            <div className="flex-1 bg-white/50 dark:bg-black/20 p-5 rounded-xl border-l-4 border-blue-500">
                                <p className="text-sm text-blue-600 dark:text-blue-400 mb-1 font-bold">월 저축/투자 가능액</p>
                                <p className="text-2xl font-black">{shortTermNet.toLocaleString()}만원</p>
                            </div>
                            <div className="flex-1 bg-white/50 dark:bg-black/20 p-5 rounded-xl border-l-4 border-purple-500">
                                <p className="text-sm text-purple-600 dark:text-purple-400 mb-1 font-bold">6개월 뒤 예상 자산</p>
                                <p className="text-2xl font-black">
                                    {((safeVal(currentAssets)*10000 + shortTermNet*10000*6)/10000).toLocaleString()}만원
                                </p>
                            </div>
                        </div>

                        <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={shortTermData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickFormatter={(value) => `${Math.round(value / 10000)}만`} />
                            <RechartsTooltip
                                formatter={(value: number) => [`${(value / 10000).toLocaleString()}만원`, "예상 자산"]}
                                contentStyle={{ borderRadius: "12px", border: "none", backgroundColor: "var(--neo-bg)" }}
                            />
                            <Bar dataKey="assets" fill="#10b981" radius={[4, 4, 0, 0]} opacity={0.3} barSize={40} />
                            <Line type="monotone" dataKey="assets" stroke="#10b981" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                            {/* 목표 기준선 */}
                            <Line type="step" dataKey={() => safeVal(shortTermTarget)*10000} stroke="#8b5cf6" strokeDasharray="5 5" strokeWidth={2} dot={false} activeDot={false} legendType="none" />
                            </ComposedChart>
                        </ResponsiveContainer>
                        </div>
                        <p className="text-xs text-muted-foreground text-center mt-4">보라색 점선은 6개월 후 단기 목표 자산입니다.</p>
                    </div>
                </div>
            </div>
        </TabsContent>

        <TabsContent value="goal" className="outline-none">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-6">
                    <div className="neo p-5 rounded-2xl flex flex-col gap-5 bg-gradient-to-br from-pink-50/50 to-rose-50/50 dark:from-pink-900/10 dark:to-rose-900/10 border border-pink-100 dark:border-pink-900/30">
                        <h3 className="font-bold flex items-center gap-2 text-lg">
                        <PiggyBank className="w-5 h-5 text-pink-500" /> 목적별 저축 시뮬레이터
                        </h3>
                        <p className="text-xs text-muted-foreground mb-2">원하는 목적과 금액, 기간을 설정하여 매월 얼마를 모아야 할지 알아봅니다.</p>
                        
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <div className="flex justify-between items-center gap-2">
                                    <Label className="text-sm font-bold shrink-0">목표 이름</Label>
                                    <Input value={goalName} onChange={(e) => setGoalName(e.target.value)} className="h-8 max-w-[140px] text-right bg-white dark:bg-black/50" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between items-center gap-2">
                                    <Label className="text-sm font-bold shrink-0">목표 금액</Label>
                                    <div className="flex items-center gap-1 w-32">
                                        <Input type="number" value={goalTargetAmount} onChange={(e) => setGoalTargetAmount(e.target.value === "" ? "" : Number(e.target.value))} className="h-8 text-right bg-white dark:bg-black/50" />
                                        <span className="text-sm shrink-0">만원</span>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between items-center gap-2">
                                    <Label className="text-sm font-bold shrink-0">달성 기간</Label>
                                    <div className="flex items-center gap-1 w-24">
                                        <Input type="number" value={goalTargetYears} onChange={(e) => setGoalTargetYears(e.target.value === "" ? "" : Number(e.target.value))} className="h-8 text-right bg-white dark:bg-black/50" />
                                        <span className="text-sm shrink-0">년</span>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between items-center gap-2">
                                    <Label className="text-sm font-bold shrink-0">예상 수익률</Label>
                                    <div className="flex items-center gap-1 w-24">
                                        <Input type="number" step="0.1" value={goalReturn} onChange={(e) => setGoalReturn(e.target.value === "" ? "" : Number(e.target.value))} className="h-8 text-right bg-white dark:bg-black/50" />
                                        <span className="text-sm shrink-0">%</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2 mt-2">
                            <Button variant="outline" size="sm" className="h-8 text-xs flex-1" onClick={() => { setGoalName("주택자금"); setGoalTargetAmount(5000); setGoalTargetYears(5); setGoalReturn(3.5); }}>주택자금</Button>
                            <Button variant="outline" size="sm" className="h-8 text-xs flex-1" onClick={() => { setGoalName("해외여행"); setGoalTargetAmount(500); setGoalTargetYears(1); setGoalReturn(2.0); }}>해외여행</Button>
                            <Button variant="outline" size="sm" className="h-8 text-xs flex-1" onClick={() => { setGoalName("차량구매"); setGoalTargetAmount(3000); setGoalTargetYears(3); setGoalReturn(3.0); }}>차량구매</Button>
                            <Button variant="outline" size="sm" className="h-8 text-xs flex-1" onClick={() => { setGoalName(""); setGoalTargetAmount(""); setGoalTargetYears(""); setGoalReturn(""); }}>직접입력</Button>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-2 space-y-6">
                    <div className="neo p-6 rounded-2xl border border-black/5 dark:border-white/5 h-full flex flex-col justify-between">
                        <div className="flex flex-col md:flex-row gap-6 mb-8 mt-2">
                            <div className="flex-1 bg-white/50 dark:bg-black/20 p-5 rounded-xl border-l-4 border-pink-500 shadow-sm flex flex-col justify-center items-center text-center">
                                <p className="text-sm text-pink-600 dark:text-pink-400 mb-1 font-bold">"{goalName}" 달성을 위해 매월 모아야 할 금액</p>
                                <p className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-rose-500">
                                    {monthlyRequired > 0 ? monthlyRequired.toLocaleString() : 0} 만원
                                </p>
                            </div>
                        </div>

                        <div className="flex-1 min-h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={goalChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorGoalAssets" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickFormatter={(value) => {
                                        if (value >= 100000000) return `${Math.round(value / 100000000)}억`;
                                        return `${Math.round(value / 10000)}만`;
                                    }} />
                                    <RechartsTooltip
                                        formatter={(value: number) => [`${(value / 10000).toLocaleString()}만원`, "누적 금액"]}
                                        contentStyle={{ borderRadius: "12px", border: "none", backgroundColor: "var(--neo-bg)" }}
                                    />
                                    <Area type="monotone" dataKey="assets" stroke="#f43f5e" strokeWidth={3} fillOpacity={1} fill="url(#colorGoalAssets)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>
        </TabsContent>

        {/* 3. 라이프 이벤트 */}
        <TabsContent value="events" className="outline-none">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-6">
                <div className="neo p-5 rounded-2xl flex flex-col gap-5 bg-gradient-to-br from-amber-50/50 to-orange-50/50 dark:from-amber-900/10 dark:to-orange-900/10 border border-amber-100 dark:border-amber-900/30">
                    <h3 className="font-bold flex items-center gap-2 text-lg">
                    <CalendarDays className="w-5 h-5 text-amber-500" /> 향후 이벤트 시뮬레이션
                    </h3>
                    <p className="text-xs text-muted-foreground mb-2">예상되는 주요 이벤트를 켜서 자산 감소를 시각화 해보세요. (향후 1~2년 기준)</p>
                    <div className="space-y-5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-pink-100 dark:bg-pink-900/40 rounded-lg text-pink-500"><Heart className="w-4 h-4" /></div>
                                <div>
                                    <p className="font-bold text-sm">결혼 준비</p>
                                    <p className="text-xs text-muted-foreground">- 5,000만원</p>
                                </div>
                            </div>
                            <Switch checked={events.marriage} onCheckedChange={(c) => setEvents({...events, marriage: c})} />
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg text-blue-500"><Home className="w-4 h-4" /></div>
                                <div>
                                    <p className="font-bold text-sm">주택/이사</p>
                                    <p className="text-xs text-muted-foreground">- 1억원</p>
                                </div>
                            </div>
                            <Switch checked={events.moving} onCheckedChange={(c) => setEvents({...events, moving: c})} />
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-zinc-500"><Car className="w-4 h-4" /></div>
                                <div>
                                    <p className="font-bold text-sm">차량 구매</p>
                                    <p className="text-xs text-muted-foreground">- 4,000만원</p>
                                </div>
                            </div>
                            <Switch checked={events.car} onCheckedChange={(c) => setEvents({...events, car: c})} />
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-sky-100 dark:bg-sky-900/40 rounded-lg text-sky-500"><Plane className="w-4 h-4" /></div>
                                <div>
                                    <p className="font-bold text-sm">해외 여행</p>
                                    <p className="text-xs text-muted-foreground">- 500만원</p>
                                </div>
                            </div>
                            <Switch checked={events.travel} onCheckedChange={(c) => setEvents({...events, travel: c})} />
                        </div>

                        {/* Custom Events Input */}
                        <div className="pt-4 mt-6 border-t border-black/10 dark:border-white/10 space-y-4">
                            <h4 className="font-bold text-sm">직접 추가하기</h4>
                            <div className="flex flex-col gap-2">
                                <Input placeholder="이벤트 이름 (예: 대학원 진학)" value={newCustomEvent.name} onChange={(e) => setNewCustomEvent({...newCustomEvent, name: e.target.value})} className="h-8 text-sm" />
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1 flex-1">
                                      <Input type="number" placeholder="비용" value={newCustomEvent.cost} onChange={(e) => setNewCustomEvent({...newCustomEvent, cost: e.target.value})} className="h-8 text-sm text-right" />
                                      <span className="text-xs text-muted-foreground shrink-0">만원</span>
                                    </div>
                                    <div className="flex items-center gap-1 flex-1">
                                      <Input type="number" placeholder="기간" value={newCustomEvent.yearOffset} onChange={(e) => setNewCustomEvent({...newCustomEvent, yearOffset: e.target.value})} className="h-8 text-sm text-right" />
                                      <span className="text-xs text-muted-foreground shrink-0">년 뒤</span>
                                    </div>
                                    <Button onClick={addCustomEvent} disabled={!newCustomEvent.name || !newCustomEvent.cost || !newCustomEvent.yearOffset} className="h-8 px-3 text-xs bg-amber-500 hover:bg-amber-600 text-white border-0">추가</Button>
                                </div>
                            </div>
                            {customEvents.length > 0 && (
                                <div className="space-y-2 mt-4 max-h-40 overflow-y-auto pr-1">
                                    {customEvents.map(ce => (
                                        <div key={ce.id} className="flex flex-row justify-between items-center text-sm bg-black/5 dark:bg-white/5 p-2 rounded-lg">
                                            <div>
                                                <p className="font-bold">{ce.name}</p>
                                                <p className="text-xs text-muted-foreground">{ce.yearOffset}년 뒤, -{(ce.cost/10000).toLocaleString()}만원</p>
                                            </div>
                                            <Button variant="ghost" size="sm" onClick={() => setCustomEvents(customEvents.filter(c => c.id !== ce.id))} className="h-6 px-2 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">삭제</Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                </div>

                <div className="lg:col-span-2 space-y-6">
                <div className="neo p-6 rounded-2xl border border-black/5 dark:border-white/5">
                    <h3 className="font-bold mb-6">이벤트 전/후 10년 자산 흐름 비교</h3>
                    <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={eventData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickFormatter={(value) => {
                            if (value >= 100000000) return `${Math.round(value / 100000000)}억`;
                            return `${Math.round(value / 10000)}만`;
                        }} />
                        <RechartsTooltip
                            formatter={(value: number, name: string) => [`${(value / 10000).toLocaleString()}만원`, name === "baseAssets" ? "기본 자산흐름" : "이벤트 반영 자산"]}
                            labelFormatter={(label, payload) => {
                                const eventsAt = payload?.[0]?.payload?.eventsAt;
                                return `${label} ${eventsAt ? `(발생: ${eventsAt})` : ''}`;
                            }}
                            contentStyle={{ borderRadius: "12px", border: "none", backgroundColor: "var(--neo-bg)" }}
                        />
                        <Line type="monotone" name="기본 자산흐름" dataKey="baseAssets" stroke="#9ca3af" strokeWidth={2} strokeDasharray="5 5" dot={false} opacity={0.5} />
                        <Line type="monotone" name="이벤트 반영 자산" dataKey="eventAssets" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                        </LineChart>
                    </ResponsiveContainer>
                    </div>
                    <div className="flex justify-center gap-6 mt-4 opacity-70">
                        <div className="flex items-center gap-2 text-xs font-bold"><div className="w-3 h-1 border-b-2 border-dashed border-gray-400"></div>기본 (이벤트 없음)</div>
                        <div className="flex items-center gap-2 text-xs font-bold"><div className="w-3 h-1 bg-amber-500"></div>이벤트 반영 후</div>
                    </div>
                </div>
                </div>
            </div>
        </TabsContent>

        {/* 4. 소비 유형 분석 */}
        <TabsContent value="type" className="outline-none">
            <div className="neo p-6 md:p-10 rounded-2xl border border-black/5 dark:border-white/5 bg-gradient-to-br from-purple-50/30 to-pink-50/30 dark:from-purple-900/10 dark:to-pink-900/10">
                <div className="text-center mb-8 max-w-2xl mx-auto">
                    <h3 className="text-2xl font-black mb-2">나의 맞춤 소비 유형 분석</h3>
                    <p className="text-muted-foreground text-sm">입력된 지출 내역을 기반으로 AI가 분석한 소비 성향입니다.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
                    {SPENDING_TYPES.map((type) => (
                        <div 
                            key={type.id} 
                            onClick={() => setSelectedAnalysis(type.id)}
                            className={`p-5 rounded-2xl border-2 transition-all cursor-pointer ${
                                selectedAnalysis === type.id 
                                ? 'border-primary shadow-md bg-white dark:bg-zinc-900 scale-105' 
                                : 'border-transparent bg-white/50 dark:bg-zinc-800/50 hover:bg-white/80'
                            }`}
                        >
                            <div className={`w-14 h-14 rounded-xl flex items-center justify-center bg-gradient-to-br ${type.color} bg-opacity-20 mb-4 mx-auto`}>
                                <div className="bg-white dark:bg-zinc-900 p-2 rounded-lg shadow-sm">
                                    {type.icon}
                                </div>
                            </div>
                            <h4 className="font-bold text-center mb-2">{type.name}</h4>
                            <div className="flex justify-center">
                                {selectedAnalysis === type.id && <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-1 rounded-full">나의 유형</span>}
                            </div>
                        </div>
                    ))}
                </div>

                {/* 선택된 유형 상세 설명 */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 md:p-8 shadow-sm">
                    {SPENDING_TYPES.filter(t => t.id === selectedAnalysis).map(type => (
                        <div key={type.id} className="flex flex-col md:flex-row gap-8 items-center md:items-start">
                            <div className="md:w-1/3 flex flex-col items-center text-center pb-6 md:pb-0 md:border-r border-border">
                                <div className={`w-24 h-24 rounded-2xl flex items-center justify-center bg-gradient-to-br ${type.color} mb-4 text-white shadow-lg`}>
                                    {React.cloneElement(type.icon, { className: 'w-12 h-12 text-white' } as any)}
                                </div>
                                <h2 className="text-2xl font-black mb-1">{type.name}</h2>
                                <p className="text-sm text-muted-foreground">{selectedAnalysis === type.id ? '최근 3개월간 가장 많이 관찰된 패턴입니다.' : '다른 소비 성향 알아보기'}</p>
                            </div>
                            <div className="md:w-2/3 space-y-6">
                                <div>
                                    <h4 className="text-sm font-bold text-muted-foreground mb-2 flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary"></div> 특징</h4>
                                    <p className="text-base leading-relaxed tracking-tight">{type.desc}</p>
                                </div>
                                <div className="bg-primary/5 p-5 rounded-xl border border-primary/10">
                                    <h4 className="text-sm font-bold text-primary mb-2 flex items-center gap-2"><Zap className="w-4 h-4"/> 맞춤 금융 조언</h4>
                                    <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{type.advice}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

