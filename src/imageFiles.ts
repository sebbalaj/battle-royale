const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

export const readImageFile = (file: File): Promise<string> => {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return Promise.reject(new Error("Choose a PNG, JPEG, or WebP image."));
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return Promise.reject(new Error("Choose an image smaller than 15 MB."));
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("The image could not be read."));
    reader.readAsDataURL(file);
  });
};
