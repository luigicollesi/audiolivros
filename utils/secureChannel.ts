import CryptoJS from 'crypto-js';

const VERSION = 1;

type ChannelKeys = {
  outboundKey: string;
  inboundKey: string;
};

const UTF8 = CryptoJS.enc.Utf8;
const BASE64 = CryptoJS.enc.Base64;

function parseBase64Key(raw: string, label: string) {
  const trimmed = (raw || '').trim();
  const key = BASE64.parse(trimmed);
  if (key.sigBytes !== 32) {
    throw new Error(`${label} deve ser uma chave base64 de 32 bytes (256 bits).`);
  }
  return key;
}

function deriveKey(baseKey: CryptoJS.lib.WordArray, purpose: string) {
  const suffix = UTF8.parse(purpose);
  return CryptoJS.SHA256(baseKey.clone().concat(suffix));
}

function computeMac(payload: string, authKey: CryptoJS.lib.WordArray) {
  return CryptoJS.HmacSHA256(payload, authKey).toString(CryptoJS.enc.Hex);
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function encryptFrontToBack(plaintext: string, base64Key: string) {
  const baseKey = parseBase64Key(base64Key, 'Chave front->back');
  const encKey = deriveKey(baseKey, 'enc');
  const authKey = deriveKey(baseKey, 'auth');

  const iv = CryptoJS.lib.WordArray.random(16);
  const encrypted = CryptoJS.AES.encrypt(plaintext, encKey, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  const ivB64 = BASE64.stringify(iv);
  const ctB64 = BASE64.stringify(encrypted.ciphertext);
  const payload = `${VERSION}.${ivB64}.${ctB64}`;
  const mac = computeMac(payload, authKey);

  return `${payload}.${mac}`;
}

export function decryptBackToFront(payload: string, base64Key: string) {
  const [versionStr, ivB64, ctB64, mac] = payload.split('.');
  if (!versionStr || !ivB64 || !ctB64 || !mac) {
    throw new Error('Formato de payload inválido.');
  }
  if (Number(versionStr) !== VERSION) {
    throw new Error(`Versão de payload não suportada: ${versionStr}`);
  }

  const baseKey = parseBase64Key(base64Key, 'Chave back->front');
  const encKey = deriveKey(baseKey, 'enc');
  const authKey = deriveKey(baseKey, 'auth');

  const unsigned = `${versionStr}.${ivB64}.${ctB64}`;
  const expectedMac = computeMac(unsigned, authKey);
  if (!timingSafeEqual(mac, expectedMac)) {
    throw new Error('MAC inválido ou mensagem adulterada.');
  }

  const iv = BASE64.parse(ivB64);
  const ciphertext = BASE64.parse(ctB64);
  const decrypted = CryptoJS.AES.decrypt({ ciphertext }, encKey, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  const plaintext = decrypted.toString(UTF8);
  if (!plaintext) {
    throw new Error('Falha ao decifrar mensagem.');
  }
  return plaintext;
}

export function getSecureChannelKeys(): ChannelKeys {
  return {
    outboundKey: process.env.EXPO_PUBLIC_FRONT_TO_BACK_KEY ?? '',
    inboundKey: process.env.EXPO_PUBLIC_BACK_TO_FRONT_KEY ?? '',
  };
}

export function ensureChannelKeys(keys: ChannelKeys): ChannelKeys {
  parseBase64Key(keys.outboundKey, 'Chave front->back');
  parseBase64Key(keys.inboundKey, 'Chave back->front');
  return keys;
}
