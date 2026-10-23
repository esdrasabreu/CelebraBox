import { supabase } from './supabase';
import { optimizeImageForUpload } from './imageOptimizer';

export async function uploadFile(
  bucket: string,
  path: string,
  file: File,
  options?: { skipOptimization?: boolean }
): Promise<{ path: string; url: string } | null> {
  if (!supabase) throw new Error("Supabase não configurado");

  // Automatically compress raw camera photos (e.g. 15MB down to ~250KB) to protect egress limits
  const fileToUpload = options?.skipOptimization ? file : await optimizeImageForUpload(file);

  const fileExt = fileToUpload.name.split('.').pop();
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
  const filePath = `${path}/${fileName}`;

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filePath, fileToUpload, {
      cacheControl: '31536000', // 1 year CDN and browser cache
      upsert: false
    });

  if (error) {
    console.error("Erro no upload:", error);
    throw error;
  }

  const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(filePath);

  return {
    path: filePath,
    url: publicUrlData.publicUrl
  };
}

export async function deleteFile(bucket: string, path: string) {
  if (!supabase) return;
  await supabase.storage.from(bucket).remove([path]);
}
