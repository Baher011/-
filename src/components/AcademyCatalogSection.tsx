import { useEffect, useMemo, useState } from 'react';
import {
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Maximize2,
  MessageCircle,
  UserPlus,
  X,
} from 'lucide-react';
import { subscribeApprovedCatalogPhotos } from '../lib/firestoreApi';
import type { CatalogCategory as DynamicCatalogCategory, CatalogPhotoItem } from '../types';
import { AcademyImage } from './AcademyImage';

type CatalogCategory = 'all' | DynamicCatalogCategory;

interface CatalogPhoto {
  id: string;
  src: string;
  title: string;
  caption: string;
  category: DynamicCatalogCategory;
  creditLabel?: string;
}

const INITIAL_VISIBLE_COUNT = 6;

const CATALOG_PHOTOS: CatalogPhoto[] = [
  {
    id: 'cat-01',
    src: '/assets/aistudio/IMG_________________a6567e8f.jpg',
    title: 'الهوية الرسمية لأكاديمية البوب',
    caption: 'تدريب كونغ فو · كيك بوكسينج · MMA بإشراف كابتن باهر مراد (01080486524)',
    category: 'identity',
  },
  {
    id: 'cat-02',
    src: '/assets/aistudio/FB_IMG_17932178214766992_5076c43e.jpg',
    title: 'كابتن باهر مراد وحزام البطولة',
    caption: 'المدير الفني للأكاديمية مع حزام بطولة WSC داخل الحلبة',
    category: 'coach',
  },
  {
    id: 'cat-03',
    src: '/assets/aistudio/FB_IMG_17912949347381764_bfeb88c5.jpg',
    title: 'سجل البطولات والميداليات',
    caption: 'مقر كابتن باهر مراد يجمع عشرات الميداليات والكؤوس والشهادات المعتمدة',
    category: 'coach',
  },
  {
    id: 'cat-04',
    src: '/assets/aistudio/IMG_________________ab1d1edc.jpg',
    title: 'داخل صالة التدريب والحلبة',
    caption: 'كابتن باهر مراد وسط لاعبي الأكاديمية في حصة الإعداد البدني والفني',
    category: 'coach',
  },
  {
    id: 'cat-05',
    src: '/assets/aistudio/FB_IMG_17917434222688310_26f6ff6c.jpg',
    title: 'الاعتمادات الرسمية للاتحادات',
    caption: 'معتمدة لدى الاتحاد المصري للكيك بوكسينج E.K.F والووشو كونغ فو EWKF',
    category: 'identity',
  },
  {
    id: 'cat-06',
    src: '/assets/aistudio/FB_IMG_17917434247381252_56f5f6b8.jpg',
    title: 'بيانات التواصل الرسمية',
    caption: 'كابتن باهر مراد — مدرب كونغ فو وكيك بوكسينج · واتساب وهاتف 01080486524',
    category: 'identity',
  },
  {
    id: 'cat-07',
    src: '/assets/aistudio/IMG_________________7c00dc92.jpg',
    title: 'وقفة القتال والاستعداد البدني',
    caption: 'تدريب عملي على التكنيك واللياقة القتالية داخل صالة الأكاديمية',
    category: 'coach',
  },
  {
    id: 'cat-08',
    src: '/assets/aistudio/Screenshot_____-__-__-__-__-__-____com.google.android.googlequicksearchbox_55609a2e.jpg',
    title: 'لوحة أبطال وإنجازات الأكاديمية',
    caption: 'مقتطفات من تتويجات أبطال أكاديمية البوب وتدريبات المرونة والبطولات',
    category: 'champions',
  },
  {
    id: 'cat-09',
    src: '/assets/aistudio/IMG-20260716-WA0018_363ce245.jpg',
    title: 'بطل المركز الأول — كونغ فو للناشئين',
    caption: 'أحد براعم أكاديمية البوب متوجاً بالميدالية الذهبية وشهادة التقدير',
    category: 'champions',
  },
  {
    id: 'cat-10',
    src: '/assets/aistudio/Screenshot_____-__-__-__-__-__-____com.google.android.apps.photos_79620a07.jpg',
    title: 'تتويج بطل الكيك بوكسينج للناشئين',
    caption: 'ميدالية ذهبية ودرع التميز وشهادة الاتحاد في بطولة الكيك بوكسينج',
    category: 'champions',
  },
  {
    id: 'cat-11',
    src: '/assets/aistudio/Screenshot_____-__-__-__-__-__-____com.google.android.apps.photos_a80b319e.jpg',
    title: 'بطل أكاديمية البوب على منصة التتويج',
    caption: 'المشاركة الرسمية بزي الأكاديمية وحصد الميدالية الذهبية',
    category: 'champions',
  },
  {
    id: 'cat-12',
    src: '/assets/aistudio/IMG-20260826-WA0003_cf403db3.jpg',
    title: 'تكريم البطلات ودرع التميز',
    caption: 'كابتن باهر مراد مع إحدى بطلات الأكاديمية بعد حصد شهادة البطولة',
    category: 'champions',
  },
  {
    id: 'cat-13',
    src: '/assets/aistudio/IMG-20260826-WA0002_da1465bc.jpg',
    title: 'تتويج جماعي لأبطال الأكاديمية',
    caption: 'ناشئو أكاديمية البوب بالميداليات الذهبية وشهادات المركز الأول',
    category: 'champions',
  },
  {
    id: 'cat-14',
    src: '/assets/aistudio/IMG-20260826-WA0001_5580743a.jpg',
    title: 'فرحة الفوز والبطولة',
    caption: 'تشجيع مستمر من كابتن باهر مراد لبناء ثقة الأبطال الصغار',
    category: 'champions',
  },
  {
    id: 'cat-15',
    src: '/assets/aistudio/FB_IMG_17932179290424341_b9aa1236.jpg',
    title: 'تتويج بطلة الأكاديمية بالميدالية الذهبية',
    caption: 'استلام الميدالية ودرع التكريم داخل صالة التدريب',
    category: 'champions',
  },
  {
    id: 'cat-16',
    src: '/assets/aistudio/FB_IMG_17932179336275175_76d84afc.jpg',
    title: 'دعم وتحفيز الأبطال الصغار',
    caption: 'تكريم مميز بعد الفوز بالميدالية الذهبية ودرع التفوق',
    category: 'champions',
  },
  {
    id: 'cat-17',
    src: '/assets/aistudio/Screenshot_____-__-__-__-__-__-____com.google.android.googlequicksearchbox_4597d563.jpg',
    title: 'بطل من براعم أكاديمية البوب',
    caption: 'فرحة التتويج بالميدالية الذهبية وشهادة البطولة مع الكابتن',
    category: 'champions',
  },
  {
    id: 'cat-18',
    src: '/assets/aistudio/Screenshot_____-__-__-__-__-__-____com.google.android.googlequicksearchbox_1cf54b5c.jpg',
    title: 'حفل تكريم لاعبي الأكاديمية',
    caption: 'تسليم شهادات التقدير والميداليات لمجموعة الناشئين',
    category: 'champions',
  },
  {
    id: 'cat-19',
    src: '/assets/aistudio/FB_IMG_17932178963587286_394cc50f.jpg',
    title: 'تدريبات المرونة وفتح الحوض',
    caption: 'تأهيل بدني ومرونة احترافية للناشئين تحت إشراف مباشر',
    category: 'training',
  },
  {
    id: 'cat-20',
    src: '/assets/aistudio/FB_IMG_17932179040378213_1d7c8f28.jpg',
    title: 'تمارين اللياقة المتقدمة للناشئين',
    caption: 'تطوير مدى الحركة والمرونة بأمان تام على بساط الأكاديمية',
    category: 'training',
  },
  {
    id: 'cat-21',
    src: '/assets/aistudio/FB_IMG_17932179066353097_d77d218b.jpg',
    title: 'إحماء وتأهيل قبل التمرين',
    caption: 'تدريبات جماعية لتنمية التوازن والقوة العضلية للصغار',
    category: 'training',
  },
  {
    id: 'cat-22',
    src: '/assets/aistudio/Snapchat-1836750938_2e0d3ceb.jpg',
    title: 'من قلب حصة الكيك بوكسينج',
    caption: 'تدريب الناشئين بزي البطولة داخل صالة أكاديمية البوب',
    category: 'training',
  },
];

interface AcademyCatalogSectionProps {
  onRegisterClick: () => void;
}

export function AcademyCatalogSection({ onRegisterClick }: AcademyCatalogSectionProps) {
  const [activeCategory, setActiveCategory] = useState<CatalogCategory>('all');
  const [expanded, setExpanded] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [approvedDynamicPhotos, setApprovedDynamicPhotos] = useState<CatalogPhotoItem[]>([]);

  useEffect(() => {
    const unsub = subscribeApprovedCatalogPhotos((photos) => {
      setApprovedDynamicPhotos(photos);
    });
    return () => unsub();
  }, []);

  const allPhotos = useMemo<CatalogPhoto[]>(() => {
    const dynamicMapped: CatalogPhoto[] = approvedDynamicPhotos.map((p) => ({
      id: p.id,
      src: p.imageUrl,
      title: p.title,
      caption:
        p.caption ||
        (p.submittedByRole === 'parent'
          ? `مشاركة ولي أمر (${p.athleteName || p.submittedByName}) — بموافقة كابتن باهر مراد`
          : 'مضافة من كابتن باهر مراد — أكاديمية البوب'),
      category: p.category,
      creditLabel: p.submittedByRole === 'parent' ? `مشاركة: ${p.submittedByName}` : 'إدارة الأكاديمية',
    }));
    return [...dynamicMapped, ...CATALOG_PHOTOS];
  }, [approvedDynamicPhotos]);

  const categoryTabs = useMemo<Array<{ key: CatalogCategory; label: string }>>(
    () => [
      { key: 'all', label: `الكل (${allPhotos.length})` },
      {
        key: 'champions',
        label: `الأبطال (${allPhotos.filter((p) => p.category === 'champions').length})`,
      },
      {
        key: 'coach',
        label: `الكابتن (${allPhotos.filter((p) => p.category === 'coach').length})`,
      },
      {
        key: 'training',
        label: `التدريبات (${allPhotos.filter((p) => p.category === 'training').length})`,
      },
      {
        key: 'identity',
        label: `الاعتمادات (${allPhotos.filter((p) => p.category === 'identity').length})`,
      },
    ],
    [allPhotos]
  );

  const visiblePhotos = useMemo(() => {
    if (activeCategory === 'all') return allPhotos;
    return allPhotos.filter((p) => p.category === activeCategory);
  }, [activeCategory, allPhotos]);

  const displayedPhotos = useMemo(() => {
    if (expanded || visiblePhotos.length <= INITIAL_VISIBLE_COUNT) {
      return visiblePhotos;
    }
    return visiblePhotos.slice(0, INITIAL_VISIBLE_COUNT);
  }, [expanded, visiblePhotos]);

  const activePhoto =
    selectedIndex !== null && visiblePhotos[selectedIndex]
      ? visiblePhotos[selectedIndex]
      : null;

  useEffect(() => {
    if (selectedIndex === null) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedIndex(null);
      } else if (e.key === 'ArrowLeft') {
        setSelectedIndex((prev) =>
          prev === null ? null : (prev + 1) % visiblePhotos.length
        );
      } else if (e.key === 'ArrowRight') {
        setSelectedIndex((prev) =>
          prev === null
            ? null
            : (prev - 1 + visiblePhotos.length) % visiblePhotos.length
        );
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedIndex, visiblePhotos.length]);

  return (
    <section
      id="academy-catalog-section"
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10"
    >
      <div className="bg-white/95 border border-zinc-200 rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-zinc-200 pb-3.5">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#B91C1C]">
              <Camera className="w-3.5 h-3.5" />
              <span>كتالوج أكاديمية البوب للراغبين في التسجيل</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-[#111315] mt-0.5">
              معرض الصور والإنجازات والتدريبات
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {categoryTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setActiveCategory(tab.key);
                    setExpanded(false);
                    setSelectedIndex(null);
                  }}
                  className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-md border transition-colors whitespace-nowrap ${
                    activeCategory === tab.key
                      ? 'bg-[#111315] text-[#D4A843] border-[#111315]'
                      : 'bg-[#F8F8F6] text-zinc-700 border-zinc-200 hover:border-zinc-400'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onRegisterClick}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#D4A843] hover:bg-[#c29634] text-[#111315] text-[11px] font-bold rounded-md transition-colors whitespace-nowrap"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>سجّل لاعبك الآن</span>
            </button>
          </div>
        </div>

        {/* Compact Catalog Grid */}
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
          {displayedPhotos.map((photo, idx) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setSelectedIndex(idx)}
              className="group text-right bg-[#111315] border border-zinc-200 hover:border-[#D4A843] rounded-lg overflow-hidden flex flex-col transition-colors focus:outline-none focus:ring-2 focus:ring-[#D4A843]"
            >
              <div className="relative w-full aspect-[4/3] bg-[#0D0E10] overflow-hidden">
                <AcademyImage
                  src={photo.src}
                  alt={photo.title}
                  className="w-full h-full object-cover object-top group-hover:scale-[1.03] transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-75 group-hover:opacity-100 transition-opacity" />
                <div className="absolute top-1.5 left-1.5 w-6 h-6 bg-black/70 border border-white/20 text-white rounded flex items-center justify-center opacity-85 group-hover:opacity-100">
                  <Maximize2 className="w-3 h-3 text-[#D4A843]" />
                </div>
                <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 bg-black/75 border border-[#D4A843]/40 text-[#D4A843] text-[9px] font-mono rounded">
                  {String(idx + 1).padStart(2, '0')}
                </div>
              </div>
              <div className="px-2 py-1.5 bg-white w-full">
                <div className="text-[11px] font-bold text-[#111315] line-clamp-1">
                  {photo.title}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Expand / Collapse Bar */}
        {visiblePhotos.length > INITIAL_VISIBLE_COUNT && (
          <div className="flex items-center justify-between gap-3 pt-1">
            <span className="text-[11px] text-zinc-500">
              معروض <span className="font-mono font-semibold text-[#111315]">{displayedPhotos.length}</span> من{' '}
              <span className="font-mono font-semibold text-[#111315]">{visiblePhotos.length}</span> صورة · اضغط على أي صورة للتكبير
            </span>
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#F8F8F6] hover:bg-zinc-200/70 border border-zinc-300 text-[#111315] text-xs font-bold rounded-md transition-colors whitespace-nowrap"
            >
              {expanded ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" />
                  <span>عرض صور أقل</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  <span>عرض باقي الصور ({visiblePhotos.length - INITIAL_VISIBLE_COUNT}+)</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Fullscreen Lightbox Modal */}
      {activePhoto && selectedIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          onClick={() => setSelectedIndex(null)}
        >
          <div
            className="w-full max-w-4xl bg-[#111315] border border-zinc-800 rounded-xl overflow-hidden flex flex-col max-h-[94vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Bar */}
            <div className="px-4 sm:px-6 py-3.5 border-b border-zinc-800 flex items-center justify-between gap-4 text-white">
              <div className="min-w-0">
                <div className="text-sm sm:text-base font-bold text-[#D4A843] truncate">
                  {activePhoto.title}
                </div>
                <div className="text-xs text-zinc-400 truncate mt-0.5">
                  {activePhoto.caption}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs font-mono text-zinc-400 tabular-nums">
                  {selectedIndex + 1} / {visiblePhotos.length}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedIndex(null)}
                  className="p-1.5 text-zinc-400 hover:text-white bg-zinc-800 rounded-lg"
                  aria-label="إغلاق العرض"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Full Photo Display (uncropped object-contain) */}
            <div className="relative flex-1 bg-black flex items-center justify-center p-2 sm:p-4 min-h-[280px] overflow-hidden">
              <AcademyImage
                src={activePhoto.src}
                alt={activePhoto.title}
                className="max-h-[65vh] w-auto max-w-full object-contain rounded-lg"
              />

              {visiblePhotos.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedIndex(
                        (selectedIndex - 1 + visiblePhotos.length) % visiblePhotos.length
                      )
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 bg-black/75 hover:bg-black text-white border border-zinc-700 rounded-lg"
                    aria-label="الصورة السابقة"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedIndex((selectedIndex + 1) % visiblePhotos.length)
                    }
                    className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 bg-black/75 hover:bg-black text-white border border-zinc-700 rounded-lg"
                    aria-label="الصورة التالية"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>

            {/* Bottom Action Bar */}
            <div className="px-4 sm:px-6 py-3.5 border-t border-zinc-800 bg-[#141619] flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-zinc-400">
                أكاديمية البوب للفنون القتالية · ميت غمر، الدقهلية · كابتن باهر مراد
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <a
                  href="https://wa.me/201080486524"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#15803D] hover:bg-[#166534] text-white text-xs font-bold rounded-lg transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>واتساب 01080486524</span>
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedIndex(null);
                    onRegisterClick();
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#D4A843] hover:bg-[#c29634] text-[#111315] text-xs font-bold rounded-lg transition-colors"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>قدّم طلب التسجيل الآن</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
