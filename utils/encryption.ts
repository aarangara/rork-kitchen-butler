import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const ENCRYPTION_KEY_STORAGE = 'helpmecook_enc_key';
const IV_LENGTH = 16;
const KEY_LENGTH = 32;

function generateRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

function stringToBytes(str: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(str);
}

function bytesToString(bytes: Uint8Array): string {
  const decoder = new TextDecoder();
  return decoder.decode(bytes);
}

async function deriveKey(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const passwordBytes = stringToBytes(password);
  const combined = new Uint8Array(passwordBytes.length + salt.length);
  combined.set(passwordBytes);
  combined.set(salt, passwordBytes.length);
  
  let hash = combined;
  for (let i = 0; i < 10000; i++) {
    const newHash = new Uint8Array(hash.length);
    for (let j = 0; j < hash.length; j++) {
      newHash[j] = (hash[j] ^ (hash[(j + 1) % hash.length] + i)) & 0xFF;
    }
    hash = newHash;
  }
  
  const key = new Uint8Array(KEY_LENGTH);
  for (let i = 0; i < KEY_LENGTH; i++) {
    key[i] = hash[i % hash.length];
  }
  return key;
}

function xorEncrypt(data: Uint8Array, key: Uint8Array, iv: Uint8Array): Uint8Array {
  const encrypted = new Uint8Array(data.length);
  const expandedKey = new Uint8Array(data.length);
  
  for (let i = 0; i < data.length; i++) {
    expandedKey[i] = key[i % key.length] ^ iv[i % iv.length] ^ ((i * 17) & 0xFF);
  }
  
  for (let i = 0; i < data.length; i++) {
    const prevByte = i > 0 ? encrypted[i - 1] : iv[i % iv.length];
    encrypted[i] = data[i] ^ expandedKey[i] ^ prevByte;
  }
  
  return encrypted;
}

function xorDecrypt(encrypted: Uint8Array, key: Uint8Array, iv: Uint8Array): Uint8Array {
  const decrypted = new Uint8Array(encrypted.length);
  const expandedKey = new Uint8Array(encrypted.length);
  
  for (let i = 0; i < encrypted.length; i++) {
    expandedKey[i] = key[i % key.length] ^ iv[i % iv.length] ^ ((i * 17) & 0xFF);
  }
  
  for (let i = 0; i < encrypted.length; i++) {
    const prevByte = i > 0 ? encrypted[i - 1] : iv[i % iv.length];
    decrypted[i] = encrypted[i] ^ expandedKey[i] ^ prevByte;
  }
  
  return decrypted;
}

let cachedKey: Uint8Array | null = null;

async function getOrCreateEncryptionKey(): Promise<Uint8Array> {
  if (cachedKey) return cachedKey;
  
  try {
    const stored = await AsyncStorage.getItem(ENCRYPTION_KEY_STORAGE);
    if (stored) {
      cachedKey = hexToBytes(stored);
      return cachedKey;
    }
  } catch (error) {
    console.error('Failed to load encryption key:', error);
  }
  
  const newKey = generateRandomBytes(KEY_LENGTH);
  try {
    await AsyncStorage.setItem(ENCRYPTION_KEY_STORAGE, bytesToHex(newKey));
  } catch (error) {
    console.error('Failed to save encryption key:', error);
  }
  
  cachedKey = newKey;
  return newKey;
}

export async function encryptData(data: string): Promise<string> {
  try {
    const key = await getOrCreateEncryptionKey();
    const iv = generateRandomBytes(IV_LENGTH);
    const dataBytes = stringToBytes(data);
    const encrypted = xorEncrypt(dataBytes, key, iv);
    
    const result = bytesToHex(iv) + ':' + bytesToHex(encrypted);
    return result;
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Failed to encrypt data');
  }
}

export async function decryptData(encryptedData: string): Promise<string> {
  try {
    const [ivHex, dataHex] = encryptedData.split(':');
    if (!ivHex || !dataHex) {
      throw new Error('Invalid encrypted data format');
    }
    
    const key = await getOrCreateEncryptionKey();
    const iv = hexToBytes(ivHex);
    const encrypted = hexToBytes(dataHex);
    const decrypted = xorDecrypt(encrypted, key, iv);
    
    return bytesToString(decrypted);
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt data');
  }
}

export function hashString(input: string): string {
  const bytes = stringToBytes(input);
  let hash = 0x811c9dc5;
  
  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i];
    hash = Math.imul(hash, 0x01000193);
  }
  
  const hash2 = bytes.reduce((acc, byte, i) => {
    return ((acc << 5) - acc + byte + (i * 31)) | 0;
  }, 5381);
  
  return Math.abs(hash).toString(16).padStart(8, '0') + 
         Math.abs(hash2).toString(16).padStart(8, '0');
}

export function generateRequestSignature(
  method: string,
  path: string,
  timestamp: number,
  body?: string
): string {
  const payload = `${method}:${path}:${timestamp}:${body || ''}`;
  return hashString(payload);
}

export function verifyRequestSignature(
  signature: string,
  method: string,
  path: string,
  timestamp: number,
  body?: string,
  maxAgeMs: number = 300000
): boolean {
  const now = Date.now();
  if (Math.abs(now - timestamp) > maxAgeMs) {
    console.warn('Request signature expired');
    return false;
  }
  
  const expectedSignature = generateRequestSignature(method, path, timestamp, body);
  return signature === expectedSignature;
}

export function generateFingerprint(): string {
  const components = [
    Platform.OS,
    Platform.Version,
    new Date().getTimezoneOffset(),
    typeof navigator !== 'undefined' ? navigator.language : 'unknown',
    typeof screen !== 'undefined' ? `${screen.width}x${screen.height}` : 'unknown',
  ];
  
  return hashString(components.join('|'));
}

export interface SecurePayload<T> {
  data: T;
  timestamp: number;
  fingerprint: string;
  signature: string;
}

export async function createSecurePayload<T>(data: T): Promise<SecurePayload<T>> {
  const timestamp = Date.now();
  const fingerprint = generateFingerprint();
  const dataString = JSON.stringify(data);
  const signature = generateRequestSignature('PAYLOAD', fingerprint, timestamp, dataString);
  
  return {
    data,
    timestamp,
    fingerprint,
    signature,
  };
}

export function validateSecurePayload<T>(
  payload: SecurePayload<T>,
  maxAgeMs: number = 300000
): { valid: boolean; reason?: string } {
  const now = Date.now();
  
  if (Math.abs(now - payload.timestamp) > maxAgeMs) {
    return { valid: false, reason: 'Payload expired' };
  }
  
  const dataString = JSON.stringify(payload.data);
  const expectedSignature = generateRequestSignature(
    'PAYLOAD',
    payload.fingerprint,
    payload.timestamp,
    dataString
  );
  
  if (payload.signature !== expectedSignature) {
    return { valid: false, reason: 'Invalid signature' };
  }
  
  return { valid: true };
}

export async function secureStore(key: string, data: unknown): Promise<void> {
  const jsonData = JSON.stringify(data);
  const encrypted = await encryptData(jsonData);
  await AsyncStorage.setItem(`secure_${key}`, encrypted);
  console.log(`SecureStore: Stored encrypted data for key: ${key}`);
}

export async function secureRetrieve<T>(key: string): Promise<T | null> {
  try {
    const encrypted = await AsyncStorage.getItem(`secure_${key}`);
    if (!encrypted) return null;
    
    const decrypted = await decryptData(encrypted);
    return JSON.parse(decrypted) as T;
  } catch (error) {
    console.error(`SecureStore: Failed to retrieve key: ${key}`, error);
    return null;
  }
}

export async function secureRemove(key: string): Promise<void> {
  await AsyncStorage.removeItem(`secure_${key}`);
  console.log(`SecureStore: Removed key: ${key}`);
}
