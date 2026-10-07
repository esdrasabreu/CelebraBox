import React, { useState, useRef } from 'react';
import { UploadCloud, X, Loader2, Image as ImageIcon, Video as VideoIcon } from 'lucide-react';
import { uploadFile } from '../lib/storage';
import { useAppContext } from '../lib/AppContext';

type FileUploadProps = {
  bucket: string;
  pathPrefix: string;
  onUploadSuccess: (url: string, path: string) => void;
  accept?: string;
  label?: string;
  currentUrl?: string;
  onClear?: () => void;
};

export default function FileUpload({ bucket, pathPrefix, onUploadSuccess, accept = "image/*,video/*", label, currentUrl, onClear }: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    setUploading(true);
    try {
      const result = await uploadFile(bucket, pathPrefix, file);
      if (result) {
        onUploadSuccess(result.url, result.path);
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao fazer upload');
      setPreview(currentUrl || null);
    } finally {
      setUploading(false);
    }
  };

  const handleClear = () => {
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (onClear) onClear();
  };

  return (
    <div className="w-full">
      {label && <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>}
      <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 text-center hover:bg-slate-50 transition-colors relative overflow-hidden group">
        {preview ? (
          <div className="relative w-full h-40">
            {accept.includes('video') && preview.match(/\.(mp4|webm)$/i) ? (
              <video src={preview} className="w-full h-full object-cover rounded-lg" controls />
            ) : (
              <img src={preview} alt="Preview" className="w-full h-full object-cover rounded-lg" />
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 rounded-lg">
              <button type="button" onClick={() => fileInputRef.current?.click()} className="px-3 py-1.5 bg-white text-slate-800 text-xs font-medium rounded-md hover:bg-pink-50 hover:text-[#ef007e]">
                Trocar
              </button>
              <button type="button" onClick={handleClear} className="px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-md hover:bg-red-600">
                Remover
              </button>
            </div>
            {uploading && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
              </div>
            )}
          </div>
        ) : (
          <div className="py-6 flex flex-col items-center justify-center cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <UploadCloud className="w-10 h-10 text-slate-400 mb-2" />
            <p className="text-sm font-medium text-slate-600">Clique para selecionar</p>
            <p className="text-xs text-slate-400 mt-1">Imagens ou vídeos suportados</p>
          </div>
        )}
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          accept={accept}
          className="hidden" 
        />
      </div>
    </div>
  );
}
