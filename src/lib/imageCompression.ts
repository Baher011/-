export async function compressImageFileToDataUrl(
  file: File
): Promise<{ dataUrl: string; width: number; height: number }> {
  if (!file || !file.type.startsWith('image/')) {
    throw new Error('يرجى اختيار ملف صورة صالح (JPG أو PNG أو WEBP)');
  }

  if (file.size > 15 * 1024 * 1024) {
    throw new Error('حجم الصورة كبير جداً (الحد الأقصى 15 ميجابايت قبل الضغط)');
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('تعذر قراءة الصورة المختارة، جرب صورة أخرى'));
      el.src = objectUrl;
    });

    const MAX_DATA_URL_LENGTH = 360000;
    const dimensionSteps = [960, 760, 600];
    const qualitySteps = [0.78, 0.65, 0.52, 0.42];

    for (const maxSide of dimensionSteps) {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const targetWidth = Math.max(1, Math.round(img.width * scale));
      const targetHeight = Math.max(1, Math.round(img.height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('متصفحك لا يدعم معالجة الصور');
      }
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, targetWidth, targetHeight);
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      for (const quality of qualitySteps) {
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        if (dataUrl.length <= MAX_DATA_URL_LENGTH) {
          return { dataUrl, width: targetWidth, height: targetHeight };
        }
      }
    }

    throw new Error('حجم الصورة بعد الضغط لا يزال كبيراً، يرجى اختيار صورة أصغر حجماً');
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
