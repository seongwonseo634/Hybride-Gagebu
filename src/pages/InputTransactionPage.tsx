import React, { useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { doc, setDoc, getDoc, updateDoc, arrayUnion, arrayRemove, getDocsFromCache, collection, query } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, handleFirestoreError, OperationType, serverTimestamp } from '../lib/firebase';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Camera, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import imageCompression from 'browser-image-compression';

export default function InputTransactionPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const groupId = searchParams.get('groupId');
  
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('식비');
  const [customCategory, setCustomCategory] = useState('');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('카드');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  
  const [activeTab, setActiveTab] = useState('manual');
  const [isProcessing, setIsProcessing] = useState(false);
  const [customExpenseCategories, setCustomExpenseCategories] = useState<string[]>([]);
  const [customIncomeCategories, setCustomIncomeCategories] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processReceipt = async (file: File) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('지원하지 않는 파일 형식입니다. JPEG, PNG, WEBP만 가능합니다.');
      return;
    }
    setReceiptFile(file); // Ensure file is set
    setIsProcessing(true);
    toast.info('영수증 분석 중...');
    try {
      const options = { maxSizeMB: 0.1, maxWidthOrHeight: 600 };
      const compressedFile = await imageCompression(file, options);
      const buffer = await compressedFile.arrayBuffer();
      const base64 = btoa(new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));
      
      const res = await fetch('/api/ocr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          base64Data: base64,
          mimeType: file.type
        })
      });

      if (!res.ok) {
         const errorData = await res.json().catch(() => ({}));
         throw new Error(errorData.error || 'Network response was not ok');
      }

      const result = await res.json();
      
      if (result) {
        if (result.amount) setAmount(String(result.amount));
        if (result.description) setDescription(result.description);
        if (result.date) {
          // Validate date format slightly
          const dateMatch = result.date.match(/\d{4}-\d{2}-\d{2}/);
          if (dateMatch) setDate(dateMatch[0]);
        }
        
        const possibleCategory = result.category;
        if (expenseCategories.includes(possibleCategory)) {
          setCategory(possibleCategory);
        } else if (possibleCategory) {
          setCategory('직접 입력');
          setCustomCategory(possibleCategory);
        }
        
        setType('expense');
        setActiveTab('manual');
        toast.success('영수증 정보가 자동으로 입력되었습니다!');
      }
    } catch (error) {
      console.error('OCR Error:', error);
      toast.error(`영수증 처리에 실패했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const expenseCategories = ['식비', '교통/차량', '쇼핑/뷰티', '문화/여가', '건강/운동', '공과금/요금', '주거/통신', '교육', '경조사', ...customExpenseCategories, '직접 입력'];
  const incomeCategories = ['월급', '부수입', '용돈', '상여금', '이자수익', ...customIncomeCategories, '직접 입력'];
  const paymentMethods = ['현금', '카드', '상품권', '이체', '기타'];

  React.useEffect(() => {
    if (!user) return;
    const fetchCategories = async () => {
      try {
        // Try cache first for better offline experience
        try {
          const cacheSnap = await getDocsFromCache(query(collection(db, `users/${user.uid}/preferences/categories`)));
          if (!cacheSnap.empty) {
            const data = cacheSnap.docs[0].data();
            setCustomExpenseCategories(data.expense || []);
            setCustomIncomeCategories(data.income || []);
          }
        } catch (cacheErr) {
          // Ignore cache misses
        }

        const catDoc = await getDoc(doc(db, `users/${user.uid}/preferences/categories`));
        if (catDoc.exists()) {
          const data = catDoc.data();
          setCustomExpenseCategories(data.expense || []);
          setCustomIncomeCategories(data.income || []);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}/preferences/categories`);
      }
    };
    fetchCategories();
  }, [user]);

  const handleDeleteCategory = async (cat: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    
    // Optimistic UI update
    if (type === 'expense') {
      setCustomExpenseCategories(prev => prev.filter(c => c !== cat));
      if (category === cat) setCategory('식비');
    } else {
      setCustomIncomeCategories(prev => prev.filter(c => c !== cat));
      if (category === cat) setCategory('월급');
    }

    try {
      const catRef = doc(db, `users/${user.uid}/preferences/categories`);
      await updateDoc(catRef, {
        [type]: arrayRemove(cat)
      });
      toast.success('카테고리가 삭제되었습니다.');
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    console.log('handleSubmit START. isProcessing:', isProcessing);
    if (isProcessing) {
        console.log('Already processing, returning.');
        return; // Prevent multiple submissions
    }
    if (!user) {
        console.log('User not found, returning.');
        return;
    }
    if (!amount || isNaN(Number(amount))) {
        console.log('Validation failed');
        return toast.error('올바른 금액을 입력하세요');
    }
    
    console.log('Validation passed, processing:', { amount, category, receiptFile: !!receiptFile });
    const finalCategory = category === '직접 입력' ? customCategory || '기타' : category;

    setIsProcessing(true);
    console.log('isProcessing set to true.');
    try {
        console.log('Processing submission, starting upload/save');
        if (category === '직접 입력' && customCategory) {
        const catRef = doc(db, `users/${user.uid}/preferences/categories`);
        await setDoc(catRef, {
          [type]: arrayUnion(customCategory)
        }, { merge: true });
        
        // update local state
        if (type === 'expense') setCustomExpenseCategories(p => [...p, customCategory]);
        else setCustomIncomeCategories(p => [...p, customCategory]);
      }

      const txId = Date.now().toString() + Math.random().toString(36).substring(2, 11);
      let receiptUrl = '';

      const withTimeout = async <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
        return Promise.race([
          promise,
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms/1000}s`)), ms))
        ]);
      };

      if (receiptFile) {
        console.log('Uploading receipt...');
        toast.info('영수증 이미지 업로드 중...');
        try {
          const options = { maxSizeMB: 0.1, maxWidthOrHeight: 600 };
          const compressedFile = await imageCompression(receiptFile, options);
          const receiptRef = ref(storage, `users/${user.uid}/receipts/${txId}`);
          
          await withTimeout(uploadBytes(receiptRef, compressedFile), 15000, 'Storage upload');
          receiptUrl = await withTimeout(getDownloadURL(receiptRef), 5000, 'Get download URL');
          console.log('Receipt uploaded, url:', receiptUrl);
          toast.success('영수증 업로드 완료!');
        } catch (e: any) {
          console.error('Receipt upload failed, continuing without receipt:', e);
          toast.warning('영수증 업로드에 실패했습니다. 내역만 저장합니다.');
        }
      }

      const txData = {
        amount: Number(amount),
        type,
        category: finalCategory,
        date,
        description,
        ...(type === 'expense' && { paymentMethod }),
        ...(receiptUrl && { receiptUrl }),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      console.log('Saving transaction...');
      toast.info('내역 저장 중...');
      const collectionPath = groupId ? `groups/${groupId}/transactions` : `users/${user.uid}/transactions`;
      // Reduced timeout for firestore save
      await withTimeout(setDoc(doc(db, collectionPath, txId), txData), 15000, 'Firestore save');
      console.log('Transaction saved successfully.');

      toast.success('내역이 성공적으로 저장되었습니다!');
      console.log('Navigating to /');
      navigate('/');
    } catch (error) {
      console.error('Submission error:', error);
      const handled = handleFirestoreError(error, OperationType.CREATE, 'transactions');
      if (handled) {
        toast.success('오프라인 상태입니다. 내역이 임시 저장되었으며 연결 시 동기화됩니다!');
        navigate('/');
      } else {
        toast.error('내역 저장 중 오류가 발생했습니다.');
      }
    } finally {
      setIsProcessing(false);
      console.log('isProcessing set to false. Finished processing.');
    }
  };

  return (
    <div className="p-3 flex flex-col min-h-full animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex justify-between items-center mb-4 px-1">
        <h2 className="text-xl font-bold tracking-tight">내역 추가</h2>
        <Button onClick={() => navigate(-1)} variant="ghost" className="text-sm font-bold text-emerald-600">
           &lt;- 이전으로
        </Button>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4 h-10 neo-inset bg-transparent border-none p-1 rounded-xl">
          <TabsTrigger value="manual" className="rounded-lg data-[state=active]:neo data-[state=active]:bg-emerald-500 data-[state=active]:text-white transition-all font-bold text-sm">직접 추가/수정</TabsTrigger>
          <TabsTrigger value="ai" className="rounded-lg data-[state=active]:neo data-[state=active]:bg-emerald-500 data-[state=active]:text-white transition-all font-bold text-sm gap-2">
            <Camera className="w-4 h-4"/> 영수증 스캔
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="manual" className="mt-0">
          <form onSubmit={handleSubmit} className="space-y-4 px-1">
            <div className="flex neo-inset p-1 rounded-xl">
              <button
                type="button"
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${type === 'expense' ? 'neo text-emerald-600' : 'text-muted-foreground'}`}
                onClick={() => {
                  setType('expense');
                  setCategory('식비');
                }}
              >
                지출
              </button>
              <button
                type="button"
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${type === 'income' ? 'neo text-emerald-600' : 'text-muted-foreground'}`}
                onClick={() => {
                  setType('income');
                  setCategory('월급');
                }}
              >
                수입
              </button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount" className="font-bold text-sm text-muted-foreground">금액</Label>
              <Input 
                id="amount" 
                type="number" 
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="0" 
                className="text-xl h-10 font-extrabold tracking-tighter text-center neo-inset border-none bg-transparent" 
                value={amount}
                onChange={e => setAmount(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="date" className="font-bold text-sm text-muted-foreground">날짜</Label>
                <Input 
                  id="date" 
                  type="date" 
                  value={date}
                  className="neo-inset h-10 border-none bg-transparent font-medium"
                  onChange={e => setDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-sm text-muted-foreground">카테고리</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="neo-inset h-10 border-none bg-transparent font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="neo border-none max-h-60">
                    {(type === 'expense' ? expenseCategories : incomeCategories).map(cat => {
                      const isCustom = (type === 'expense' ? customExpenseCategories : customIncomeCategories).includes(cat);
                      return (
                        <SelectItem key={cat} value={cat} className="font-medium flex justify-between items-center group">
                          <span>{cat}</span>
                          {isCustom && (
                            <div 
                              className="ml-2 text-muted-foreground hover:text-brand-coral z-10 p-1 flex items-center justify-center cursor-pointer opacity-70 hover:opacity-100 text-xs w-6 h-6"
                              onClick={(e) => handleDeleteCategory(cat, e)}
                              onPointerDown={(e) => e.stopPropagation()}
                            >
                              ✕
                            </div>
                          )}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {category === '직접 입력' && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                <Label htmlFor="customCat" className="font-bold text-sm text-muted-foreground">나만의 카테고리 이름 입력</Label>
                <Input 
                  id="customCat" 
                  placeholder="카테고리명 입력" 
                  className="neo-inset h-10 border-none bg-transparent font-medium"
                  value={customCategory}
                  onChange={e => setCustomCategory(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                 <Label htmlFor="desc" className="font-bold text-sm text-muted-foreground">내용 / 사용처</Label>
                 <Button type="button" size="sm" onClick={async () => {
                    if (!description) return;
                    setIsProcessing(true);
                    try {
                        const res = await fetch('/api/categorize', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ description })
                        });
                        if (!res.ok) throw new Error('Failed to categorize');
                        const data = await res.json();
                        if (data.category) setCategory(data.category);
                        else toast.error('카테고리를 분류할 수 없습니다.');
                    } catch (e) {
                        toast.error('분류 실패');
                    } finally {
                        setIsProcessing(false);
                    }
                 }} className="text-xs h-6 px-2 neo-button bg-emerald-500 text-white border-none">AI 자동 분류</Button>
              </div>
              <Input 
                id="desc" 
                placeholder="예: 편의점, 택시, 월급..." 
                className="neo-inset h-10 border-none bg-transparent font-medium"
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>

            {type === 'expense' && (
              <div className="flex items-center space-x-4 mt-2">
                <Label className="font-bold text-sm text-muted-foreground whitespace-nowrap">결제 수단</Label>
                <div className="flex-1">
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger className="neo-inset h-10 border-none bg-transparent font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="neo border-none">
                      {paymentMethods.map(method => (
                        <SelectItem key={method} value={method} className="font-medium cursor-pointer">
                          {method}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <Button type="submit" disabled={isProcessing} className="w-full h-10 mt-2 text-base font-bold neo-button bg-emerald-500 text-white border-none rounded-xl">
              {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : '저장하기'}
            </Button>
          </form>
        </TabsContent>
        <TabsContent value="ai" className="mt-0 space-y-4 px-1">
          <div className="neo p-4 md:p-6 rounded-2xl">
            <div className="flex flex-col items-center justify-center space-y-4 text-center py-4">
              <div className="w-16 h-16 neo-inset rounded-full flex items-center justify-center text-primary mb-2">
                <Camera className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="font-bold text-lg">자동 영수증 입력</h3>
                <p className="text-sm font-medium text-muted-foreground w-4/5 mx-auto leading-relaxed">
                  영수증 사진을 찍어주시면 AI가 세부 내역을 파악하여 대신 입력해 드립니다.
                </p>
              </div>
              <input 
                type="file" 
                accept="image/*" 
                capture="environment" 
                className="hidden" 
                ref={fileInputRef}
                onChange={(e) => {
                  if (e.target.files?.[0]) processReceipt(e.target.files[0]);
                }}
              />
              <Button onClick={() => fileInputRef.current?.click()} disabled={isProcessing} className="mt-4 w-full h-12 font-bold text-sm flex items-center justify-center neo-button bg-emerald-500 text-white hover:bg-emerald-600">
                {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Camera className="w-4 h-4 mr-2" />}
                휴대폰 카메라 또는 앨범 열기
              </Button>
            </div>
          </div>
        </TabsContent>
        {/* AI tab removed */}
      </Tabs>
    </div>
  );
}
