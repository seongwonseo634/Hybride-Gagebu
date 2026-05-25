import React, { useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, logoutUser, handleFirestoreError, OperationType } from '../lib/firebase';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Power, Settings as SettingsIcon, Bell, CircleHelp, Download, Upload, FileSpreadsheet, Loader2, Layers, Trash2, Plus, SlidersHorizontal, Megaphone, Target, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collection, query, getDocs, writeBatch, doc, getDoc, setDoc, arrayUnion, arrayRemove, onSnapshot, addDoc, serverTimestamp, deleteDoc, where, getDocsFromCache } from 'firebase/firestore';
import { toast } from 'sonner';
import { format, subMonths } from 'date-fns';
import { HelpContent } from '../components/HelpDialog';
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { useTheme } from '../components/ThemeProvider';
import { Slider } from '../components/ui/slider';
import { sendNotificationToUser, SystemNotification } from '../lib/adminNotifications';
import { Goal } from '../types';

export default function SettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { uiOpacity, setUiOpacity } = useTheme();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const promptDialogRef = useRef<string>('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
  const [categories, setCategories] = useState<{ expense: string[], income: string[] }>({ expense: [], income: [] });
  const [newCatName, setNewCatName] = useState('');
  const [catType, setCatType] = useState<'expense'|'income'>('expense');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [newGoal, setNewGoal] = useState({ name: '', target: '', current: '' });
  const [goals, setGoals] = useState<Goal[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<{isOpen: boolean, title: string, onConfirm: () => void} | null>(null);
  const [promptDialog, setPromptDialog] = useState<{
      isOpen: boolean, 
      title: string, 
      value: string, 
      setValue: (v: string) => void, 
      onConfirm: () => void
  } | null>(null);

  React.useEffect(() => {
    console.log('[DEBUG] SettingsPage loaded', { user });
    if (!user) console.warn('[DEBUG] No user object in SettingsPage');
  }, [user]);

  // Admin Notification States
  const [adminTitle, setAdminTitle] = useState('');
  const [adminMessage, setAdminMessage] = useState('');
  const [adminType, setAdminType] = useState<SystemNotification['type']>('info');

  const handleSendAdminNotification = async () => {
    if (user?.email !== 'seongwonseo634@gmail.com') {
      toast.error('권한이 없습니다.');
      return;
    }
    if (!adminTitle || !adminMessage) {
        toast.error('제목과 내용을 입력해주세요');
        return;
    }
    try {
        await sendNotificationToUser(user.uid, { title: adminTitle, message: adminMessage, type: adminType });
        toast.success('알림이 발송되었습니다.');
        setAdminTitle('');
        setAdminMessage('');
    } catch (e) {
        toast.error('알림 발송 실패');
    }
  };

  const handleClearNotifications = async () => {
    if (!user) return;
    try {
        const batch = writeBatch(db);
        notifications.forEach(n => {
            if (n.read) {
                batch.delete(doc(db, `users/${user.uid}/notifications`, n.id));
            }
        });
        await batch.commit();
        toast.success('읽은 알림이 삭제되었습니다.');
    } catch (e) {
        toast.error('알림 삭제 실패');
    }
  };

  React.useEffect(() => {
    if (!user) return;
    const fetchCategories = async () => {
      try {
        // Try cache first for better offline experience
        let catDoc;
        try {
          catDoc = await getDocsFromCache(query(collection(db, `users/${user.uid}/preferences/categories`)));
          if (!catDoc.empty) {
            setCategories(catDoc.docs[0].data() as any);
          }
        } catch (cacheErr) {
          // Cache miss or error, falls through to server fetch
        }

        const catSnap = await getDoc(doc(db, `users/${user.uid}/preferences/categories`));
        if (catSnap.exists()) {
          setCategories(catSnap.data() as any);
        }
      } catch (e) {
        handleFirestoreError(e, OperationType.GET, `users/${user.uid}/preferences/categories`);
      }
    };
    fetchCategories();
    
    // Fetch goals
    const qGoals = query(collection(db, `users/${user.uid}/goals`));
    const unsubscribeGoals = onSnapshot(qGoals, (snapshot) => {
        const gs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Goal[];
        setGoals(gs);
    });

    const q = query(collection(db, `users/${user.uid}/notifications`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs: any[] = [];
      snapshot.forEach(doc => {
        notifs.push({ id: doc.id, ...doc.data() });
      });
      notifs.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setNotifications(notifs);
    });

    return () => {
        unsubscribe();
        unsubscribeGoals();
    };
  }, [user]);

  const markAsRead = async (id: string) => {
    if (!user) return;
    try {
      await setDoc(doc(db, `users/${user.uid}/notifications`, id), { read: true }, { merge: true });
    } catch (e) {
      console.error(e);
    }
  };

  const unreads = notifications.filter(n => !n.read).length;

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newCatName.trim()) return;
    try {
      const catRef = doc(db, `users/${user.uid}/preferences/categories`);
      await setDoc(catRef, { [catType]: arrayUnion(newCatName.trim()) }, { merge: true });
      setCategories(prev => ({ ...prev, [catType]: [...(prev[catType] || []), newCatName.trim()] }));
      setNewCatName('');
      toast.success('카테고리가 추가되었습니다.');
    } catch (err) {
      console.error(err);
      toast.error('추가에 실패했습니다.');
    }
  };

  const handleAddGoal = async () => {
      if (!user || !newGoal.name || !newGoal.target || !newGoal.current) {
          toast.error('모든 항목을 입력해주세요.');
          return;
      }
      try {
          await addDoc(collection(db, `users/${user.uid}/goals`), {
              name: newGoal.name,
              targetAmount: Number(newGoal.target),
              currentAmount: Number(newGoal.current),
              createdAt: serverTimestamp()
          });
          setNewGoal({ name: '', target: '', current: '' });
          toast.success('목표가 추가되었습니다.');
      } catch (err) {
          console.error(err);
          toast.error('목표 추가에 실패했습니다.');
      }
  };

  const handleUpdateGoal = (goal: Goal) => {
      promptDialogRef.current = goal.currentAmount.toString();
      setPromptDialog({
          isOpen: true,
          title: `${goal.name}의 현재 금액을 입력하세요 (원 단위)`,
          value: promptDialogRef.current,
          setValue: (val) => {
              promptDialogRef.current = val;
              setPromptDialog(prev => prev ? {...prev, value: val} : null);
          },
          onConfirm: async () => {
              const numAmount = Number(promptDialogRef.current);
              if (isNaN(numAmount)) {
                  toast.error('올바른 숫자를 입력해주세요.');
                  return;
              }
              try {
                  await setDoc(doc(db, `users/${user!.uid}/goals`, goal.id), {
                      ...goal,
                      currentAmount: numAmount
                  });
                  toast.success('목표가 업데이트되었습니다.');
                  setPromptDialog(null);
                  promptDialogRef.current = '';
              } catch (e) {
                  console.error('Update error:', e);
                  toast.error('업데이트에 실패했습니다.');
              }
          }
      });
  };

  const handleDeleteGoal = async (id: string) => {
      setConfirmDialog({
          isOpen: true,
          title: "정말로 이 목표를 삭제하시겠습니까?",
          onConfirm: async () => {
              try {
                  await deleteDoc(doc(db, `users/${user!.uid}/goals`, id));
                  toast.success('목표가 삭제되었습니다.');
                  setConfirmDialog(null);
              } catch (e) {
                  console.error('Delete error:', e);
                  toast.error('삭제에 실패했습니다.');
              }
          }
      });
  };

  const handleDeleteCategory = async (type: 'expense'|'income', catName: string) => {
    if (!user) return;
    
    // 사용자에게 한 번 더 물어보기
    if (!window.confirm(`정말로 '${catName}' 항목을 삭제하시겠습니까?\n(기존 거래 내역은 유지됩니다)`)) {
      return; // 취소를 누르면 함수 종료
    }

    try {
      const catRef = doc(db, `users/${user.uid}/preferences/categories`);
      await setDoc(catRef, { [type]: arrayRemove(catName) }, { merge: true });
      setCategories(prev => ({ ...prev, [type]: (prev[type] || []).filter(c => c !== catName) }));
      toast.success(`'${catName}' 카테고리가 삭제되었습니다.`);
    } catch (err) {
      console.error(err);
      toast.error('삭제에 실패했습니다.');
    }
  };

  const handleResetData = async () => {
    if (!user) return;
    if (!window.confirm('경고: 모든 거래 내역, 예산, 자산 데이터가 영구적으로 삭제됩니다. 계속하시겠습니까?')) {
      return;
    }
    
    setIsSyncing(true);
    toast.info('데이터 초기화 중...');
    
    try {
      const collectionsToClear = [
        `users/${user.uid}/transactions`,
        `users/${user.uid}/budgets`,
        `users/${user.uid}/assets`,
        `users/${user.uid}/challenges`,
        `users/${user.uid}/recurring`,
        `users/${user.uid}/goals`
      ];
      
      for (const colPath of collectionsToClear) {
        const q = query(collection(db, colPath));
        const snap = await getDocs(q);
        const batch = writeBatch(db);
        snap.forEach(d => batch.delete(doc(db, colPath, d.id)));
        await batch.commit();
      }
      
      toast.success('모든 데이터가 성공적으로 초기화되었습니다.');
    } catch (e) {
      console.error(e);
      toast.error('데이터 초기화 중 오류가 발생했습니다.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    navigate('/login');
  };

  const [exportStartDate, setExportStartDate] = useState(format(subMonths(new Date(), 120), 'yyyy-MM-dd'));
  const [exportEndDate, setExportEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  const handleExport = async () => {
    if (!user) return;
    try {
      toast.info('데이터를 준비 중입니다...');
      const q = query(collection(db, `users/${user.uid}/transactions`));
      const snap = await getDocs(q);
      const headers = ['id', 'date', 'type', 'category', 'description', 'amount'];
      
      const rows: string[] = [];
      snap.forEach(document => {
        const data = document.data();
        if (data.date >= exportStartDate && data.date <= exportEndDate) {
            rows.push(headers.map(h => {
              let v = h === 'id' ? document.id : data[h];
              return `"${String(v || '').replace(/"/g, '""')}"`;
            }).join(','));
        }
      });
      
      if (rows.length === 0) {
          toast.warning('선택한 기간에 해당하는 데이터가 없습니다.');
          return;
      }
      
      const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(','), ...rows].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `가계부_연동데이터_${exportStartDate}_${exportEndDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('CSV 파일이 다운로드 되었습니다.');
    } catch (e) {
      console.error(e);
      toast.error('내보내기 중 오류가 발생했습니다.');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isSyncing) return;
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    setIsSyncing(true);
    setSyncProgress({ current: 0, total: 0 });
    toast.info('데이터 분석을 시작합니다...');
    
    try {
      const text = await file.text();
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length <= 1) {
        toast.error('가져올 데이터가 없습니다. 헤더만 있는 파일이거나 빈 파일입니다.');
        setIsSyncing(false);
        return;
      }
      
      const totalToProcess = lines.length - 1;
      setSyncProgress({ current: 0, total: totalToProcess });

      // Move parsing logic outside to keep loop tight
      const parseCSVRow = (str: string) => {
          const result = [];
          let cur = '';
          let inQuote = false;
          for (let i = 0; i < str.length; i++) {
              if (str[i] === '"') {
                if (inQuote && str[i+1] === '"') {
                  cur += '"'; // escaped quote
                  i++;
                } else {
                  inQuote = !inQuote;
                }
              }
              else if (str[i] === ',' && !inQuote) { result.push(cur); cur = ''; }
              else cur += str[i];
          }
          result.push(cur);
          return result.map(v => v.replace(/^"|"$/g, '').trim());
      };

      const rawHeaders = parseCSVRow(lines[0]);
      // Fuzzy header mapping
      const headerMap: { [key: string]: number } = {};
      const mappings: { [key: string]: string[] } = {
        id: ['id', 'ID', '식별자', '코드'],
        date: ['date', 'Date', '날짜', '일자', '일시'],
        type: ['type', 'Type', '구분', '종류', '유형'],
        category: ['category', 'Category', '분류', '카테고리', '항목'],
        description: ['description', 'Description', '내용', '메모', '비고', '항목명'],
        amount: ['amount', 'Amount', '금액', '합계', '가액']
      };

      rawHeaders.forEach((h, idx) => {
        for (const [key, aliases] of Object.entries(mappings)) {
          if (aliases.some(a => h.toLowerCase().includes(a.toLowerCase()))) {
            headerMap[key] = idx;
            break;
          }
        }
      });

      // Validating required headers
      if (headerMap.date === undefined || headerMap.amount === undefined) {
        toast.error('필수 열(날짜, 금액)을 찾을 수 없습니다. CSV 헤더를 확인해주세요.');
        setIsSyncing(false);
        return;
      }
      
      let batch = writeBatch(db);
      let count = 0;
      let totalCount = 0;
      let skipped = 0;

      // Process in smaller chunks to ensure Firebase limits aren't hit and UI stays smooth
      const CHUNK_SIZE = 25; 
      
      for (let i = 1; i < lines.length; i++) {
        try {
          // Always update progress so the UI doesn't look frozen
          setSyncProgress({ current: i, total: totalToProcess });
          
          const row = parseCSVRow(lines[i]);
          
          if (row.length < 2) {
            skipped++;
            continue;
          }
          
          const getValue = (key: string) => headerMap[key] !== undefined ? row[headerMap[key]] : '';
          
          const dateRaw = getValue('date');
          const normalizeDate = (d: string) => {
            if (!d) return '';
            if (d.includes('T')) return d.split('T')[0];
            
            let normalized = d.replace(/[\/\.]/g, '-');
            const parts = normalized.split('-');
            
            if (parts.length === 3) {
              let year = '', month = '', day = '';
              if (parts[0].length === 4) {
                year = parts[0];
                month = parts[1].padStart(2, '0');
                day = parts[2].padStart(2, '0');
              } else if (parts[2].length === 4) {
                year = parts[2];
                month = parts[0].padStart(2, '0');
                day = parts[1].padStart(2, '0');
              } else if (parts[0].length === 2 && parts[2].length === 2) {
                 year = '20' + parts[0];
                 month = parts[1].padStart(2, '0');
                 day = parts[2].padStart(2, '0');
              }
              if (year && month && day) return `${year}-${month}-${day}`;
            }
            return normalized;
          };
          
          const date = normalizeDate(dateRaw);
          const amountStr = String(getValue('amount')).replace(/[^0-9.-]/g, '');
          const amount = Number(amountStr);

          if (!date || isNaN(amount)) {
            skipped++;
            continue;
          }

          // Robust ID generation - use hash of content to avoid duplicates
          let id = getValue('id');
          if (!id) {
            const seed = `${date}-${amount}-${getValue('description')}`;
            id = `imp-${i}-${Date.now()}`;
          }

          const docRef = doc(db, `users/${user.uid}/transactions`, id);
          batch.set(docRef, {
            amount: Math.abs(amount),
            type: (getValue('type').toLowerCase().trim()) || (amount >= 1 ? 'income' : 'expense'),
            category: getValue('category') || '기타',
            description: getValue('description') || '',
            date: date,
            updatedAt: serverTimestamp()
          }, { merge: true });
          
          count++;
          totalCount++;

          if (count >= CHUNK_SIZE) { 
            await batch.commit();
            console.log(`Committed chunk at row ${i}`);
            batch = writeBatch(db);
            count = 0;
            // Short yield to UI
            await new Promise(resolve => setTimeout(resolve, 20));
          }
        } catch (rowErr) {
          console.warn(`Error processing row ${i}:`, rowErr);
          skipped++;
        }
      }

      // Final commit
      if (count > 0) {
        await batch.commit();
      }
      setSyncProgress({ current: totalToProcess, total: totalToProcess });
      
      toast.success(`${totalCount}건 동기화가 성공적으로 완료되었습니다! (건너뜀: ${skipped}건)`);
    } catch (err) {
      console.error(err);
      const handled = handleFirestoreError(err, OperationType.SYNC, 'import-csv');
      if (!handled) {
        toast.error('동기화 중 오류가 발생했습니다. CSV 파일 형식을 확인해주세요.');
      } else {
        toast.warning('네트워크 연결이 불안정합니다. 연결이 복구되면 동기화가 재개됩니다.');
      }
    } finally {
      setIsSyncing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="p-4 space-y-6 pb-12">
      <Button onClick={() => navigate('/')} variant="ghost" className="text-sm font-bold text-emerald-600 mb-2">
           &lt;- 이전으로
      </Button>
      <h2 className="text-2xl font-bold tracking-tight mb-6 px-1">설정</h2>
      
      <div className="neo p-6 rounded-2xl mb-8 mt-4">
        <div className="flex items-center space-x-5">
          <Avatar className="w-20 h-20 neo-inset p-1 ring-4 ring-primary/20">
            <AvatarImage src={user?.photoURL || ''} className="rounded-full" />
            <AvatarFallback className="text-xl font-bold rounded-full bg-transparent">{user?.displayName?.charAt(0) || 'U'}</AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <h3 className="text-xl font-extrabold">{user?.displayName || 'User'}</h3>
            <p className="text-sm font-bold text-muted-foreground">{user?.email}</p>
          </div>
        </div>
        <Button 
          onClick={async () => {
            if (!user) return;
            setIsSyncing(true);
            toast.info('데이터를 정밀 진단 중입니다...', { duration: 3000 });
            try {
              // 1. Check current personal collection
              const currentRef = collection(db, `users/${user.uid}/transactions`);
              let currentSnap;
              try {
                currentSnap = await getDocs(currentRef);
              } catch (e: any) {
                console.warn('Diagnosis server fetch failed, trying cache:', e);
                try {
                  currentSnap = await getDocsFromCache(currentRef);
                  toast.info('네트워크 연결이 불안정하여 캐시된 데이터를 확인합니다.');
                } catch (cacheErr) {
                  throw new Error('데이터를 불러올 수 없습니다. 온라인 상태에서 다시 시도해 주세요.');
                }
              }
              const personalCount = currentSnap.size;
              
              // 2. Check legacy root collection
              let legacyCount = 0;
              try {
                const legacyRef = query(collection(db, 'transactions'), where('userId', '==', user.uid));
                let legacySnap;
                try {
                  legacySnap = await getDocs(legacyRef);
                } catch (e) {
                  legacySnap = await getDocsFromCache(legacyRef);
                }
                legacyCount = legacySnap.size;
                
                if (legacyCount > 0) {
                   let batch = writeBatch(db);
                   let bCount = 0;
                   const docs = legacySnap.docs;
                   for (const ldoc of docs) {
                      const data = ldoc.data();
                      const newRef = doc(db, `users/${user.uid}/transactions`, ldoc.id);
                      batch.set(newRef, { ...data, updatedAt: new Date() }, { merge: true });
                      bCount++;
                      if (bCount >= 400) {
                        await batch.commit();
                        batch = writeBatch(db);
                        bCount = 0;
                      }
                   }
                   if (bCount > 0) await batch.commit();
                   toast.success(`${legacyCount}개의 이전 데이터를 현재 위치로 성공적으로 복구했습니다!`);
                }
              } catch (e) {
                console.log('Legacy scan skipped or failed');
              }

              // 3. NEW: Check all groups the user belongs to and INTEGRATE them
              let groupTransactionCount = 0;
              let foundGroupDetails = "";
              try {
                const groupsRef = query(collection(db, 'groups'), where('members', 'array-contains', user.uid));
                const groupsSnap = await getDocs(groupsRef);
                
                for (const gDoc of groupsSnap.docs) {
                  const gTxsRef = collection(db, `groups/${gDoc.id}/transactions`);
                  const gTxsSnap = await getDocs(gTxsRef);
                  if (gTxsSnap.size > 0) {
                    groupTransactionCount += gTxsSnap.size;
                    foundGroupDetails += `\n- ${gDoc.data().name || gDoc.id}: ${gTxsSnap.size}건`;
                    
                    // Actually move/copy them!
                    let batch = writeBatch(db);
                    let bCount = 0;
                    for (const gtx of gTxsSnap.docs) {
                        const data = gtx.data();
                        const newRef = doc(db, `users/${user.uid}/transactions`, gtx.id);
                        batch.set(newRef, { ...data, updatedAt: serverTimestamp() }, { merge: true });
                        bCount++;
                        if (bCount >= 400) {
                            await batch.commit();
                            batch = writeBatch(db);
                            bCount = 0;
                        }
                    }
                    if (bCount > 0) await batch.commit();
                  }
                }
              } catch (e) {
                console.log('Group scan failed');
              }

              const total = personalCount + legacyCount + groupTransactionCount;

              if (total === 0) {
                 toast.warning('검색된 데이터가 전혀 없습니다. CSV 파일(백업)이 있다면 다시 가져오기를 해주세요.');
              } else {
                 let msg = `진단 완료: 총 ${total}개의 데이터를 확인했습니다.\n- 개인 내역: ${personalCount + legacyCount}건`;
                 if (groupTransactionCount > 0) {
                   msg += foundGroupDetails;
                   toast.info('데이터가 다른 경로(모임)에 저장되어 있었습니다. 자동으로 개인 내역으로 통합을 시도합니다.');
                 }
                 toast.success(msg, { duration: 5000 });
              }
            } catch (err: any) {
              console.error(err);
              const errMsg = err.message || String(err);
              if (errMsg.toLowerCase().includes('offline') || errMsg.toLowerCase().includes('failed to get document')) {
                toast.error('현재 오프라인 상태이거나 네트워크 연결이 끊겼습니다. 온라인 상태에서 다시 시도해 주세요.');
              } else {
                toast.error(`진단 중 오류가 발생했습니다: ${errMsg}`);
              }
            } finally {
              setIsSyncing(false);
            }
          }}
          disabled={isSyncing}
          className="w-full neo-button bg-transparent !text-emerald-600 font-bold border border-emerald-600/20"
        >
          데이터 정밀 진단 및 자동 복구
        </Button>
      </div>

      <div className="neo p-5 rounded-2xl space-y-4">
        <h3 className="font-bold flex items-center text-lg text-primary">
          <Activity className="w-5 h-5 mr-2" /> 모임 데이터 연결 활성화
        </h3>
        <p className="text-xs text-muted-foreground font-medium leading-relaxed">
          초대 받은 모임 ID를 직접 입력하여 가입 상태를 복구하거나 연결할 수 있습니다.
        </p>
        <div className="flex gap-2">
          <input 
             type="text" 
             placeholder="모임 ID 입력" 
             id="manual-id"
             className="flex-1 neo-inset rounded-lg p-2 text-xs font-mono bg-transparent" 
          />
          <Button 
            onClick={async () => {
              const id = (document.getElementById('manual-id') as HTMLInputElement).value.trim();
              if (id) {
                navigate(`/groups/${id}`);
                toast.success('모임 페이지로 이동합니다.');
              }
            }}
            className="neo-button h-10 bg-brand-blue text-white text-xs px-4"
          >
            이동
          </Button>
        </div>
      </div>

      <div className="neo p-5 rounded-2xl space-y-4">
        <h3 className="font-bold flex items-center text-lg text-primary">
          <FileSpreadsheet className="w-5 h-5 mr-2" /> 구글 스프레드시트 연동
        </h3>
        <p className="text-xs text-muted-foreground font-medium leading-relaxed">
          데이터를 CSV 파일로 다운로드하여 구글 스프레드시트나 엑셀에서 바로 편집할 수 있습니다. 수정한 파일을 다시 업로드하면 내역(추가/수정/삭제)이 앱에 자동 반영됩니다.
        </p>
        <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">시작일</label>
                <input type="date" value={exportStartDate} onChange={(e) => setExportStartDate(e.target.value)} className="w-full neo-inset rounded-lg p-2 text-sm font-medium bg-transparent" />
            </div>
            <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">종료일</label>
                <input type="date" value={exportEndDate} onChange={(e) => setExportEndDate(e.target.value)} className="w-full neo-inset rounded-lg p-2 text-sm font-medium bg-transparent" />
            </div>
        </div>
        <div className="grid grid-cols-2 gap-3 pt-2">
                    <Button onClick={handleExport} disabled={isSyncing} className="neo-button h-12 bg-transparent border border-emerald-600/20 !text-emerald-600 font-bold hover:bg-emerald-50">
             <Download className="w-4 h-4 mr-2" />
            내보내기
          </Button>
          <input 
            type="file" 
            accept=".csv" 
            className="hidden" 
            ref={fileInputRef}
            onChange={handleImport}
          />
                    <Button onClick={() => fileInputRef.current?.click()} disabled={isSyncing} className="neo-button h-12 bg-transparent border border-emerald-600/20 !text-emerald-600 font-bold hover:bg-emerald-50 relative overflow-hidden">
            {isSyncing ? (
              <>
                <div className="absolute inset-0 bg-brand-mint/20 animate-pulse" />
                <span className="relative z-10 flex items-center">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {syncProgress.current}/{syncProgress.total} 동기화 중...
                </span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                동기화 (업로드)
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="neo rounded-2xl overflow-hidden py-2 space-y-1 mt-6">
        <Dialog>
          <DialogTrigger className="w-full bg-transparent border-none p-4 flex items-center space-x-4 hover:opacity-80 transition-opacity cursor-pointer text-left">
            <div className="p-3 neo-inset text-primary rounded-xl">
              <Target className="w-6 h-6" />
            </div>
            <div className="flex-1 font-bold text-lg">미래 목표 관리</div>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md neo rounded-2xl border-none">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">미래 목표 관리</DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-6">
              {goals.map(goal => (
                <div key={goal.id} className="flex justify-between items-center p-3 neo-inset rounded-xl">
                  <div className="flex-1 cursor-pointer hover:opacity-80 transition-opacity" onClick={(e) => { e.stopPropagation(); handleUpdateGoal(goal); }}>
                    <p className="font-bold text-sm">{goal.name}</p>
                    <p className="text-xs text-muted-foreground">{Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100))}% 달성 (클릭하여 수정)</p>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteGoal(goal.id); }} className="p-2 ml-2 text-gray-400 hover:text-red-500 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <div className="space-y-4 pt-4 border-t">
                  <h4 className="font-bold text-sm text-primary">새로운 목표 추가</h4>
                  <input type="text" placeholder="목표 이름 (예: 오사카 여행 ✈️)" value={newGoal.name} onChange={(e) => setNewGoal({...newGoal, name: e.target.value})} className="w-full text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2 font-medium" />
                  <div className="flex gap-2">
                    <input type="number" placeholder="목표 금액 (원)" value={newGoal.target} onChange={(e) => setNewGoal({...newGoal, target: e.target.value})} className="flex-1 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2 font-medium" />
                    <input type="number" placeholder="현재 금액 (원)" value={newGoal.current} onChange={(e) => setNewGoal({...newGoal, current: e.target.value})} className="flex-1 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2 font-medium" />
                  </div>
                  <Button onClick={handleAddGoal} className="w-full text-white rounded-xl bg-primary hover:bg-primary/90">추가</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog>
          <DialogTrigger className="w-full bg-transparent border-none p-4 flex items-center space-x-4 hover:opacity-80 transition-opacity cursor-pointer text-left">
            <div className="p-3 neo-inset text-primary rounded-xl">
              <Layers className="w-6 h-6" />
            </div>
            <div className="flex-1 font-bold text-lg">카테고리 관리</div>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md neo rounded-2xl border-none max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">카테고리 관리</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
                <button
                  className={`flex-1 py-1.5 text-sm font-bold rounded-lg transition-all ${catType === 'expense' ? 'bg-white dark:bg-gray-700 shadow-sm text-brand-coral' : 'text-gray-500'}`}
                  onClick={() => setCatType('expense')}
                >지출</button>
                <button
                  className={`flex-1 py-1.5 text-sm font-bold rounded-lg transition-all ${catType === 'income' ? 'bg-white dark:bg-gray-700 shadow-sm text-brand-mint' : 'text-gray-500'}`}
                  onClick={() => setCatType('income')}
                >수입</button>
              </div>

              <form onSubmit={handleAddCategory} className="flex gap-2">
                <input
                  type="text"
                  placeholder="새 카테고리 이름"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="flex-1 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-primary/50"
                  required
                />
                <Button type="submit" size="icon" className="h-10 w-10 text-white rounded-xl bg-primary hover:bg-primary/90 shrink-0">
                  <Plus className="w-4 h-4" />
                </Button>
              </form>

              <div className="space-y-2">
                <p className="text-xs font-bold text-gray-500 mb-2">나만의 카테고리 (직접 추가한 항목만 표시됩니다)</p>
                {(!categories[catType] || categories[catType].length === 0) ? (
                  <p className="text-sm font-medium text-gray-400 py-4 text-center">추가된 커스텀 카테고리가 없습니다.</p>
                ) : (
                  categories[catType].map(cat => (
                    <div key={cat} className="flex justify-between items-center p-3 neo-inset rounded-xl">
                      <span className="font-bold text-sm">{cat}</span>
                      <button onClick={() => handleDeleteCategory(catType, cat)} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog>
          <DialogTrigger className="w-full bg-transparent border-none p-4 flex items-center space-x-4 hover:opacity-80 transition-opacity cursor-pointer text-left">
            <div className="p-3 neo-inset text-primary rounded-xl">
              <SlidersHorizontal className="w-6 h-6" />
            </div>
            <div className="flex-1 font-bold text-lg">디자인 설정</div>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md neo rounded-2xl border-none">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold mb-4">테마 및 UI 효과</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 py-4">
               <div className="bg-white/5 dark:bg-black/20 p-4 rounded-xl border border-black/5 dark:border-white/5">
                  <div className="flex justify-between items-center mb-6">
                     <div>
                       <span className="block text-sm font-bold text-foreground">패널 투명도 조절</span>
                       <span className="block text-xs text-muted-foreground mt-1">글래스모피즘 효과의 강도를 조절합니다.</span>
                     </div>
                     <span className="text-sm font-black text-primary bg-primary/10 px-2 py-1 rounded-md">{Math.round(uiOpacity * 100)}%</span>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-medium text-gray-400">투명</span>
                    <Slider 
                       value={[uiOpacity]} 
                       min={0.3} 
                       max={1} 
                       step={0.05} 
                       onValueChange={(val) => setUiOpacity(val as number)}
                       className="flex-1"
                    />
                    <span className="text-xs font-medium text-gray-400">선명</span>
                  </div>
               </div>
            </div>
          </DialogContent>
        </Dialog>

        <div className="p-4 flex items-center space-x-4 hover:opacity-80 transition-opacity cursor-pointer" onClick={() => toast.info('준비 중인 기능입니다.')}>
          <div className="p-3 neo-inset text-primary rounded-xl">
            <SettingsIcon className="w-6 h-6" />
          </div>
          <div className="flex-1 font-bold text-lg">계정 설정</div>
        </div>
        
        <Dialog>
          <DialogTrigger className="w-full bg-transparent border-none p-4 flex items-center space-x-4 hover:opacity-80 transition-opacity cursor-pointer text-left">
            <div className="p-3 neo-inset text-primary rounded-xl relative">
              <Bell className="w-6 h-6" />
              {unreads > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-brand-coral rounded-full" />
              )}
            </div>
            <div className="flex-1 font-bold text-lg">새로운 알림 {unreads > 0 ? `(${unreads})` : ''}</div>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md neo rounded-2xl border-none max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">알림 내역</DialogTitle>
            </DialogHeader>
            {notifications.some(n => n.read) && (
              <Button variant="ghost" className="w-full text-xs text-muted-foreground" onClick={handleClearNotifications}>읽은 알림 삭제</Button>
            )}
            <div className="space-y-4 py-4">
               {notifications.length === 0 ? (
                 <p className="text-sm font-medium text-gray-500 text-center py-8">새로운 알림이 없습니다.</p>
               ) : (
                 notifications.map(n => (
                   <div key={n.id} onClick={() => markAsRead(n.id)} className={`p-4 rounded-xl cursor-pointer transition-colors ${n.read ? 'bg-black/5 dark:bg-white/5' : 'bg-brand-mint/10 dark:bg-brand-mint/20 border border-brand-mint/30'}`}>
                     <p className="text-xs font-bold text-muted-foreground mb-1">{n.title}</p>
                     <p className="text-sm font-medium">{n.message}</p>
                   </div>
                 ))
               )}
            </div>
          </DialogContent>
        </Dialog>
        
        <Dialog>
          <DialogTrigger className="w-full bg-transparent border-none p-4 flex items-center space-x-4 hover:opacity-80 transition-opacity cursor-pointer text-left">
            <div className="p-3 neo-inset text-primary rounded-xl">
              <CircleHelp className="w-6 h-6" />
            </div>
            <div className="flex-1 font-bold text-lg">도움말 및 고객센터 (하단 탭의 상단 '?'를 참고하세요)</div>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md neo rounded-2xl border-none">
            <HelpContent pathname="/all" />
          </DialogContent>
        </Dialog>
      </div>

      {user?.email === 'seongwonseo634@gmail.com' && (
      <div className="neo p-5 rounded-2xl space-y-4">
        <h3 className="font-bold flex items-center text-lg text-primary">
          <Megaphone className="w-5 h-5 mr-2" /> 관리자 알림 발송
        </h3>
        <input type="text" placeholder="제목" value={adminTitle} onChange={(e) => setAdminTitle(e.target.value)} className="w-full neo-inset rounded-lg p-3 text-sm font-medium bg-transparent" />
        <textarea placeholder="내용" value={adminMessage} onChange={(e) => setAdminMessage(e.target.value)} className="w-full neo-inset rounded-lg p-3 text-sm font-medium bg-transparent h-20" />
        <select value={adminType} onChange={(e) => setAdminType(e.target.value as any)} className="w-full neo-inset rounded-lg p-2 text-sm bg-transparent">
            <option value="info">일반</option>
            <option value="update">업데이트</option>
            <option value="alert">경고</option>
        </select>
        <Button onClick={handleSendAdminNotification} className="w-full neo-button bg-transparent !text-emerald-600 border border-emerald-600/20 font-bold">발송</Button>
      </div>
      )}

      <div className="pt-6 space-y-4">
        <Button 
          variant="outline" 
          className="w-full h-12 text-sm font-bold border-brand-coral/30 text-brand-coral hover:bg-brand-coral/5" 
          onClick={handleResetData}
          disabled={isSyncing}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          모든 데이터 초기화 (공장 초기화)
        </Button>

        <Button variant="ghost" className="w-full h-14 text-lg font-bold neo-button text-brand-coral bg-transparent hover:bg-transparent hover:text-brand-coral hover:opacity-80" onClick={handleLogout}>
          <Power className="w-5 h-5 mr-3" />
          로그아웃
        </Button>
      </div>
      
      <Dialog open={!!confirmDialog} onOpenChange={(open) => !open && setConfirmDialog(null)}>
          <DialogContent className="neo rounded-2xl border-none">
              <DialogHeader>
                  <DialogTitle>확인</DialogTitle>
              </DialogHeader>
              <p>{confirmDialog?.title}</p>
              <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setConfirmDialog(null)}>취소</Button>
                  <Button onClick={confirmDialog?.onConfirm}>확인</Button>
              </div>
          </DialogContent>
      </Dialog>
      
      <Dialog open={!!promptDialog} onOpenChange={(open) => !open && setPromptDialog(null)}>
          <DialogContent className="neo rounded-2xl border-none">
              <DialogHeader>
                  <DialogTitle>{promptDialog?.title}</DialogTitle>
              </DialogHeader>
              <input 
                type="number"
                value={promptDialog?.value || ''}
                onChange={(e) => promptDialog?.setValue(e.target.value)}
                className="w-full text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2 font-medium"
              />
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setPromptDialog(null)}>취소</Button>
                <Button onClick={promptDialog?.onConfirm}>확인</Button>
              </div>
          </DialogContent>
      </Dialog>
    </div>
  );
}
