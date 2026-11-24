import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg bg-[#111315] border border-[#D4A843]/50 px-4 py-2 text-xs font-semibold text-white shadow-lg">
      <WifiOff className="w-4 h-4 text-[#D4A843]" />
      <span>لا يوجد اتصال بالإنترنت — يتم عرض البيانات المحفوظة</span>
    </div>
  );
}
