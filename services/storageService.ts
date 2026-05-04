export const DB_NAME = "DawroProjectDB";
export const STORE_NAME = "projectData";

function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function promiseReq<T>(req: IDBRequest): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function setItem(key: string, value: any): Promise<void> {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  store.put(value, key);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getItem<T>(key: string): Promise<T | null> {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  const result = await promiseReq<T>(store.get(key));
  return result !== undefined ? result : null;
}

export function audioBufferToSerializable(buffer: AudioBuffer) {
  const channels = [];
  for (let i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }
  return {
    sampleRate: buffer.sampleRate,
    length: buffer.length,
    numberOfChannels: buffer.numberOfChannels,
    channels,
  };
}

export function serializableToAudioBuffer(
  audioCtx: AudioContext,
  data: {
    sampleRate: number;
    length: number;
    numberOfChannels: number;
    channels: Float32Array[];
  },
): AudioBuffer {
  const buffer = audioCtx.createBuffer(
    data.numberOfChannels,
    data.length,
    data.sampleRate,
  );
  for (let i = 0; i < data.numberOfChannels; i++) {
    buffer.copyToChannel(data.channels[i], i);
  }
  return buffer;
}
