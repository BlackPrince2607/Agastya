/** Browser file picker → base64 JPEG/PNG (web palm-scan flow). */
export function pickPalmImageWeb(): Promise<string | null> {
  if (typeof document === 'undefined') return Promise.resolve(null);

  return new Promise((resolve) => {
    let settled = false;
    let changed = false;

    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('focus', onWindowFocus);
      clearTimeout(cancelTimer);
      input.remove();
      resolve(value);
    };

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp,image/*';
    input.style.display = 'none';

    const onWindowFocus = () => {
      // Wait longer so slow file picks don't false-cancel.
      window.setTimeout(() => {
        if (!changed && !input.files?.length) finish(null);
      }, 900);
    };

    const cancelTimer = window.setTimeout(() => finish(null), 120_000);

    input.onchange = () => {
      changed = true;
      const file = input.files?.[0];
      if (!file) {
        finish(null);
        return;
      }
      if (!file.type.startsWith('image/')) {
        finish(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        if (typeof dataUrl !== 'string') {
          finish(null);
          return;
        }
        const comma = dataUrl.indexOf(',');
        finish(comma >= 0 ? dataUrl.slice(comma + 1) : null);
      };
      reader.onerror = () => finish(null);
      reader.readAsDataURL(file);
    };

    // Supported in modern Chromium / Safari.
    input.addEventListener('cancel', () => finish(null));

    document.body.appendChild(input);
    window.addEventListener('focus', onWindowFocus);
    input.click();
  });
}
