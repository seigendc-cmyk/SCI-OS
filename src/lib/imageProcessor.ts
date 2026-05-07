/**
 * Processes an image file: resizes it and converts it to WebP format.
 * Requirements:
 * - max width: 1600
 * - quality: 0.82
 */
export async function processImage(
  file: File,
  maxWidth = 1600,
  maxHeight = 1600,
  quality = 0.82,
): Promise<Blob> {
  if (!file.type.startsWith('image/')) {
    throw new Error('FILE_NOT_IMAGE: The selected file is not a supported image format.');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions maintain aspect ratio
        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(
            new Error(
              'CANVAS_CONTEXT_ERROR: Could not initialize graphics context for conversion.',
            ),
          );
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('CONVERSION_FAILURE: Failed to translate image to WebP format.'));
            }
          },
          'image/webp',
          quality,
        );
      };
      img.onerror = () =>
        reject(
          new Error('IMAGE_LOAD_ERROR: Could not render source image. File may be corrupted.'),
        );
    };
    reader.onerror = () =>
      reject(new Error('FILE_READ_ERROR: Could not read local file from device.'));
  });
}
