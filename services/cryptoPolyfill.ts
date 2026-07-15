import * as ExpoCrypto from 'expo-crypto';

function bytesToBinaryString(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return binary;
}

/** PKCE + session IDs need Web Crypto APIs missing in some Expo Go / RN builds. */
export function ensureWebCrypto(): void {
  const existing = globalThis.crypto;
  const base = existing ?? ({} as Crypto);

  if (typeof base.randomUUID !== 'function') {
    Object.assign(base, {
      randomUUID: () => ExpoCrypto.randomUUID(),
    });
  }

  // Node SSR (Vercel static export) and modern browsers already ship Web Crypto.
  if (
    existing &&
    typeof existing.getRandomValues === 'function' &&
    typeof existing.subtle?.digest === 'function' &&
    typeof existing.randomUUID === 'function'
  ) {
    return;
  }

  if (typeof base.getRandomValues !== 'function') {
    Object.assign(base, {
      getRandomValues<T extends ArrayBufferView>(array: T): T {
        const bytes = ExpoCrypto.getRandomValues(array as unknown as Uint8Array);
        const view = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
        view.set(bytes.subarray(0, view.length));
        return array;
      },
    });
  }

  if (typeof base.subtle?.digest === 'function') {
    return;
  }

  const subtle = {
    async digest(algorithm: AlgorithmIdentifier, data: BufferSource): Promise<ArrayBuffer> {
      const name =
        typeof algorithm === 'string'
          ? algorithm
          : algorithm && typeof algorithm === 'object' && 'name' in algorithm
            ? String(algorithm.name)
            : 'SHA-256';

      if (!name.toUpperCase().includes('SHA-256')) {
        throw new Error(`Unsupported digest algorithm: ${name}`);
      }

      const bytes =
        data instanceof ArrayBuffer
          ? new Uint8Array(data)
          : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);

      const hashB64 = await ExpoCrypto.digestStringAsync(
        ExpoCrypto.CryptoDigestAlgorithm.SHA256,
        bytesToBinaryString(bytes),
        { encoding: ExpoCrypto.CryptoEncoding.BASE64 },
      );

      const raw = atob(hashB64);
      const out = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
      return out.buffer;
    },
  };

  if (existing) {
    try {
      Object.defineProperty(existing, 'subtle', { value: subtle, configurable: true });
    } catch {
      // Some runtimes expose read-only subtle; digest already handled above when present.
    }
  } else {
    globalThis.crypto = Object.assign(base, { subtle });
  }
}
