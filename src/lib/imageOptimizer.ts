/**
 * Browser-side image compression and scaling utility.
 * 
 * Prevents huge raw camera files (e.g. 10MB - 15MB) taken by iPhones and Android devices
 * from exhausting Supabase cached egress limits (5GB free tier).
 * Resizes images to max 1920px and compresses to high-quality JPEG/WebP (~200KB - 350KB),
 * delivering up to 98% bandwidth reduction with no visible loss in quality.
 */

export interface OptimizationOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  outputType?: 'image/jpeg' | 'image/webp';
}

export async function optimizeImageForUpload(
  file: File,
  options: OptimizationOptions = {}
): Promise<File> {
  // If not an image or SVG/GIF, skip
  if (!file.type.startsWith('image/')) return file;
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') return file;

  // If already under 350 KB, no need to touch
  if (file.size <= 350 * 1024) return file;

  const maxWidth = options.maxWidth || 1920;
  const maxHeight = options.maxHeight || 1920;
  const quality = options.quality !== undefined ? options.quality : 0.82;
  const outputType = options.outputType || 'image/jpeg';

  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Downscale while preserving aspect ratio
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file); // fallback
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob || blob.size >= file.size) {
              resolve(file); // Keep original if compression didn't shrink it
              return;
            }

            const cleanExt = outputType === 'image/webp' ? '.webp' : '.jpeg';
            const baseName = file.name.replace(/\.[^/.]+$/, "");
            const optimizedFile = new File([blob], `${baseName}${cleanExt}`, {
              type: outputType,
              lastModified: Date.now()
            });

            console.log(
              `[ImageOptimizer] Compressed ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB -> ${(optimizedFile.size / 1024).toFixed(1)} KB)`
            );

            resolve(optimizedFile);
          },
          outputType,
          quality
        );
      };

      img.onerror = () => resolve(file);
      img.src = event.target?.result as string;
    };

    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

/**
 * Optimizes an existing remote image URL via browser canvas,
 * returning a compressed Blob ready to be uploaded back to storage.
 */
export async function optimizeRemoteImage(
  url: string,
  options: OptimizationOptions = {}
): Promise<{ blob: Blob; originalSize: number; newSize: number } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const originalSize = blob.size;

    // If already under 400KB, skip
    if (originalSize <= 400 * 1024) return null;

    const file = new File([blob], 'image.jpeg', { type: blob.type });
    const optimizedFile = await optimizeImageForUpload(file, options);

    return {
      blob: optimizedFile,
      originalSize,
      newSize: optimizedFile.size
    };
  } catch (err) {
    console.warn("Could not optimize remote image:", err);
    return null;
  }
}
