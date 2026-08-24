import { supabase } from './supabase';

export async function uploadFile(
  bucket: string,
  path: string,
  file: File
): Promise<{ path: string; url: string } | null> {
  if (!supabase) throw new Error("Supabase não configurado");

  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
  const filePath = `${path}/${fileName}`;

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, {
      cacheControl: '3600',
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
