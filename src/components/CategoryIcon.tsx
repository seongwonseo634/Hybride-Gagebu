import React from 'react';
import { 
  Utensils, 
  Bus, 
  ShoppingBag, 
  Film, 
  HeartPulse, 
  Zap, 
  Home, 
  BookOpen, 
  Gift, 
  Wallet,
  Coins,
  Receipt,
  MoreHorizontal
} from 'lucide-react';

export function CategoryIcon({ category, className }: { category: string, className?: string }) {
  if (category.includes('식비')) return <Utensils className={className} />;
  if (category.includes('교통')) return <Bus className={className} />;
  if (category.includes('쇼핑') || category.includes('뷰티')) return <ShoppingBag className={className} />;
  if (category.includes('문화') || category.includes('여가')) return <Film className={className} />;
  if (category.includes('건강') || category.includes('운동')) return <HeartPulse className={className} />;
  if (category.includes('공과금') || category.includes('요금')) return <Zap className={className} />;
  if (category.includes('주거') || category.includes('통신')) return <Home className={className} />;
  if (category.includes('교육')) return <BookOpen className={className} />;
  if (category.includes('경조사')) return <Gift className={className} />;
  if (category.includes('월급')) return <Coins className={className} />;
  
  // Default icon
  return <Wallet className={className} />;
}
