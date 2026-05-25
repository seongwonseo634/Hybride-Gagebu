import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, deleteDoc, setDoc, arrayUnion } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { Group } from '../types';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Users, UserMinus, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { ConfirmDialog } from '../components/ConfirmDialog';

export default function MemberManagementPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [group, setGroup] = useState<Group | null>(null);
  const [kickTarget, setKickTarget] = useState<string | null>(null);

  useEffect(() => {
    if (!groupId) return;
    const unsub = onSnapshot(doc(db, 'groups', groupId), (d) => {
      if (d.exists()) {
        setGroup({ id: d.id, ...d.data() } as Group);
      }
    }, (error) => {
      console.error("Group fetch error:", error);
      toast.error("모임 정보를 불러오는 중 오류가 발생했습니다.");
    });
    return () => unsub();
  }, [groupId]);

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
      await deleteDoc(doc(db, `groups/${group.id}/members`, uid));
      
      toast.success('멤버가 강퇴되었습니다.');
      setKickTarget(null);
    } catch(e) {
      handleFirestoreError(e, OperationType.UPDATE, 'groups');
    }
  };

  const getMemberName = (uid: string) => {
    let name = `User ${uid.substring(0,4)}`;
    if (group?.memberProfiles && group.memberProfiles[uid]?.displayName && group.memberProfiles[uid].displayName !== 'Unknown') {
      name = group.memberProfiles[uid].displayName;
    }
    return uid === user?.uid ? `${name} (나)` : name;
  };

  if (!group) return <div className="p-4 text-center">불러오는 중...</div>;

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-6 animate-in fade-in">
        <Button variant="ghost" size="sm" className="-ml-2 mb-2 text-emerald-600" onClick={() => navigate(`/groups/${groupId}`)}>
           <ArrowLeft className="w-4 h-4 mr-2" /> 모임으로 돌아가기
        </Button>
        <h2 className="text-2xl font-bold">멤버 관리</h2>
        
        <Card>
            <CardHeader>
                <CardTitle className="text-lg flex items-center">
                    <Users className="w-5 h-5 mr-2" />
                    등록한 회원수 ({(group.memberIds.length + (group.manualMembers?.length || 0))}명)
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {user?.uid === group.ownerId && (
                    <div className="flex gap-2 mb-4">
                        <input 
                            type="text" 
                            placeholder="멤버 이름 입력" 
                            className="flex-grow p-2 border rounded-md"
                            id="name-input"
                        />
                        <Button 
                            onClick={async () => {
                                const nameInput = document.getElementById('name-input') as HTMLInputElement;
                                const name = nameInput.value.trim();
                                if (!name) return;
                                try {
                                    await updateDoc(doc(db, `groups`, group.id), {
                                        manualMembers: arrayUnion({ id: crypto.randomUUID(), name })
                                    });
                                    toast.success(`${name} 멤버를 추가했습니다.`);
                                    nameInput.value = '';
                                } catch (e) {
                                    handleFirestoreError(e, OperationType.UPDATE, 'groups');
                                }
                            }}
                        >
                            추가
                        </Button>
                    </div>
                )}
                {group.manualMembers?.map(m => (
                    <div key={m.id} className="flex justify-between items-center p-3 neo-inset rounded-lg">
                        <span className="font-medium text-sm">{m.name}</span>
                        {user?.uid === group.ownerId && (
                             <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={async () => {
                                const newManualMembers = group.manualMembers?.filter(mem => mem.id !== m.id);
                                await updateDoc(doc(db, `groups`, group.id), { manualMembers: newManualMembers });
                                toast.success('멤버가 삭제되었습니다.');
                             }}>
                                <UserMinus className="w-4 h-4 mr-1" /> 삭제
                            </Button>
                        )}
                    </div>
                ))}
                {group.memberIds.map(uid => (
                    <div key={uid} className="flex justify-between items-center p-3 neo-inset rounded-lg">
                        <div className="flex flex-col">
                            <span className="font-medium text-sm">{getMemberName(uid)}</span>
                            {group.memberProfiles?.[uid]?.email && <span className="text-xs text-muted-foreground">{group.memberProfiles[uid].email}</span>}
                        </div>
                        {user?.uid === group.ownerId && uid !== group.ownerId && (
                            <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => setKickTarget(uid)}>
                                <UserMinus className="w-4 h-4 mr-1" /> 강퇴
                            </Button>
                        )}
                        {uid === group.ownerId && <span className="text-xs font-bold text-primary px-2 py-1 bg-primary/10 rounded">총무</span>}
                    </div>
                ))}
            </CardContent>
        </Card>

        {kickTarget && (
            <ConfirmDialog
                open={!!kickTarget}
                onOpenChange={(open) => !open && setKickTarget(null)}
                title="멤버 강퇴"
                description="정말 이 멤버를 모임에서 내보내시겠습니까?"
                onConfirm={() => handleKick(kickTarget)}
            />
        )}
    </div>
  );
}
