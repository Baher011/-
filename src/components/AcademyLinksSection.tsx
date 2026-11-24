import { ArrowUpLeft, Globe, MapPin } from 'lucide-react';

interface AcademyPlatformLink {
  id: string;
  name: string;
  handle: string;
  description: string;
  href: string;
  accentBg: string;
  accentText: string;
  colSpanClass?: string;
  renderIcon: () => React.ReactNode;
}

const GOOGLE_MAPS_URL = 'https://maps.app.goo.gl/VXBhEwgYCcf5Nio27';

const ACADEMY_PLATFORMS: AcademyPlatformLink[] = [
  {
    id: 'maps',
    name: 'لوكيشن الأكاديمية (خرائط Google)',
    handle: 'ميت غمر · محافظة الدقهلية',
    description: 'اتجاهات الوصول المباشرة لمقر أكاديمية البوب في ميت غمر',
    href: GOOGLE_MAPS_URL,
    accentBg: 'bg-red-50 border-red-200',
    accentText: 'text-[#B91C1C]',
    colSpanClass: 'sm:col-span-2 lg:col-span-2',
    renderIcon: () => <MapPin className="w-4 h-4" />,
  },
  {
    id: 'website',
    name: 'الموقع التعريفي للأكاديمية',
    handle: 'el-bob-academy',
    description: 'صفحة الأكاديمية الرسمية وبرامج التدريب',
    href: 'https://sites.google.com/view/el-bob-academy/?fbclid=IwZXh0bgNhZW0CMTEAcGRvZgFzcnRjBmFwcF9pZAwzNTA2ODU1MzE3MjgAAR8ivg2xXElqPKvko-jTv3YcRZJrF-YGM_b2cNP0Re8ED5JowCdEGtuC0_aufQ_aem_gYi3_SuU5nTWx9ZKWw-PPg',
    accentBg: 'bg-amber-50 border-amber-200',
    accentText: 'text-[#A17415]',
    renderIcon: () => <Globe className="w-4 h-4" />,
  },
  {
    id: 'facebook',
    name: 'فيسبوك (Facebook)',
    handle: 'الصفحة الرسمية',
    description: 'أخبار التدريبات اليومية ونتائج البطولات',
    href: 'https://www.facebook.com/share/1A7wn6H5Dg/',
    accentBg: 'bg-blue-50 border-blue-200',
    accentText: 'text-[#1877F2]',
    renderIcon: () => (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M22.675 0H1.325C.593 0 0 .593 0 1.325v21.351C0 23.407.593 24 1.325 24H12.82v-9.294H9.692v-3.622h3.128V8.413c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12V24h6.116c.73 0 1.323-.593 1.323-1.325V1.325C24 .593 23.407 0 22.675 0z" />
      </svg>
    ),
  },
  {
    id: 'youtube',
    name: 'يوتيوب (YouTube)',
    handle: '@elpop_acadimy',
    description: 'فيديوهات التدريبات وعروض الأبطال',
    href: 'https://youtube.com/@elpop_acadimy?si=1wNPL-uMb1-7eZVy',
    accentBg: 'bg-red-50 border-red-200',
    accentText: 'text-[#DC2626]',
    renderIcon: () => (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    ),
  },
  {
    id: 'tiktok',
    name: 'تيك توك (TikTok)',
    handle: 'مقاطع قصيرة',
    description: 'لقطات حماسية وتحديات لياقة من الصالة',
    href: 'https://vm.tiktok.com/ZS9PaFYsKXhqQ-KEsKW/',
    accentBg: 'bg-zinc-100 border-zinc-300',
    accentText: 'text-[#111315]',
    renderIcon: () => (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
      </svg>
    ),
  },
  {
    id: 'threads',
    name: 'ثريدز (Threads)',
    handle: '@elpop_academy',
    description: 'تحديثات يومية ونصائح رياضية سريعة',
    href: 'https://www.threads.com/@elpop_academy',
    accentBg: 'bg-zinc-100 border-zinc-300',
    accentText: 'text-[#111315]',
    renderIcon: () => (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.563c-1.108-3.987-3.903-6.017-8.308-6.017h-.008c-2.905.02-5.118.953-6.578 2.773-1.36 1.693-2.063 4.09-2.089 7.12.026 3.033.729 5.43 2.089 7.122 1.46 1.82 3.673 2.753 6.578 2.773h.008c2.473-.017 4.462-.637 5.913-1.842 1.588-1.32 2.411-3.204 2.448-5.603-.183-.11-.373-.21-.57-.298-.52 2.094-1.691 3.743-3.368 4.657-1.106.603-2.404.909-3.858.909-1.99 0-3.658-.637-4.825-1.843-1.064-1.1-1.627-2.558-1.627-4.217 0-1.908.73-3.442 2.113-4.436 1.24-.892 2.903-1.339 4.943-1.339.989 0 1.933.106 2.809.316-.277-1.26-.88-2.203-1.797-2.794-.82-.528-1.84-.796-3.032-.796-.993 0-1.918.215-2.75.638l-.923-1.894c1.102-.56 2.34-.844 3.68-.844 1.626 0 3.04.39 4.202 1.158 1.525 1.008 2.463 2.607 2.789 4.756.712.263 1.366.612 1.946 1.045.805.6 1.425 1.385 1.829 2.323.168.39.277.81.327 1.244l.004.061v.062c-.036 3.084-1.132 5.611-3.257 7.376-1.838 1.527-4.311 2.309-7.35 2.329zm-1.113-6.647c1.057 0 1.96-.244 2.683-.726.942-.627 1.532-1.662 1.755-3.076-.887-.238-1.843-.359-2.845-.359-1.584 0-2.842.31-3.739.954-.867.624-1.289 1.535-1.289 2.787 0 1.113.347 2.025 1.004 2.705.758.783 1.908 1.18 3.416 1.18l.015-.001v-3.464z" />
      </svg>
    ),
  },
  {
    id: 'x',
    name: 'منصة إكس (X)',
    handle: '@elpop_academy',
    description: 'التنبيهات السريعة ومواعيد البطولات',
    href: 'https://x.com/elpop_academy',
    accentBg: 'bg-zinc-100 border-zinc-300',
    accentText: 'text-[#111315]',
    renderIcon: () => (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
];

export function AcademyLinksSection() {
  return (
    <section
      id="academy-links-section"
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-2"
    >
      <div className="bg-white/95 border border-zinc-200 rounded-xl overflow-hidden">
        {/* Top Unified Header & Address Strip */}
        <div className="bg-[#111315] text-white px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-[#D4A843]/15 border border-[#D4A843]/40 flex items-center justify-center text-[#D4A843] shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-[#D4A843]">
                العنوان الرسمي ومنصات أكاديمية البوب
              </div>
              <div className="text-sm sm:text-base font-extrabold text-white mt-0.5">
                ميت غمر — محافظة الدقهلية
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                جميع المواقع والحسابات الرسمية للأكاديمية مع خريطة الوصول المباشر لمقر التدريب
              </p>
            </div>
          </div>

          <a
            href={GOOGLE_MAPS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#D4A843] hover:bg-[#c29634] text-[#111315] text-xs font-bold rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <MapPin className="w-4 h-4" />
            <span>فتح اللوكيشن على الخريطة</span>
            <ArrowUpLeft className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* All Platforms & Links Grouped in One Unified Hairline Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-zinc-200">
          {ACADEMY_PLATFORMS.map((item) => (
            <a
              key={item.id}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`group bg-white hover:bg-[#F8F8F6] px-4 py-3.5 flex items-start gap-3 transition-colors ${
                item.colSpanClass ?? ''
              }`}
            >
              <div
                className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 ${item.accentBg} ${item.accentText}`}
              >
                {item.renderIcon()}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs sm:text-sm font-bold text-[#111315] group-hover:text-[#B91C1C] transition-colors truncate">
                    {item.name}
                  </h3>
                  <ArrowUpLeft className="w-3.5 h-3.5 text-zinc-400 group-hover:text-[#111315] shrink-0 transition-transform duration-150 group-hover:-translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
                <div className="text-[11px] font-mono text-zinc-500 mt-0.5 truncate" dir="ltr">
                  {item.handle}
                </div>
                <p className="text-[11px] text-zinc-600 mt-1 leading-relaxed line-clamp-1">
                  {item.description}
                </p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
