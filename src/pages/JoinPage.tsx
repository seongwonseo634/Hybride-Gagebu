import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc, writeBatch, setDoc, serverTimestamp, arrayUnion, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { ShieldAlert, Users } from 'lucide-react';

export default function JoinPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [group, setGroup] = React.useState<any>(null);
  const [fetching, setFetching] = React.useState(true);
  const [joining, setJoining] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  
  useEffect(() => {
    console.log("JoinPage: Loading. GroupID:", groupId, "User:", user, "Loading:", loading);
    // 1. Save to localStorage immediately (even before auth check)
    if (groupId) {
      localStorage.setItem('pending_invite_id', groupId);
      console.log("JoinPage: Saved pending invite ID to localStorage", groupId);
    }
    
    if (loading) return;
    
    // User agent to detect KakaoTalk browser
    const isKakaoBrowser = /KAKAOTALK/i.test(navigator.userAgent) || /Line/i.test(navigator.userAgent) || /FBAN/i.test(navigator.userAgent);
    
    const fetchGroupInfo = async () => {
      console.log("JoinPage: Fetching group info for", groupId);
      if (!groupId) {
        console.error("JoinPage: Error: groupId is missing");
        setError('잘못된 접근입니다 (모임 ID 누락).');
        setFetching(false);
        return;
      }

      try {
        setFetching(true);
        console.log("JoinPage: Attempting to fetch from Firestore: groups/", groupId);
        const gRef = doc(db, 'groups', groupId);
        const snap = await getDoc(gRef);                
        console.log("JoinPage: Document exists?", snap.exists());
        
        if (snap.exists()) {
          const data = snap.data();
          console.log("JoinPage: Group data retrieved", data);
          setGroup({ id: snap.id, ...data });
          
          // 이미 가입된 경우 자동 입장 처리
          if (user && data.memberIds?.includes(user.uid)) {
            console.log("JoinPage: User is already a member, auto-redirecting...");
            localStorage.removeItem('pending_invite_id');
            navigate(`/groups/${snap.id}`, { replace: true });
          }
        } else {
          console.log("JoinPage: Group NOT found in Firestore for ID:", groupId);
          setError('해당 모임을 찾을 수 없습니다. 초대 코드가 정확한지 확인해 주세요.');
        }
      } catch(e: any) {
        console.error("JoinPage Fetch Error (Firestore):", e);
        setError(`모임 정보를 불러오지 못했습니다: ${e.message || '네트워크 연결을 확인해 주세요.'}`);
      } finally {
        setFetching(false);
      }
    };

    fetchGroupInfo();
  }, [groupId, user, loading, navigate]);

  const handleJoin = async () => {
    if (!user) {
      toast.error('로그인이 필요합니다.');
      navigate(`/login?invite=${groupId}`, { replace: true });
      return;
    }
    
    if (!groupId || !group) return;
    
    // Double check if already joined in case state is stale
    if (group.memberIds?.includes(user.uid)) {
      toast.success('이미 가입된 멤버입니다.');
      localStorage.removeItem('pending_invite_id');
      navigate(`/groups/${groupId}`, { replace: true });
      return;
    }

    setJoining(true);
    try {
      const batch = writeBatch(db);
      const gRef = doc(db, 'groups', groupId);
      const mRef = doc(db, `groups/${groupId}/members`, user.uid);
      
      // 1. Add to memberIds and update profiles
      const profileData = { 
        displayName: user.displayName || user.email?.split('@')[0] || 'Unknown', 
        email: user.email || '' 
      };
      
      batch.update(gRef, { 
         memberIds: arrayUnion(user.uid),
         [`memberProfiles.${user.uid}`]: profileData
      });

      // 2. Create membership document
      batch.set(mRef, {
        role: 'member',
        joinedAt: serverTimestamp()
      });
      
      // 3. Commit atomically
      await batch.commit();
      
      localStorage.removeItem('pending_invite_id');
      toast.success('모임에 성공적으로 참가했습니다!');
      navigate(`/groups/${groupId}`, { replace: true });
    } catch(e: any) {
      console.error("JoinPage Join Error Details:", e);
      // Detailed error logging
      if (e.code === 'permission-denied') {
        toast.error('가입 권한이 없습니다. (Firestore Rule Error)');
      } else {
        toast.error(`가입 중 오류 발생: ${e.message}`);
      }
      setJoining(false);
    }
  };

  const isAlreadyMember = group?.memberIds?.includes(user?.uid);

  if (loading || fetching) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center space-y-4 p-4">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-muted-foreground font-medium">모임 정보를 불러오는 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center p-8 text-center space-y-6">
        <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center text-destructive">
          <ShieldAlert size={32} />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold">가입할 수 없습니다</h2>
          <p className="text-muted-foreground max-w-xs mx-auto">{error}</p>
        </div>
        <div className="flex flex-col w-full max-w-xs gap-3">
          <Button onClick={() => window.location.reload()}>다시 시도하기</Button>
          <Button variant="ghost" onClick={() => navigate('/groups')}>모임 목록으로 가기</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center p-6 bg-muted/20">
      <Card className="w-full max-w-sm shadow-xl border-none animate-in zoom-in-95 duration-200">
        <CardHeader className="text-center pb-2">
          <div className={`mx-auto w-16 h-16 ${isAlreadyMember ? 'bg-green-100 text-green-600' : 'bg-primary/10 text-primary'} rounded-full flex items-center justify-center mb-4`}>
            <Users className="w-8 h-8" />
          </div>
          <CardTitle className="text-2xl font-bold">
            {isAlreadyMember ? '이미 참여 중인 모임' : '모임 초대'}
          </CardTitle>
          <CardDescription>
            {isAlreadyMember ? '반갑습니다! 이미 이 모임의 멤버입니다.' : '아래 모임에 초대받으셨습니다.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="bg-card border rounded-2xl p-5 text-center space-y-2">
            <p className="text-sm font-bold text-primary">모임 이름</p>
            <p className="text-2xl font-extrabold tracking-tight">{group?.name || '정보 없음'}</p>
            <p className="text-xs text-muted-foreground">멤버 {group?.memberIds?.length || 0}명 활동 중</p>
            {user && group?.memberIds?.includes(user.uid) && (
              <div className="mt-2 text-[10px] bg-green-500/10 text-green-600 px-2 py-1 rounded-full inline-block font-bold">
                이미 가입된 멤버(나)
              </div>
            )}
          </div>
          
          <div className="space-y-3">
            {/KAKAOTALK/i.test(navigator.userAgent) ? (
              <div className="p-4 bg-red-50 rounded-2xl border border-red-200 text-center space-y-4">
                <p className="text-base font-bold text-red-700">카카오톡 접속이 감지되었습니다.</p>
                <div className="text-sm text-red-600 leading-relaxed font-semibold">
                  구글 보안 정책상 카카오톡 내 가입이 제한됩니다.<br/><br/>
                  휴대폰 하단 <strong>'점3개'</strong>를 클릭 하면 <br/>
                  <span className="text-lg text-red-800">"다른 브라우저로 열기"</span><br/>
                  를 선택하여 가입을 진행해주세요!
                </div>
              </div>
            ) : (
              <>
                {isAlreadyMember ? (
                  <Button 
                    className="w-full h-14 text-lg font-bold shadow-lg bg-green-600 hover:bg-green-700 rounded-2xl" 
                    onClick={() => {
                       navigate(`/groups/${groupId}`);
                     }}
                  >
                    모임방으로 입장하기
                  </Button>
                ) : (
                  <Button 
                    className="w-full h-14 text-lg font-bold shadow-lg rounded-2xl" 
                    onClick={handleJoin}
                    disabled={joining}
                  >
                    {joining ? (
                      <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span> 처리 중...</>
                    ) : '모임 참가하기'}
                  </Button>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
