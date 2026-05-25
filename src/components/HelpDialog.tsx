import React from 'react';
import { useLocation } from 'react-router-dom';
import { CircleHelp } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';

const helpContent: Record<string, { title: string; content: React.ReactNode }> = {
  "/": {
    title: "대시보드 사용법",
    content: (
       <div className="space-y-4 text-sm font-medium text-muted-foreground leading-relaxed">
         <p>가계부의 홈 화면입니다. 로그인 후 자동 동기화된 데이터를 관리합니다.</p>
         <h4 className="font-bold text-primary">주요 기능</h4>
         <ul className="list-disc pl-5 space-y-1">
           <li>상단에서 기간별(주, 월, 3개월 등) 데이터를 필터링하세요.</li>
           <li>주요 분석 지표(순자산, 지출)를 한눈에 볼 수 있습니다.</li>
           <li>검색창을 통해 특정 지출 내역을 빠르게 찾아볼 수 있습니다.</li>
         </ul>
       </div>
    )
  },
  "/report": {
    title: "리포트 사용법",
    content: (
       <div className="space-y-4 text-sm font-medium text-muted-foreground leading-relaxed">
         <p>나의 재무 상태를 심층 분석하는 리포트 화면입니다.</p>
         <h4 className="font-bold text-primary">주요 기능</h4>
         <ul className="list-disc pl-5 space-y-1">
           <li>연간 수입/지출 추세를 그래프로 확인하여 소비 패턴을 파악하세요.</li>
           <li>재무 건강 점수를 통해 현재 상태를 진단하세요.</li>
           <li>리포트를 PDF로 다운로드하여 소중한 기록으로 남기거나 공유할 수 있습니다.</li>
         </ul>
       </div>
    )
  },
  "/calendar": {
     title: "달력 사용법",
     content: (
        <div className="space-y-4 text-sm font-medium text-muted-foreground leading-relaxed">
          <p>날짜별로 지출 및 수입 내역을 한눈에 볼 수 있습니다.</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>특정 날짜를 클릭하면 그날 작성한 상세한 지출/수입 내역을 바로 확인할 수 있습니다.</li>
            <li>캘린더를 통해 지출이 집중된 날짜를 파악하여 소비를 계획적으로 관리하세요.</li>
          </ul>
        </div>
     )
  },
  "/input": {
      title: "내역 추가 사용법",
      content: (
         <div className="space-y-4 text-sm font-medium text-muted-foreground leading-relaxed">
           <p>새로운 지출 혹은 수입 내역을 입력합니다.</p>
           <ul className="list-disc pl-5 space-y-1">
             <li>홈 화면 하단의 '+' 버튼을 통해 편리하게 입력할 수 있습니다.</li>
             <li>날짜, 적절한 분류(카테고리), 금액을 입력하신 후 저장하세요.</li>
             <li>입력한 내용은 실시간으로 대시보드와 리포트에 반영됩니다.</li>
           </ul>
         </div>
      )
  },
  "/groups": {
      title: "모임 사용법",
      content: (
         <div className="space-y-4 text-sm font-medium text-muted-foreground leading-relaxed">
           <p>친구, 가족과 함께 가계부를 공유하고 관리할 수 있습니다.</p>
           <ul className="list-disc pl-5 space-y-1">
             <li>모임원들과 함께 동일한 지출 내역을 공유/관리합니다.</li>
             <li>공동 목표를 설정하고 함께 재무 건강을 챙겨보세요.</li>
           </ul>
         </div>
      )
  },
  "/settings": {
      title: "설정 사용법",
      content: (
         <div className="space-y-4 text-sm font-medium text-muted-foreground leading-relaxed">
           <p>나만의 가계부를 위한 개인화 설정을 관리합니다.</p>
           <h4 className="font-bold text-primary">주요 기능</h4>
           <ul className="list-disc pl-5 space-y-1">
             <li><strong>스프레드시트 동기화:</strong> 데이터 CSV 다운로드 및 업로드로 외부 편집 후 동기화 가능합니다.</li>
             <li><strong>카테고리 관리:</strong> 나만의 지출 패턴에 맞춰 카테고리를 직접 추가하거나 수정/삭제할 수 있습니다.</li>
             <li><strong>디자인 설정:</strong> UI 투명도를 조절하여 취향에 맞는 글래스모피즘 효과로 앱 분위기를 설정하세요.</li>
             <li>고객센터 문의는 <a href="mailto:seongwonseo634@gmail.com" className="text-brand-coral font-bold underline">seongwonseo634@gmail.com</a> 으로 연락주세요.</li>
           </ul>
         </div>
      )
  }
};

export function HelpContent({ pathname }: { pathname?: string }) {
    const location = useLocation();
    const effectivePath = pathname || location.pathname;
    
    if (effectivePath === "/all") {
        return (
              <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
                {Object.entries(helpContent).map(([path, info]) => (
                    <div key={path} className="border-b pb-4 last:border-0 last:pb-0">
                        <DialogHeader className="mb-2">
                            <DialogTitle className="text-lg font-bold text-primary">{info.title}</DialogTitle>
                        </DialogHeader>
                        {info.content}
                    </div>
                ))}
            </div>
        );
    }
    
    const help = helpContent[effectivePath] || helpContent["/"];
    
    return (
        <>
            <DialogHeader>
                <DialogTitle className="text-xl font-bold">{help.title}</DialogTitle>
            </DialogHeader>
            {help.content}
        </>
    );
}

export default function HelpDialog() {
  return (
    <Dialog>
      <DialogTrigger className="neo-button p-2 text-muted-foreground flex items-center justify-center hover:text-primary">
        <CircleHelp size={18} />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md neo rounded-2xl border-none">
        <HelpContent />
      </DialogContent>
    </Dialog>
  );
}
