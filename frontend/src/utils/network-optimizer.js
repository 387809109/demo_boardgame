/**
 * Network optimizer helpers for batching and optional compression.
 */

/** @type {number} */
const NETWORK_BATCH_INTERVAL_MS = 40;

/** @type {number} */
const NETWORK_BATCH_MAX_MESSAGES = 12;

/** @type {number} */
const NETWORK_COMPRESS_THRESHOLD = 2048;

/** @type {Set<string>} */
const DEFAULT_BATCH_TYPES = new Set([
  'GAME_ACTION',
  'CHAT_MESSAGE'
]);

/** @type {string} */
const NETWORK_BATCH_MESSAGE_TYPE = 'NETWORK_BATCH';

/** @type {number} */
const DEFAULT_NETWORK_COMPRESS_RATIO = 0.95;

/** @type {Set<string>} */
const COMPRESSION_ENCODINGS = new Set(['gzip', 'deflate']);

/**
 * Convert a byte array to base64 string using browser-safe and Node-compatible APIs.
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function toBase64(bytes) {
  if (typeof btoa === 'function') {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }

  throw new Error('Base64 encoding not supported in this environment');
}

/**
 * Convert base64 string to byte array using browser-safe and Node-compatible APIs.
 * @param {string} base64
 * @returns {Uint8Array}
 */
function fromBase64(base64) {
  if (typeof atob === 'function') {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }

  throw new Error('Base64 decoding not supported in this environment');
}

/**
 * Check if the browser supports native compression APIs.
 * @returns {boolean}
 */
export function supportsNativeCompression() {
  return typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';
}

/**
 * Convert a byte array to base64 string.
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function bytesToBase64(bytes) {
  return toBase64(bytes);
}

/**
 * Convert a base64 string to byte array.
 * @param {string} base64
 * @returns {Uint8Array}
 */
export function base64ToBytes(base64) {
  return fromBase64(base64);
}

/**
 * Try compressing a payload string.
 * @param {string} text
 * @param {number} threshold
 * @param {'gzip' | 'deflate'} algorithm
 * @returns {Promise<{ encoding: string, payload: string, originalLength: number } | null>}
 */
export async function compressText(
  text,
  threshold = NETWORK_COMPRESS_THRESHOLD,
  algorithm = 'gzip'
) {
  if (!supportsNativeCompression()) {
    return null;
  }
  if (typeof text !== 'string' || text.length < threshold) {
    return null;
  }

  if (!COMPRESSION_ENCODINGS.has(algorithm)) {
    return null;
  }

  const stream = new CompressionStream(algorithm);
  const encoder = new TextEncoder();
  const input = encoder.encode(text);
  const writer = stream.writable.getWriter();
  await writer.write(input);
  await writer.close();
  const compressedBuffer = await new Response(stream.readable).arrayBuffer();
  const payload = toBase64(new Uint8Array(compressedBuffer));

  if (payload.length >= text.length * DEFAULT_NETWORK_COMPRESS_RATIO) {
    return null;
  }

  return {
    encoding: algorithm,
    payload,
    originalLength: text.length
  };
}

/**
 * Try decompressing a payload produced by compressText.
 * @param {string} payload
 * @param {'gzip' | 'deflate'} encoding
 * @returns {Promise<string | null>}
 */
export async function decompressText(payload, encoding = 'gzip') {
  if (!supportsNativeCompression() || typeof payload !== 'string') {
    return null;
  }
  if (!COMPRESSION_ENCODINGS.has(encoding)) {
    return null;
  }

  try {
    const bytes = fromBase64(payload);
    const stream = new DecompressionStream(encoding);
    const writer = stream.writable.getWriter();
    await writer.write(bytes);
    await writer.close();
    const decompressedBuffer = await new Response(stream.readable).arrayBuffer();
    return new TextDecoder().decode(decompressedBuffer);
  } catch (err) {
    return null;
  }
}

/**
 * Build a network batch envelope.
 * @param {Array<Object>} messages
 * @returns {Object}
 */
export function createBatchEnvelope(messages = []) {
  return {
    type: NETWORK_BATCH_MESSAGE_TYPE,
    timestamp: Date.now(),
    playerId: messages[0]?.playerId || '',
    data: {
      messageCount: messages.length,
      messages
    }
  };
}

/**
 * Unwrap and normalize a network batch.
 * Supports both direct messages and compressed payloads.
 * @param {Object} payload
 * @returns {Promise<Array<Object> | null>}
 */
export async function resolveBatchPayload(payload) {
  if (!payload) {
    return null;
  }

  const dataSection = payload && typeof payload.data === 'object' ? payload.data : null;
  const source = dataSection || payload;

  const hasCompressedFormat = source && (typeof source.compressed === 'boolean' || source.payload);
  if (hasCompressedFormat && source.compressed !== false) {
    const decompressed = await decompressText(source.payload, source.encoding || 'gzip');
    if (!decompressed) {
      return null;
    }
    try {
      const parsed = JSON.parse(decompressed);
      if (Array.isArray(parsed?.data?.messages)) {
        return parsed.data.messages;
      }
      return Array.isArray(parsed?.messages) ? parsed.messages : null;
    } catch (err) {
      return null;
    }
  }

  if (Array.isArray(source.messages)) {
    return source.messages;
  }

  if (Array.isArray(dataSection?.messages)) {
    return dataSection.messages;
  }

  return null;
}

export {
  NETWORK_BATCH_INTERVAL_MS,
  NETWORK_BATCH_MAX_MESSAGES,
  NETWORK_COMPRESS_THRESHOLD,
  DEFAULT_BATCH_TYPES,
  NETWORK_BATCH_MESSAGE_TYPE
};
