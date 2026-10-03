"use client";

import { generateThumbnail } from "./thumbnail-generator";

/**
 * Local media vault (IndexedDB) + session blob-URL cache.
 *
 * Problem: device uploads were stored as `blob:` URLs. Those die on reload,
 * leaving broken thumbnails, a black canvas and an empty timeline.
 *
 * Fix: persist the actual file bytes in IndexedDB keyed by asset id.
 * - `src` on records/clips stays a live URL for the current session.
 * - `localId` links a record/clip back to its bytes for the next session.
 * - On boot we mint fresh blob URLs from stored bytes and remap everything.
 */

const DB_NAME = "creatorai-ve-media";
const STORE_NAME = "files";
const DB_VERSION = 1;

export interface StoredMedia {
  id: string;
  blob: Blob;
  name: string;
  mime: string;
  size: number;
  createdAt: number;
}

function idbSupported(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!idbSupported()) {
      reject(new Error("IndexedDB not available"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("Failed to open media vault"));
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        let done = false;
        const finish = (fn: () => void) => {
          if (!done) {
            done = true;
            try {
              db.close();
            } catch {
              /* noop */
            }
            fn();
          }
        };
        try {
          const transaction = db.transaction(STORE_NAME, mode);
          transaction.oncomplete = () => finish(() => undefined as unknown as void);
          transaction.onerror = () =>
            finish(() => reject(transaction.error || new Error("Media vault transaction failed")));
          const store = transaction.objectStore(STORE_NAME);
          const req = run(store);
          req.onsuccess = () => finish(() => resolve(req.result));
          req.onerror = () => finish(() => reject(req.error || new Error("Media vault request failed")));
        } catch (error) {
          finish(() => reject(error));
        }
      }),
  );
}

/** Persist file bytes. Quota failures resolve silently (upload stays session-only). */
export async function saveLocalMedia(record: StoredMedia): Promise<boolean> {
  try {
    await tx("readwrite", (store) => store.put(record));
    return true;
  } catch (error) {
    console.warn("[media-vault] persistence failed (session-only upload):", error);
    return false;
  }
}

export async function getLocalMedia(id: string): Promise<StoredMedia | null> {
  try {
    const record = await tx<StoredMedia | undefined>("readonly", (store) => store.get(id));
    return record ?? null;
  } catch {
    return null;
  }
}

export async function deleteLocalMedia(id: string): Promise<void> {
  try {
    await tx("readwrite", (store) => store.delete(id));
    revokeSessionUrl(id);
  } catch {
    /* noop */
  }
}

// ─── Session blob-URL cache (one live URL per id, revoked on replace) ───

const sessionUrls = new Map<string, string>();

export function sessionUrlFor(id: string, blob: Blob): string {
  const existing = sessionUrls.get(id);
  if (existing) return existing;
  const url = URL.createObjectURL(blob);
  sessionUrls.set(id, url);
  return url;
}

export function revokeSessionUrl(id: string): void {
  const url = sessionUrls.get(id);
  if (url) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* noop */
    }
    sessionUrls.delete(id);
  }
}

/** Mint a fresh playable URL for stored bytes (used during boot rehydrate). */
export async function playableUrlForLocalId(localId: string): Promise<string | null> {
  const record = await getLocalMedia(localId);
  if (!record?.blob) return null;
  const blob =
    record.blob instanceof Blob
      ? record.blob
      : new Blob([record.blob as unknown as BlobPart], { type: record.mime });
  return sessionUrlFor(localId, blob);
}

export interface RehydratableAsset {
  id: string;
  src: string;
  thumbnailSrc?: string | null;
  name: string;
  localId?: string | null;
}

/**
 * Rehydrate one persisted asset record after reload.
 * - Cloud (non-blob:) URLs survive → returned untouched.
 * - Local records mint fresh blob URLs from vault bytes (+ fresh thumbnail).
 * - Unrecoverable records (dead blob, no bytes) → null (caller prunes them
 *   instead of showing the broken-thumbnail ghost from the screenshot).
 */
export async function rehydrateAssetRecord<T extends RehydratableAsset>(
  asset: T,
): Promise<T | null> {
  const srcDead = !asset.src || asset.src.startsWith("blob:");
  const thumbDead = !!asset.thumbnailSrc?.startsWith("blob:");

  // Cloud URL with a dead session thumbnail: keep the asset, drop the thumb.
  if (!srcDead && !asset.localId) {
    return thumbDead ? { ...asset, thumbnailSrc: null } : asset;
  }
  if (!srcDead && !thumbDead) return asset;

  if (!asset.localId) return null;
  const record = await getLocalMedia(asset.localId);
  if (!record?.blob) {
    // Bytes gone too — playable only if the recorded src somehow survived.
    return srcDead ? null : { ...asset, thumbnailSrc: null };
  }

  const blob =
    record.blob instanceof Blob
      ? record.blob
      : new Blob([record.blob as unknown as BlobPart], { type: record.mime });
  const freshSrc = sessionUrlFor(asset.localId, blob);

  let freshThumb: string | null | undefined = asset.thumbnailSrc;
  if (thumbDead || !freshThumb) {
    try {
      const file = new File([blob], record.name || asset.name, {
        type: record.mime || "application/octet-stream",
      });
      const thumbBlob = await generateThumbnail(file).catch(() => null);
      freshThumb = thumbBlob ? sessionUrlFor(`${asset.localId}__thumb`, thumbBlob) : null;
    } catch {
      freshThumb = null;
    }
  }

  return { ...asset, src: freshSrc, thumbnailSrc: freshThumb ?? null };
}
