import {
  MusicStudioPackageSchema,
  type MusicStudioPackage,
} from '../../schemas/studioPackageSchema';

const DATABASE = 'skyforge-studio-music';
const STORE = 'packages';
const KEY = 'working-music-pack';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE))
        request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error('could not open music database'));
  });
}

export async function saveMusicPackageToIndexedDb(
  pkg: MusicStudioPackage,
): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).put(pkg, KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('could not save music package'));
  });
  database.close();
}

export async function loadMusicPackageFromIndexedDb(): Promise<MusicStudioPackage | null> {
  if (typeof indexedDB === 'undefined') return null;
  const database = await openDatabase();
  const value = await new Promise<unknown>((resolve, reject) => {
    const transaction = database.transaction(STORE, 'readonly');
    const request = transaction.objectStore(STORE).get(KEY);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error('could not load music package'));
  });
  database.close();
  const parsed = MusicStudioPackageSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
