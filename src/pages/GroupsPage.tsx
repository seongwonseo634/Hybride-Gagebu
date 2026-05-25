import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, onSnapshot, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Users, Plus, ArrowRight, ShieldAlert, CheckCircle2, Circle, Copy, Trash2, Bell, FileText, PieChart as PieChartIcon, TrendingUp, Share2, UserMinus, Wallet } from 'lucide-react';
import { CategoryIcon } from '../components/CategoryIcon';
import MemberManagementPage from './MemberManagementPage';
import { Group, GroupDue, GroupTransaction } from '../types';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { ConfirmDialog } from '../components/ConfirmDialog';

const getMemberCount = (g: Group) => (g.memberIds?.length || 0) + (g.manualMembers?.length || 0);

function GroupsList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [newGroupName, setNewGroupName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [open, setOpen] = useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [joinGroupId, setJoinGroupId] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    if (!user) return;
    
    // Using memberIds array to query groups where user is a member
    const q = query(
      collection(db, 'groups'),
      where('memberIds', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Group[] = [];
      snapshot.forEach(d => {
        data.push({ id: d.id, ...d.data() } as Group);
      });
      
      data.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
      });
      
      setGroups(data);
      setLoading(false);
    }, (error) => {
      console.error("Groups Error:", error);
      const handled = handleFirestoreError(error, OperationType.LIST, 'groups');
      if (!handled) toast.error("모집 목록을 불러오지 못했습니다.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleCreateGroup = async () => {
    if (!user || !newGroupName) return;
    setIsCreating(true);
    try {
      const memberProfiles: Record<string, { displayName: string, email: string }> = {};
      memberProfiles[user.uid] = { 
        displayName: user.displayName || user.email?.split('@')[0] || 'Unknown', 
        email: user.email || '' 
      };

      const groupRef = doc(collection(db, 'groups'));
      const groupData: Omit<Group, 'id'> = {
        name: newGroupName,
        ownerId: user.uid,
        memberIds: [user.uid],
        memberProfiles,
        createdAt: serverTimestamp() as any,
        updatedAt: serverTimestamp() as any,
      };
      
      await setDoc(groupRef, groupData);
      
      // Initialize members subcollection
      await setDoc(doc(db, `groups/${groupRef.id}/members`, user.uid), {
        role: 'admin',
        joinedAt: serverTimestamp()
      });

      toast.success('새 모임이 생성되었습니다.');
      setOpen(false);
      setNewGroupName('');
      
      // Auto navigate
      navigate(`/groups/${groupRef.id}`);
    } catch (e) {
      const handled = handleFirestoreError(e, OperationType.CREATE, 'groups');
      if (handled) {
        toast.info("인터넷 연결이 불안정하여 완료 후 자동으로 반영됩니다.");
        setOpen(false);
        setNewGroupName('');
      } else {
        toast.error("모임 생성 중 오류가 발생했습니다.");
      }
    } finally {
      setIsCreating(false);
    }
  };

  const joinExistingGroup = async (groupId: string, navigateAfter = true) => {
    // A simple join function
    if (!user) return;
    setIsJoining(true);
    try {
      const gRef = doc(db, 'groups', groupId);
      const snap = await getDoc(gRef);
      if (snap.exists()) {
        const data = snap.data();
        if (!data.memberIds.includes(user.uid)) {
          const profiles = data.memberProfiles || {};
          profiles[user.uid] = { 
            displayName: user.displayName || user.email?.split('@')[0] || 'Unknown', 
            email: user.email || '' 
          };
          await updateDoc(gRef, { 
             memberIds: [...data.memberIds, user.uid],
             memberProfiles: profiles
          });
          
          await setDoc(doc(db, `groups/${groupId}/members`, user.uid), {
            role: 'member',
            joinedAt: serverTimestamp()
          });

          toast.success('모임에 참가했습니다.');
        } else {
          toast.info('이미 소속된 모임입니다.');
        }
        setJoinDialogOpen(false);
        setJoinGroupId('');
        if (navigateAfter) navigate(`/groups/${groupId}`);
      } else {
        toast.error('존재하지 않는 모임입니다. ID를 다시 확인해 주세요.');
      }
    } catch(e: any) {
      console.error("Manual Join Error:", e);
      toast.error(`가입 중 오류 발생: ${e.message}`);
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="p-4 space-y-6 max-w-2xl mx-auto mb-20 animate-in fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">내 모임</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button size="sm" />}>
            <Plus className="w-4 h-4 mr-1" /> 새 모임
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>새 모임 만들기</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">모임 이름</Label>
                <Input id="name" placeholder="예: 2024 동기여행 계좌" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} />
              </div>
              <Button className="w-full" disabled={isCreating} onClick={handleCreateGroup}>
                {isCreating ? '생성 중...' : '모임 생성'}
              </Button>
              <div className="text-center text-xs text-muted-foreground my-2">또는</div>
              <Button variant="outline" className="w-full" onClick={() => setJoinDialogOpen(true)}>
                초대 코드 입력하기
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>초대 코드 입력하기</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="joinId">모임 ID</Label>
                <Input id="joinId" placeholder="예: a1b2c3d4..." value={joinGroupId} onChange={e => setJoinGroupId(e.target.value)} />
              </div>
              <Button 
                className="w-full" 
                disabled={isJoining || !joinGroupId.trim()}
                onClick={() => {
                  if (joinGroupId.trim()) joinExistingGroup(joinGroupId.trim());
                }}
              >
                {isJoining ? '처리 중...' : '참여하기'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center p-8 text-muted-foreground font-bold">불러오는 중...</div>
      ) : groups.length === 0 ? (
        <div className="neo-inset rounded-2xl p-10 flex flex-col items-center justify-center text-center">
          <Users className="w-12 h-12 text-muted-foreground mb-4 opacity-70" />
          <h3 className="font-bold text-lg">참여 중인 모임이 없습니다</h3>
          <p className="text-sm font-bold text-muted-foreground mt-2 max-w-[250px] mx-auto opacity-80">
            모임을 만들어 친구, 동료와 회비를 공동으로 관리해 보세요.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map(g => (
            <div 
              key={g.id} 
              className="neo p-4 flex flex-col cursor-pointer rounded-2xl hover:opacity-80 transition-opacity"
              onClick={() => {
                navigate(`/groups/${g.id}`);
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex flex-col space-y-1">
                  <span className="font-bold text-xl">{g.name}</span>
                  <span className="text-xs font-bold text-muted-foreground flex items-center">
                    <Users className="w-4 h-4 mr-1.5 opacity-80" />
                    멤버 {getMemberCount(g)}명
                  </span>
                </div>
                <div className="p-3 neo-inset rounded-xl text-primary">
                  <ArrowRight className="w-5 h-5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GroupDetail() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [group, setGroup] = useState<Group | null>(null);
  const [transactions, setTransactions] = useState<GroupTransaction[]>([]);
  const [dues, setDues] = useState<GroupDue[]>([]);
  const [duesDialogOpen, setDuesDialogOpen] = useState(false);
  const [dueTitle, setDueTitle] = useState('');
  const [dueAmount, setDueAmount] = useState('');
  const [deleteDueConfirmId, setDeleteDueConfirmId] = useState<string | null>(null);
  const [kickTarget, setKickTarget] = useState<string | null>(null);
  
  const handleKick = async (uid: string) => {
    try {
      if (!group) return;
      const newMemberIds = group.memberIds.filter(id => id !== uid);
      const newMemberProfiles = { ...(group.memberProfiles || {}) };
      delete newMemberProfiles[uid];
      
      await updateDoc(doc(db, `groups`, group.id), {
        memberIds: newMemberIds,
        memberProfiles: newMemberProfiles
      });

      // Also delete the member document in the subcollection
      await deleteDoc(doc(db, `groups/${group.id}/members`, uid));
      
      toast.success('멤버가 강퇴되었습니다.');
    } catch(e) {
      handleFirestoreError(e, OperationType.UPDATE, 'groups');
    }
  };
  
  useEffect(() => {
    if (!groupId) return;
    
    // Fetch group info
    const unsubsGroup = onSnapshot(doc(db, 'groups', groupId), (d) => {
      if(d.exists()) {
        setGroup({ id: d.id, ...d.data() } as Group);
      } else {
        toast.error("존재하지 않는 모임입니다.");
        navigate('/groups');
      }
    }, (error) => {
      console.error("Group fetch error:", error);
      handleFirestoreError(error, OperationType.GET, `groups/${groupId}`);
      toast.error("모임 정보를 불러오는 중 오류가 발생했습니다.");
      navigate('/groups');
    });

    // Fetch transactions
    const qTx = query(collection(db, `groups/${groupId}/transactions`), orderBy('date', 'desc'));
    const unsubsTx = onSnapshot(qTx, (snap) => {
      const txs: GroupTransaction[] = [];
      snap.forEach(d => txs.push({ id: d.id, ...d.data() } as GroupTransaction));
      
      // Sort by createdAt as secondary sort locally if needed
      txs.sort((a, b) => {
        if (a.date === b.date) {
          const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return timeB - timeA;
        }
        return 0;
      });
      
      setTransactions(txs);
    }, (error) => console.error("Transactions fetch error:", error));

    // Fetch dues
    const qDues = query(collection(db, `groups/${groupId}/dues`), orderBy('createdAt', 'desc'));
    const unsubsDues = onSnapshot(qDues, (snap) => {
      const ds: GroupDue[] = [];
      snap.forEach(d => ds.push({ id: d.id, ...d.data() } as GroupDue));
      setDues(ds);
    }, (error) => console.error("Dues fetch error:", error));

    return () => {
      unsubsGroup();
      unsubsTx();
      unsubsDues();
    };
  }, [groupId]);

  const [userRole, setUserRole] = useState<'admin' | 'member' | null>(null);
  
  const [participatingCount, setParticipatingCount] = useState<number>(0);
  
  useEffect(() => {
    if (group) setParticipatingCount(getMemberCount(group));
  }, [group]);
  
  const [dutchPayText, setDutchPayText] = useState('');
  const isAdmin = userRole === 'admin' || (user?.uid && group?.ownerId && user.uid === group.ownerId);
  const balance = transactions.reduce((acc, t) => t.type === 'income' ? acc + (t.amount || 0) : acc - (t.amount || 0), 0);

  const calculateDutchPay = (txs: GroupTransaction[]) => {
    const groupName = group?.name || '모임';
    const count = participatingCount > 0 ? participatingCount : (group ? getMemberCount(group) : 1);
    const totalExp = txs.filter(t => t.type === 'expense').reduce((acc, t) => acc + (t.amount || 0), 0);
    const totalIncome = txs.filter(t => t.type === 'income').reduce((acc, t) => acc + (t.amount || 0), 0);
    const perPerson = count > 0 ? Math.ceil((totalIncome - totalExp) / count) : 0;
    
    return `[${groupName} 정산 알림]
총 수입 : ${(totalIncome || 0).toLocaleString()}원
총 지출 : ${(totalExp || 0).toLocaleString()}원
멤버 : 참여한 회원수 : ${count}명
1인당 입금액 : ${(perPerson || 0).toLocaleString()}원
송금 계좌 : `;
  };

  useEffect(() => {
    if (!groupId || !user) return;
    const unsubsRole = onSnapshot(doc(db, `groups/${groupId}/members/${user.uid}`), (d) => {
      if(d.exists()) {
          const role = d.data().role as 'admin' | 'member';
          setUserRole(role);
        }
    }, (error) => console.error("Role fetch error:", error));
    return () => {
      unsubsRole();
    };
  }, [groupId, user?.uid]);

  const getMemberName = (uid: string) => {
    let name = `User ${uid.substring(0,4)}`;
    if (group?.memberProfiles && group.memberProfiles[uid]?.displayName && group.memberProfiles[uid].displayName !== 'Unknown') {
      name = group.memberProfiles[uid].displayName;
    } else if (group?.manualMembers?.find(m=>m.id === uid)) {
      name = group.manualMembers.find(m=>m.id === uid)!.name;
    } else if (uid === user?.uid) {
      name = user.displayName || user.email?.split('@')[0] || name;
    }
    if (uid === user?.uid) return `${name} (나)`;
    return name;
  };

  useEffect(() => {
    setDutchPayText(calculateDutchPay(transactions));
  }, [transactions, group, participatingCount]);

  if (!group) return <div className="p-8 text-center text-muted-foreground animate-pulse">모임 정보 불러오는 중...</div>;

  const handleDeleteTx = async (txId: string) => {
    if (!isAdmin) return;
    
    // iframe 내에서는 window.confirm이 동작하지 않을 수 있으므로 toast action을 활용
    toast('이 거래 내역을 삭제하시겠습니까?', {
      action: {
        label: '삭제하기',
        onClick: async () => {
          try {
            await deleteDoc(doc(db, `groups/${groupId}/transactions`, txId));
            toast.success('거래 내역이 삭제되었습니다.');
          } catch (e) {
            handleFirestoreError(e, OperationType.DELETE, `groups/${groupId}/transactions`);
          }
        }
      },
      cancel: {
        label: '취소',
        onClick: () => {}
      }
    });
  };

  const totalExpectedDues = dues.reduce((acc, due) => acc + (due.amount || 0) * getMemberCount(group), 0);
  const totalPaidDues = dues.reduce((acc, due) => acc + (due.amount || 0) * (due.paidMemberIds?.length || 0), 0);
  const remainingDues = totalExpectedDues - totalPaidDues;
  
  const expensesByCategory = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + (t.amount || 0);
      return acc;
    }, {} as Record<string, number>);

  const expensePieData = Object.keys(expensesByCategory).map(key => ({
    name: key,
    value: expensesByCategory[key]
  }));

  const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#6366f1', '#ec4899', '#8b5cf6'];

  const handleCopyAuditReport = () => {
    const report = `[감사용 보고서] ${group.name}\n작성일: ${format(new Date(), 'yyyy년 MM월 dd일')}\n\n■ 총 수입: ${transactions.filter(t=>t.type==='income').reduce((a,b)=>a+(b.amount||0),0).toLocaleString()}원\n■ 총 지출: ${transactions.filter(t=>t.type==='expense').reduce((a,b)=>a+(b.amount||0),0).toLocaleString()}원\n■ 현재 잔액: ${balance.toLocaleString()}원\n\n■ 회비 수납 현황\n- 목표 모금액: ${totalExpectedDues.toLocaleString()}원\n- 수납 완료액: ${totalPaidDues.toLocaleString()}원\n- 미수납액: ${remainingDues.toLocaleString()}원\n\n이 보고서는 앱에서 자동 생성되었습니다.`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(report);
      toast.success('감사용 보고서가 클립보드에 복사되었습니다.');
    }
  };

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-6 mb-24 pb-8 animate-in fade-in">
      <Button variant="ghost" size="sm" className="mb-2 -ml-2 text-emerald-600 font-bold" onClick={() => navigate('/groups')}>
        &lt;- 이전으로
      </Button>
      <div className="flex items-center justify-between mt-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{group.name}</h2>
          <div className="text-sm text-muted-foreground mt-1 flex items-center flex-wrap gap-y-1">
            <Users className="w-3 h-3 mr-1" />
            <span className="hover:underline cursor-pointer font-medium ml-1 mr-0 text-foreground" onClick={() => navigate(`/groups/${groupId}/members`)}>
                {getMemberCount(group)} 등록한 회원 참여중
            </span>
            <span 
              className="ml-2 pl-2 border-l cursor-pointer hover:text-primary flex items-center" 
              onClick={() => {
                if (navigator.clipboard) {
                  navigator.clipboard.writeText(group.id);
                  toast.success('모임 ID가 클립보드에 복사되었습니다.');
                }
              }}
            >
               ID: {group.id?.substring(0, 6)} <Copy className="w-3 h-3 ml-1" />
            </span>
          </div>
        </div>
        <Button size="sm" onClick={() => navigate(`/input?groupId=${groupId}`)} className="neo-button text-emerald-600">
            <Plus className="w-4 h-4 mr-1" /> 내역 추가
        </Button>
      </div>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="grid w-full grid-cols-5 mb-6">
          <TabsTrigger value="dashboard">내역</TabsTrigger>
          <TabsTrigger value="dues">회비 납부</TabsTrigger>
          <TabsTrigger value="dutch">정산</TabsTrigger>
          <TabsTrigger value="analytics">분석</TabsTrigger>
          <TabsTrigger value="settings">설정</TabsTrigger>
        </TabsList>
        
        {/* TAB 1: 내역 (Ledger) */}
        <TabsContent value="dashboard" className="space-y-4">
          <Card className="bg-primary text-primary-foreground border-none">
            <CardContent className="p-6">
              <p className="text-sm font-medium opacity-90"></p>
              <p className="text-4xl font-bold mt-2">₩{(balance || 0).toLocaleString()}</p>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between px-1 mt-6">
            <h3 className="font-semibold text-lg">거래 내역</h3>
          </div>
          
          <div className="space-y-3">
            {transactions.length === 0 ? (
              <div className="text-center py-8 bg-card rounded-xl border text-muted-foreground text-sm">
                지출 내역이 없습니다.
              </div>
            ) : (
              transactions.map(tx => (
                <div key={tx.id} className="flex items-center justify-between p-4 bg-card border rounded-xl shadow-sm">
                  <div className="flex items-center space-x-4">
                    <div className={`w-10 h-10 rounded-full bg-muted flex items-center justify-center ${tx.type === 'income' ? 'text-brand-mint' : 'text-primary'}`}>
                      {tx.type === 'income' ? <Wallet className="w-5 h-5" /> : <CategoryIcon category={tx.category} className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="font-semibold">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">{tx.date} • {tx.category}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="text-right mr-2">
                      <p className={`font-bold ${tx.type === 'income' ? 'text-brand-teal' : 'text-brand-coral'}`}>
                        {tx.type === 'income' ? '+' : '-'}₩{(tx.amount || 0).toLocaleString()}
                      </p>
                    </div>
                    {isAdmin && (
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteTx(tx.id)} className="w-8 h-8 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>

        {/* TAB 2: 회비 납부 현황 (Dues) */}
        <TabsContent value="dues" className="space-y-4">
           {isAdmin && (
             <Button variant="outline" className="w-full border-dashed" onClick={() => setDuesDialogOpen(true)}>
               <Plus className="w-4 h-4 mr-2" />
               새로운 회비 청구하기
             </Button>
           )}

           <Dialog open={duesDialogOpen} onOpenChange={setDuesDialogOpen}>
             <DialogContent>
               <DialogHeader>
                 <DialogTitle>새로운 회비 청구하기</DialogTitle>
               </DialogHeader>
               <div className="space-y-4 py-4">
                 <div className="space-y-2">
                   <Label>회비 항목 이름</Label>
                   <Input placeholder="예: 5월 정기 회비" value={dueTitle} onChange={e => setDueTitle(e.target.value)} />
                 </div>
                 <div className="space-y-2">
                   <Label>1인당 청구할 금액</Label>
                   <Input type="number" placeholder="예: 30000" value={dueAmount} onChange={e => setDueAmount(e.target.value)} />
                 </div>
                 <Button className="w-full" onClick={async () => {
                   if(!dueTitle || !dueAmount) return;
                   const amount = parseInt(dueAmount);
                   if(isNaN(amount)) return toast.error("올바른 금액을 입력하세요");
                   
                   try {
                     await addDoc(collection(db, `groups/${groupId}/dues`), {
                       title: dueTitle,
                       amount,
                       dueDate: format(new Date(), 'yyyy-MM-dd'),
                       createdBy: user?.uid,
                       createdAt: serverTimestamp(),
                       paidMemberIds: []
                     });
                     
                     if (group?.memberIds) {
                       const notificationPromises = group.memberIds
                         .filter(id => id !== user?.uid)
                         .map(memberId => 
                           addDoc(collection(db, `users/${memberId}/notifications`), {
                             title: '새로운 회비 청구',
                             message: `${group.name}에서 ${dueTitle} (${amount.toLocaleString()}원) 회비가 청구되었습니다.`,
                             read: false,
                             groupId: groupId,
                             createdAt: serverTimestamp()
                           })
                         );
                       await Promise.all(notificationPromises);
                     }
                     
                     toast.success("회비 항목이 추가되었습니다.");
                     setDuesDialogOpen(false);
                     setDueTitle('');
                     setDueAmount('');
                   } catch(e) {
                     handleFirestoreError(e, OperationType.CREATE, 'dues');
                   }
                 }}>
                   청구 완료
                 </Button>
               </div>
             </DialogContent>
           </Dialog>

           {dues.length === 0 ? (
             <div className="text-center py-10 bg-card rounded-xl border text-muted-foreground text-sm">
                청구된 회비 항목이 없습니다.
             </div>
           ) : (
             <div className="space-y-4">
               {dues.map(due => (
                 <Card key={due.id}>
                   <CardHeader className="pb-2">
                     <CardTitle className="text-base flex justify-between items-center">
                       <span>{due.title}</span>
                       <div className="flex items-center gap-2">
                         <div className="flex border-r mr-2 pr-2 border-muted items-center text-xs opacity-70">1인 ₩{(due.amount || 0).toLocaleString()}</div><span className="text-primary font-bold">합계 ₩{((due.amount || 0) * (due.paidMemberIds?.length || 0)).toLocaleString()}</span>
                         {isAdmin && (
                           <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setDeleteDueConfirmId(due.id)}>
                             <Trash2 className="w-4 h-4" />
                           </Button>
                         )}
                       </div>
                     </CardTitle>
                     <CardDescription className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mt-1">
                       <span>납부율: {Math.round(((due.paidMemberIds?.length || 0) / (getMemberCount(group) || 1)) * 100)}% ({due.paidMemberIds?.length || 0} / {getMemberCount(group)})</span>
                       {isAdmin && (
                         <Button variant="outline" size="sm" className="h-7 text-xs bg-orange-50 hover:bg-orange-100 text-orange-600 border-orange-200" onClick={() => {
                           const unpaidCount = getMemberCount(group) - (due.paidMemberIds?.length || 0);
                           const msg = `[안내] '${due.title}' 회비(₩${(due.amount||0).toLocaleString()}원)가 아직 납부되지 않았습니다. 바쁘시더라도 확인 후 납부 부탁드립니다!`;
                           if (navigator.clipboard) {
                             navigator.clipboard.writeText(msg);
                             toast.success(`미납자 ${unpaidCount}명에 대한 알림 메시지가 클립보드에 복사되었습니다. 카카오톡 등에 붙여넣기 하세요.`);
                           }
                         }}>
                           <Bell className="w-3 h-3 mr-1" /> 미납 알림 복사
                         </Button>
                       )}
                     </CardDescription>
                   </CardHeader>
                   <CardContent>
                     {/* For a real app we'd fetch subcollection 'payments' but we simulate user checkboxes here for demo */}
                     <div className="space-y-2">
                       {[...(group.memberIds || []), ...(group.manualMembers?.map(m => m.id) || [])].map(uid => (
                         <div key={uid} className="flex justify-between items-center p-2 rounded-md hover:bg-muted/50">
                           <span className="text-sm font-medium">{getMemberName(uid)}</span>
                           <Button variant={due.paidMemberIds?.includes(uid) ? "default" : "outline"} size="sm" className="h-8 min-w-[70px]" onClick={async () => {
                             const isPaid = due.paidMemberIds?.includes(uid);
                             if (!isAdmin && uid !== user?.uid) {
                               return toast.info('다른 멤버의 납부 상태는 변경할 수 없습니다.');
                             }
                             try {
                               const newPaidIds = isPaid ? (due.paidMemberIds || []).filter(id => id !== uid) : [...(due.paidMemberIds || []), uid];
                               await updateDoc(doc(db, `groups/${groupId}/dues`, due.id), { paidMemberIds: newPaidIds });
                             } catch(e) {
                               handleFirestoreError(e, OperationType.UPDATE, 'dues');
                             }
                           }}>
                             <div className="flex items-center text-xs">
                               {due.paidMemberIds?.includes(uid) ? <><CheckCircle2 className="w-4 h-4 mr-1 text-white" /> 납부완료</> : <><Circle className="w-4 h-4 text-muted-foreground mr-1" /> 미납</>}
                             </div>
                           </Button>
                         </div>
                       ))}
                     </div>
                   </CardContent>
                 </Card>
               ))}
             </div>
           )}

           <Dialog open={!!deleteDueConfirmId} onOpenChange={(open) => !open && setDeleteDueConfirmId(null)}>
             <DialogContent>
               <DialogHeader>
                 <DialogTitle>청구 내역 삭제</DialogTitle>
               </DialogHeader>
               <div className="space-y-4 py-4">
                 <p className="text-sm text-muted-foreground">정말 이 청구 내역을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.</p>
                 <div className="flex justify-end gap-2">
                   <Button variant="outline" onClick={() => setDeleteDueConfirmId(null)}>취소</Button>
                   <Button variant="destructive" onClick={async () => {
                     if (!deleteDueConfirmId) return;
                     try {
                       await deleteDoc(doc(db, `groups/${groupId}/dues`, deleteDueConfirmId));
                       toast.success('삭제되었습니다.');
                       setDeleteDueConfirmId(null);
                     } catch (e) {
                       handleFirestoreError(e, OperationType.DELETE, 'dues');
                     }
                   }}>삭제하기</Button>
                 </div>
               </div>
             </DialogContent>
           </Dialog>
        </TabsContent>

        {/* TAB 3: 정산 (Dutch Pay) */}
        <TabsContent value="dutch" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>자동 더치페이 계산결과</CardTitle>
              <CardDescription>멤버 수에 맞게 총 지출을 1/N 배분합니다.</CardDescription>
            </CardHeader>
            <CardContent>
              <textarea 
                className="w-full neo-inset p-4 rounded-xl text-sm font-mono leading-relaxed mb-4 bg-transparent border-none min-h-[150px]"
                value={dutchPayText}
                onChange={(e) => setDutchPayText(e.target.value)}
              />
              <div className="flex items-center space-x-2 my-2">
                <Label htmlFor="participatingCount" className="text-sm">참여한 회원수</Label>
                <Input 
                  id="participatingCount" 
                  type="number" 
                  value={participatingCount} 
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    setParticipatingCount(val);
                  }}
                  className="w-20"
                />
              </div>
              <Button 
                onClick={() => {
                  try {
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                      navigator.clipboard.writeText(dutchPayText);
                      toast.success("클립보드에 복사되었습니다. 카카오톡에 붙여넣으세요!");
                    } else {
                      alert("현재 환경에서는 클립보드 복사를 지원하지 않습니다. 텍스트를 직접 복사해주세요.");
                    }
                  } catch (e) {
                    console.error("Clipboard copy failed", e);
                    alert("클립보드 복사 중 오류가 발생했습니다.");
                  }
                }}
                className="w-full"
              >
                <Copy className="w-4 h-4 mr-2" />
                정산 메시지 복사하기
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: 분석 (Analytics) */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 flex flex-col justify-center items-center text-center h-full">
                <p className="text-sm text-muted-foreground mb-1">총 멤버 수</p>
                <div className="flex items-center gap-1.5 justify-center mb-1 text-primary">
                   <Users className="w-5 h-5" />
                   <p className="text-xl font-bold">{getMemberCount(group)}명</p>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4 flex flex-col justify-center items-center text-center h-full">
                <p className="text-sm text-muted-foreground mb-1">거래 내역</p>
                <div className="flex items-center gap-1.5 justify-center mb-1 text-primary">
                   <Wallet className="w-5 h-5" />
                   <p className="text-xl font-bold">₩{balance.toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex flex-col justify-center items-center text-center h-full">
                <p className="text-sm text-muted-foreground mb-1">총 수납액</p>
                <p className="text-xl font-bold text-primary">₩{totalPaidDues.toLocaleString()}</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4 flex flex-col justify-center items-center text-center h-full">
                <p className="text-sm text-muted-foreground mb-1">예상 잔액(완납시)</p>
                <div className="flex items-center gap-1.5 justify-center mb-1 text-emerald-600">
                  <TrendingUp className="w-5 h-5" />
                  <p className="text-xl font-bold">₩{(totalExpectedDues - transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + (t.amount || 0), 0)).toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center">
                <PieChartIcon className="w-4 h-4 mr-2" />
                행사별(카테고리별) 지출 분석
              </CardTitle>
            </CardHeader>
            <CardContent>
              {expensePieData.length > 0 ? (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={expensePieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {expensePieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        formatter={(value) => `₩${parseInt(value as string).toLocaleString()}`} 
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-32 flex justify-center items-center text-sm text-muted-foreground animate-pulse">지출 내역이 없습니다.</div>
              )}
              
              <div className="grid grid-cols-2 gap-2 mt-2">
                {expensePieData.map((entry, index) => (
                  <div key={entry.name} className="flex items-center text-xs">
                    <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                    <span className="flex-1 truncate">{entry.name}</span>
                    <span className="font-medium">₩{(entry.value || 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Button className="w-full flex items-center justify-center gap-2" variant="outline" onClick={handleCopyAuditReport}>
            <FileText className="w-4 h-4" />
            감사용 보고서 텍스트 자동생성 및 복사
          </Button>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>멤버 관리</CardTitle>
                </CardHeader>
                <CardContent>
                    <Button variant="outline" className="w-full flex items-center gap-2" onClick={() => navigate(`/groups/${groupId}/members`)}>
                        <Users className="w-4 h-4" />
                        멤버 목록 및 권한 관리
                    </Button>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>모임 설정</CardTitle>
                </CardHeader>
                <CardContent>
                    {user?.uid === group.ownerId ? (
                        <div className="space-y-4">
                            <p className="text-sm text-destructive">모임을 삭제하면 모든 데이터가 영구적으로 삭제됩니다.</p>
                            <Button variant="destructive" className="w-full" onClick={() => {
                                toast('정말 이 모임을 삭제하시겠습니까?', {
                                    action: {
                                        label: '삭제',
                                        onClick: async () => {
                                            try {
                                                await deleteDoc(doc(db, 'groups', groupId!));
                                                toast.success('모임이 삭제되었습니다.');
                                                navigate('/groups');
                                            } catch(e) {
                                                handleFirestoreError(e, OperationType.DELETE, 'groups');
                                            }
                                        }
                                    }
                                });
                            }}>
                                모임 삭제하기
                            </Button>
                        </div>
                    ) : (
                        <p className="text-muted-foreground text-sm">총무만 설정 변경 가능합니다.</p>
                    )}
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function GroupsPage() {
  return (
    <Routes>
      <Route index element={<GroupsList />} />
      <Route path=":groupId/members" element={<MemberManagementPage />} />
      <Route path=":groupId/*" element={<GroupDetail />} />
    </Routes>
  );
}
