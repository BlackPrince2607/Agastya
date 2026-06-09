/** Browser file picker → base64 JPEG/PNG (web palm-scan demo flow). */
export function pickPalmImageWeb(): Promise<string | null> {
  if (typeof document === 'undefined') return Promise.resolve(null);

  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        if (typeof dataUrl !== 'string') {
          resolve(null);
          return;
        }
        const comma = dataUrl.indexOf(',');
        resolve(comma >= 0 ? dataUrl.slice(comma + 1) : null);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    };
    input.click();
  });
}
