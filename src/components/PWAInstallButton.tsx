import { useState } from 'react';
import { Download, Share, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'default' | 'hero' | 'dark' | 'dock';
}

export function PWAInstallButton({ variant = 'default' }: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (!accepted) {
        return;
      }
      return;
    }
    setShowGuide(true);
  };

  const buttonClass =
    variant === 'dock'
      ? 'flex-1 min-w-[140px] flex items-center justify-center gap-2 px-3.5 py-2.5 bg-zinc-900/90 hover:bg-zinc-800 text-zinc-100 text-xs font-semibold transition-colors whitespace-nowrap'
      : variant === 'hero'
        ? 'inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-[#D4A843] bg-zinc-900 hover:bg-zinc-800 border border-[#D4A843]/40 rounded-lg transition-colors whitespace-nowrap shrink-0'
        : variant === 'dark'
          ? 'inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#111315] hover:bg-zinc-800 rounded-lg transition-colors whitespace-nowrap shrink-0'
          : 'inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[#111315] bg-white border border-zinc-300 hover:border-[#111315] rounded-lg transition-colors whitespace-nowrap shrink-0';

  return (
    <>
      <button type="button" onClick={handleClick} className={buttonClass}>
        <Download className="w-4 h-4 text-[#D4A843]" />
        <span>
          {isInstallable
            ? 'تثبيت التطبيق على الشاشة الرئيسية'
            : isIOS
              ? 'إضافة للشاشة الرئيسية (iPhone)'
              : 'إضافة للشاشة الرئيسية'}
        </span>
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px] p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-white border border-zinc-200 rounded-xl shadow-2xl overflow-hidden text-right">
            <div className="flex items-center justify-between px-6 py-4 bg-[#111315] text-white">
              <div className="flex items-center gap-2.5">
                <Smartphone className="w-5 h-5 text-[#D4A843]" />
                <h3 className="text-base font-bold">تثبيت تطبيق أكاديمية البوب</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="p-1 text-zinc-400 hover:text-white"
                aria-label="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-sm text-zinc-700 leading-relaxed">
              {isIOS ? (
                <div className="space-y-3">
                  <p className="font-semibold text-[#111315]">
                    لتثبيت التطبيق على iPhone أو iPad وتفعيل الإشعارات الفورية:
                  </p>
                  <ol className="space-y-2.5 text-xs sm:text-sm list-decimal list-inside">
                    <li>
                      تأكد من فتح الرابط باستخدام متصفح <strong>Safari</strong>.
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span>اضغط على أيقونة المشاركة</span>
                      <Share className="w-4 h-4 text-[#B91C1C] inline shrink-0 mt-0.5" />
                      <span>في شريط المتصفح بالأسفل.</span>
                    </li>
                    <li>
                      اسحب لأعلى واختر <strong>إضافة إلى الشاشة الرئيسية (Add to Home Screen)</strong> ثم اضغط <strong>إضافة</strong>.
                    </li>
                    <li>
                      افتح التطبيق من أيقونته على الشاشة الرئيسية واضغط <strong>تفعيل الإشعارات الفورية</strong>.
                    </li>
                  </ol>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="font-semibold text-[#111315]">
                    لتثبيت التطبيق على Android أو الكمبيوتر بدون متجر:
                  </p>
                  <ol className="space-y-2.5 text-xs sm:text-sm list-decimal list-inside">
                    <li>
                      افتح قائمة المتصفح (النقاط الثلاث <strong>⋮</strong> في Chrome).
                    </li>
                    <li>
                      اختر <strong>تثبيت التطبيق (Install App)</strong> أو <strong>الإضافة إلى الشاشة الرئيسية (Add to Home screen)</strong>.
                    </li>
                    <li>
                      سيظهر شعار <strong>أكاديمية البوب</strong> كتطبيق مستقل على هاتفك.
                    </li>
                  </ol>
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="w-full py-2.5 bg-[#111315] hover:bg-zinc-800 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                فهمت
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
