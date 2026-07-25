import {
  AssetStudioPackageSchema,
  type AssetStudioPackage,
} from '../../schemas/studioPackageSchema';

const DATABASE_NAME = 'skyforge-studio-assets';
const STORE_NAME = 'packages';
const ACTIVE_KEY = 'active';

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME))
        request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error('could not open asset database'));
  });
}

export async function saveAssetPackageToIndexedDb(
  pkg: AssetStudioPackage,
): Promise<void> {
  const database = await openDatabase();
  if (!database) return;
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(pkg, ACTIVE_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('asset save failed'));
  });
  database.close();
}

export async function loadAssetPackageFromIndexedDb(): Promise<AssetStudioPackage | null> {
  const database = await openDatabase();
  if (!database) return null;
  const value = await new Promise<unknown>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(ACTIVE_KEY);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('asset load failed'));
  });
  database.close();
  const parsed = AssetStudioPackageSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
