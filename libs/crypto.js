// crypto.js - AES-GCM encryption wrapper using Web Crypto API
export async function getKeyMaterial(password) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );
}

export async function deriveKey(keyMaterial) {
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode("hiddenqr"),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptData(data, password) {
  const keyMaterial = await getKeyMaterial(password);
  const key = await deriveKey(keyMaterial);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);
  return combined;
}

export async function decryptData(data, password) {
  const keyMaterial = await getKeyMaterial(password);
  const key = await deriveKey(keyMaterial);
  const iv = data.slice(0, 12);
  const encrypted = data.slice(12);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encrypted);
  return new Uint8Array(decrypted);
}
