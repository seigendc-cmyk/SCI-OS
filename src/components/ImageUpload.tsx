import React, { useState, useRef } from 'react';
import { Camera, Loader2, X, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { uploadVendorImage } from '../services/storageService';

interface ImageUploadProps {
  path: string; // Relative to vendor-assets/{vendorId}/
  value?: string;
  onUpload: (url: string) => void;
  label: string;
  aspectRatio?: 'square' | 'banner' | 'any';
}

export const ImageUpload: React.FC<ImageUploadProps> = ({
  path,
  value,
  onUpload,
  label,
  aspectRatio = 'any',
}) => {
  const { vendorId, user, appUser } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState<string | null>(value || null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !vendorId) return;

    setUploading(true);
    setProgress(0);
    setError(null);

    let downloadURL = '';
    try {
      // DIAGNOSTICS: BEFORE PROCESSING
      console.log('[IMAGE_UPLOAD_PROTOCOL] Protocol initiated', {
        vendorId: vendorId,
        authUid: user?.uid,
        appUserVendorId: appUser?.vendorId,
        appUserRole: appUser?.role,
        targetPath: path,
        fileType: file.type,
        fileSize: (file.size / 1024).toFixed(2) + ' KB',
      });

      // Local Preview immediately
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target?.result as string);
      reader.readAsDataURL(file);

      // Upload Protocol
      downloadURL = await uploadVendorImage({
        vendorId,
        file,
        path,
        maxWidth: aspectRatio === 'banner' ? 1600 : 1200,
        maxHeight: aspectRatio === 'banner' ? 600 : 1200,
        onProgress: (p) => setProgress(p),
      });

      onUpload(downloadURL);
      setPreview(downloadURL);
    } catch (err: any) {
      // DIAGNOSTICS LOGGING
      console.error('[IMAGE_UPLOAD_DIAGNOSTICS]', {
        vendorId: vendorId,
        uploadPath: path,
        fileType: file.type,
        convertedSize: err.diagnosticInfo?.convertedSize,
        authUid: user?.uid,
        appUserVendorId: appUser?.vendorId,
        appUserRole: appUser?.role,
        storageErrorCode: err.code,
        storageErrorMessage: err.message,
      });

      // USER-FRIENDLY ERROR MAPPING
      let displayError = 'Upload failed. Please check connection.';

      if (err.message?.includes('NOT_IMAGE')) {
        displayError = 'Invalid file type. Please use JPG/PNG/WebP.';
      } else if (err.code === 'storage/unauthorized') {
        displayError = 'Upload blocked by Firebase Storage rules.';
      } else if (err.code === 'storage/retry-limit-exceeded') {
        displayError = 'Upload could not complete because the network request timed out.';
      } else if (err.code) {
        displayError = `Upload Error (${err.code}): ${err.message}`;
      } else if (err.message) {
        displayError = err.message;
      }

      setError(displayError);
      setPreview(value || null); // Revert to old value
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const clearImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPreview(null);
    onUpload('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-end">
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
          {label}
        </label>
        {uploading && (
          <span className="text-[9px] font-mono font-bold text-orange-itred animate-pulse">
            UPLOADING_{Math.round(progress)}%
          </span>
        )}
      </div>

      <div
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={`group relative industrial-border rounded-lg overflow-hidden bg-slate-50 flex items-center justify-center border-dashed border-2 transition-all cursor-pointer ${
          uploading ? 'border-orange-200' : 'border-slate-200 hover:border-orange-itred'
        } ${aspectRatio === 'banner' ? 'aspect-[21/9]' : 'aspect-square'}`}
      >
        {preview ? (
          <>
            <img
              src={preview}
              alt="Upload preview"
              className={`w-full h-full object-cover transition-opacity duration-300 ${uploading ? 'opacity-30' : 'opacity-100'}`}
            />
            {!uploading && (
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                <button
                  type="button"
                  onClick={clearImage}
                  className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-full hover:bg-black/90 transition-all transform hover:scale-110 shadow-lg"
                >
                  <X size={14} />
                </button>
                <Camera
                  className="text-white opacity-0 group-hover:opacity-100 drop-shadow-md"
                  size={24}
                />
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 text-slate-400 group-hover:text-orange-itred transition-colors">
            <Camera size={24} className={uploading ? 'animate-bounce' : ''} />
            <span className="text-[9px] font-black uppercase tracking-[0.2em]">Select Asset</span>
          </div>
        )}

        {uploading && (
          <div className="absolute inset-x-0 bottom-0 top-0 bg-white/40 backdrop-blur-[1px] flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 border-4 border-orange-itred/20 border-t-orange-itred rounded-full animate-spin" />
            <div className="bg-white/90 px-3 py-1 rounded-full shadow-sm">
              <span className="text-[10px] font-bold text-orange-itred font-mono">
                CONVERTING_TO_WEBP
              </span>
            </div>
          </div>
        )}

        {/* Progress Bar overlay */}
        {uploading && progress > 0 && (
          <div
            className="absolute bottom-0 left-0 h-1 bg-orange-itred transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        )}
      </div>

      {error && (
        <div className="flex items-center gap-1.5 p-2 bg-red-50 rounded border border-red-100">
          <AlertCircle size={12} className="text-red-500" />
          <p className="text-[8px] text-red-600 font-black uppercase tracking-widest">{error}</p>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/*.jpg,image/*.jpeg,image/*.png,image/*.webp,image/*.gif"
        onChange={handleFileChange}
      />

      <div className="text-[7px] text-slate-300 font-bold uppercase tracking-[0.3em] flex items-center gap-1">
        <span className="w-1 h-1 bg-emerald-400 rounded-full animate-pulse inline-block" /> iTred
        WebX Optical Engine
      </div>
    </div>
  );
};
