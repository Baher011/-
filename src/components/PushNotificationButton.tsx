import { useState } from 'react';
import { AlertTriangle, Bell, CheckCircle2, Send, Share, X } from 'lucide-react';
import {
  enablePushNotifications,
  sendTestBackgroundPush,
  type PushEnableResult,
} from '../lib/fcm';
import type { UserProfile } from '../types';

interface PushNotificationButtonProps {
  profile: UserProfile | null;
}

export function PushNotificationButton({ profile }: PushNotificationButtonProps) {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'unsupported'
  );
  const [busy, setBusy] = useState(false);
  const [testBusy, setTestBusy] = useState(false);
  const [feedback, setFeedback] = useState<PushEnableResult | null>(null);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showHelpModal, setShowHelpModal] = useState(false);

  const handleEnable = async () => {
    setBusy(true);
    setTestMsg(null);
    try {
      const result = await enablePushNotifications(profile);
      if (typeof window !== 'undefined' && 'Notification' in window) {
        setPermission(Notification.permission);
      }
      setFeedback(result);
      if (result.status === 'ios_requires_pwa' || result.status === 'denied') {
        setShowHelpModal(true);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleTestPush = async () => {
    setTestBusy(true);
    setTestMsg(null);
    try {
      const res = await sendTestBackgroundPush(profile);
      setTestMsg({ ok: res.ok, text: res.message });
    } finally {
      setTestBusy(false);
    }
  };

  if (permission === 'unsupported') {
    return null;
  }

  return (
    <>
      <div className="flex flex-col items-start gap-1">
        {permission === 'granted' ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={handleEnable}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg transition-colors whitespace-nowrap"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
              <span>{busy ? 'جاري التحديث...' : 'إشعارات الخلفية مفعّلة'}</span>
            </button>
            <button
              type="button"
              disabled={testBusy}
              onClick={handleTestPush}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#111315] bg-white border border-zinc-300 hover:border-[#111315] rounded-lg transition-colors whitespace-nowrap disabled:opacity-60"
            >
              <Send className="w-3.5 h-3.5 text-[#B91C1C]" />
              <span>{testBusy ? 'جاري الإرسال...' : 'تجربة إشعار الخلفية'}</span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={handleEnable}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              permission === 'denied'
                ? 'text-[#B91C1C] bg-red-50 border border-red-200 hover:bg-red-100'
                : 'text-[#111315] bg-[#D4A843] hover:bg-[#c29634]'
            }`}
          >
            {permission === 'denied' ? (
              <AlertTriangle className="w-4 h-4" />
            ) : (
              <Bell className="w-4 h-4" />
            )}
            <span>
              {busy
                ? 'جاري التفعيل...'
                : permission === 'denied'
                  ? 'الإشعارات محظورة — اضغط للتوضيح'
                  : 'تفعيل إشعارات الخلفية'}
            </span>
          </button>
        )}

        {feedback && feedback.status === 'enabled' && !testMsg && (
          <span className="text-[11px] text-emerald-700 font-medium">{feedback.message}</span>
        )}
        {testMsg && (
          <span
            className={`text-[11px] font-medium ${
              testMsg.ok ? 'text-emerald-700' : 'text-[#B91C1C]'
            }`}
          >
            {testMsg.text}
          </span>
        )}
      </div>

      {showHelpModal && feedback && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px] p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-white border border-zinc-200 rounded-xl shadow-2xl overflow-hidden text-right">
            <div className="flex items-center justify-between px-6 py-4 bg-[#111315] text-white">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-[#D4A843]" />
                <h3 className="text-base font-bold">
                  {feedback.status === 'ios_requires_pwa'
                    ? 'تفعيل الإشعارات على iPhone / iPad'
                    : 'إعادة تفعيل إذن الإشعارات'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="p-1 text-zinc-400 hover:text-white"
                aria-label="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-sm text-zinc-700 leading-relaxed">
              <p>{feedback.message}</p>

              {feedback.status === 'ios_requires_pwa' ? (
                <ol className="space-y-2 text-xs sm:text-sm list-decimal list-inside bg-zinc-50 border border-zinc-200 rounded-lg p-4">
                  <li>افتح التطبيق من متصفح Safari.</li>
                  <li className="flex items-start gap-1.5">
                    <span>اضغط زر المشاركة</span>
                    <Share className="w-4 h-4 text-[#B91C1C] inline shrink-0 mt-0.5" />
                    <span>ثم اختر «إضافة إلى الشاشة الرئيسية».</span>
                  </li>
                  <li>افتح أيقونة «البوب للقتال» من الشاشة الرئيسية واضغط «تفعيل الإشعارات الفورية».</li>
                </ol>
              ) : (
                <ol className="space-y-2 text-xs sm:text-sm list-decimal list-inside bg-zinc-50 border border-zinc-200 rounded-lg p-4">
                  <li>اضغط على أيقونة القفل أو الإعدادات بجانب رابط الموقع في المتصفح.</li>
                  <li>افتح «الأذونات» (Permissions) أو «إعدادات الموقع».</li>
                  <li>غيّر خيار «الإشعارات» (Notifications) إلى «السماح» (Allow) ثم أعد تحميل الصفحة.</li>
                </ol>
              )}

              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="w-full py-2.5 bg-[#111315] hover:bg-zinc-800 text-white text-sm font-semibold rounded-lg"
              >
                حسناً
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
