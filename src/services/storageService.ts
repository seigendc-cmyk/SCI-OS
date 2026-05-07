import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';
import { processImage } from '../lib/imageProcessor';

interface UploadOptions {
  vendorId: string;
  file: File;
  path: string;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  onProgress?: (progress: number) => void;
}

/**
 * Standard Vendor Image Upload Protocol
 * 1. Validates image type
 * 2. Converts to WebP in-browser
 * 3. Uploads to vendor-scoped storage path
 * 4. Returns permanent URL
 */
export async function uploadVendorImage({
  vendorId,
  file,
  path,
  maxWidth = 1600,
  maxHeight = 1600,
  quality = 0.82,
  onProgress,
}: UploadOptions): Promise<string> {
  if (!vendorId) throw new Error('AUTH_ERROR: Vendor identity required for storage operations.');

  try {
    // Step 1: WebP Conversion
    const webpBlob = await processImage(file, maxWidth, maxHeight, quality);

    // Step 2: Prepare Path (ensure vendor-assets prefix for security rules)
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    const storagePath = `vendor-assets/${vendorId}/${cleanPath}`;
    const storageRef = ref(storage, storagePath);

    // Step 3: Resumable Upload
    console.log('[STORAGE_ENGINE] Initiating upload task', {
      vendorId,
      storagePath,
      contentType: 'image/webp',
      convertedSize: (webpBlob.size / 1024).toFixed(2) + ' KB',
    });

    const uploadTask = uploadBytesResumable(storageRef, webpBlob, {
      contentType: 'image/webp',
      customMetadata: {
        vendorId: vendorId,
        originalName: file.name,
      },
    });

    return new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          if (onProgress) onProgress(progress);
        },
        (error: any) => {
          console.error('[STORAGE_ENGINE] Upload task failure:', {
            code: error.code,
            message: error.message,
            vendorId,
            path: storagePath,
          });

          // Attach extra info to error for UI
          error.diagnosticInfo = {
            vendorId,
            path: storagePath,
            convertedSize: webpBlob.size,
          };

          reject(error);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(downloadURL);
        },
      );
    });
  } catch (error: any) {
    console.error('[STORAGE_ENGINE] Processing failure:', error);
    throw error;
  }
}

/**
 * Legacy compatibility helper
 */
export async function uploadImage(file: Blob, path: string): Promise<string> {
  const storageRef = ref(storage, path);
  const snapshot = await uploadBytesResumable(storageRef, file);
  return getDownloadURL(snapshot.ref);
}
