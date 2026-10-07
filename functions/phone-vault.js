import { customerPhoneRetained } from "./quote-retention.js";
export { customerPhoneWithinSevenDays, customerPhoneRetained, customerPhoneAccessExpiresAt, customerPersonalExpiresAt } from "./quote-retention.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64ToBytes(value) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

function bytesToBase64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function encryptionKey(env) {
  const encoded = String(env.CUSTOMER_PHONE_KEY || "").trim();
  if (!encoded) throw new Error("CUSTOMER_PHONE_KEY secret is required");
  const source = base64ToBytes(encoded);
  if (source.length !== 32) throw new Error("CUSTOMER_PHONE_KEY must be 32 bytes in base64");
  const hkdf = await crypto.subtle.importKey("raw", source, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: encoder.encode("ga-pick-customer-phone-v1"), info: encoder.encode("encryption") },
    hkdf,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function protectCustomerPhone(env, phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) throw new Error("Customer phone is required");
  const source = base64ToBytes(String(env.CUSTOMER_PHONE_KEY || "").trim());
  if (source.length !== 32) throw new Error("CUSTOMER_PHONE_KEY must be 32 bytes in base64");
  const hkdf = await crypto.subtle.importKey("raw", source, "HKDF", false, ["deriveKey"]);
  const lookup = await crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: encoder.encode("ga-pick-customer-phone-v1"), info: encoder.encode("lookup") },
    hkdf, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(env), encoder.encode(digits));
  const signature = await crypto.subtle.sign("HMAC", lookup, encoder.encode(digits));
  return {
    hash: Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join(""),
    ciphertext: `v1:${bytesToBase64(iv)}:${bytesToBase64(new Uint8Array(encrypted))}`,
  };
}

export function fullyMaskCustomerPhone(value) {
  return value ? "***-****-****" : "";
}

export function maskPhoneInMessage(value) {
  if (typeof value === "string") return value.replace(/01[016789][-\s]?\d{3,4}[-\s]?\d{4}/g, "***-****-****");
  if (Array.isArray(value)) return value.map(maskPhoneInMessage);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, maskPhoneInMessage(item)]));
  return value;
}

export async function readCustomerPhone(env, row) {
  if (!row || !customerPhoneRetained(row)) return "";
  if (!row.phone_ciphertext) return String(row.phone || "").replace(/\D/g, "");
  const [version, encodedIv, encodedCiphertext] = String(row.phone_ciphertext).split(":");
  if (version !== "v1" || !encodedIv || !encodedCiphertext) throw new Error("Invalid customer phone ciphertext");
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(encodedIv) },
    await encryptionKey(env),
    base64ToBytes(encodedCiphertext)
  );
  return decoder.decode(plaintext);
}
