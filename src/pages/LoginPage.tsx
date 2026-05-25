import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { GoogleAuthProvider } from 'firebase/auth';
import { useAuth } from '../contexts/AuthContext';
import { loginWithGoogle } from '../lib/firebase';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Wallet } from 'lucide-react';
import { toast } from 'sonner';

export default function LoginPage() {
  const { user, setGmailToken } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { from?: string | { pathname: string } };
  const from = (() => {
    const searchParams = new URLSearchParams(location.search);
    const inviteParam = searchParams.get('invite');
    if (inviteParam) return `/invite/${inviteParam}`;

    const pendingId = localStorage.getItem('pending_invite_id');
    if (pendingId) return `/invite/${pendingId}`;
    
    if (typeof state?.from === 'string') return state.from;
    return (state?.from as any)?.pathname || '/';
  })();

  useEffect(() => {
    if (user) navigate(from);
  }, [user, navigate, from]);

  const handleLogin = async () => {
    try {
      const result = await loginWithGoogle();
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setGmailToken(credential.accessToken);
      }
      toast.success('로그인되었습니다');
    } catch (error) {
      console.error(error);
      toast.error('로그인에 실패했습니다');
    }
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm shadow-2xl border-none">
        <CardHeader className="text-center space-y-4 pb-8">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Wallet className="w-8 h-8 text-primary" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl font-bold tracking-tight">하이브리드 가계부</CardTitle>
            <CardDescription className="text-base">
              개인 및 모임 가계부를 한 곳에서 편리하게 관리하세요
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {/KAKAOTALK/i.test(navigator.userAgent) ? (
            <div className="p-5 bg-red-50 rounded-2xl border border-red-200 text-center space-y-4">
              <p className="text-base font-bold text-red-700">카카오톡 접속 감지</p>
              <div className="text-sm text-red-600 leading-relaxed font-semibold">
                구글 보안 정책으로 앱 내 로그인이 불가능합니다.<br/><br/>
                휴대폰 하단 <strong>'점3개'</strong>를 클릭 하면 <br/>
                <span className="text-lg text-red-800">"다른 브라우저로 열기"</span><br/>
                를 선택하여 다시 시도해 주세요!
              </div>
            </div>
          ) : (
            <>
              <Button 
                onClick={handleLogin} 
                className="neo-button w-full h-12 text-base font-medium shadow-sm transition-all hover:scale-[1.02]"
              >
                Google 계정으로 시작하기
              </Button>
    
              <div className="p-3 bg-yellow-50 rounded-xl border border-yellow-200 mt-6 md:mt-8">
                <p className="text-[10px] text-yellow-800 leading-relaxed text-center font-medium">
                  인앱 브라우저(카카오톡 등)에서 로그인 오류가 발생한다면,<br/>
                  휴대폰 하단 <strong>'점3개'</strong>를 클릭 하면 <strong>'다른 브라우저로 열기'</strong>를 <br/>
                  선택한 후 다시 시도해 주세요.
                </p>
              </div>
            </>
          )}

          <p className="mt-6 text-center text-xs text-muted-foreground italic">
            계속 진행하면 서비스 이용약관 및 개인정보 처리방침에 동의하게 됩니다.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
