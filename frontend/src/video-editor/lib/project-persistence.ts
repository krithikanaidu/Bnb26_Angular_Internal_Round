"use client";

import { core, projectStore } from "@/lib/project";
import { useProjectStore } from "@/stores/project-store";
import { playableUrlForLocalId } from "./local-media-store";

const PROJECT_KEY = "creatorai-ve-project-v1";
const SAVE_DEBOUNCE_MS = 900;

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let autosaveStarted = false;
let restoreInProgress = false;

interface StoredProject {
  v: number;
  name?: string;
  snapshot: any;
}

function readStoredProject(): StoredProject | null {
  try {
    const raw = localStorage.getItem(PROJECT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    // Current wrapper shape…
    if (parsed.snapshot && typeof parsed.snapshot === "object") {
      const snapshot = parsed.snapshot;
      if (!snapshot.settings || (!snapshot.clips && !snapshot.tracks)) return null;
      return { v: parsed.v ?? 1, name: parsed.name, snapshot };
    }
    // Tolerate a bare snapshot.
    if (!parsed.settings || (!parsed.clips && !parsed.tracks)) return null;
    return { v: 1, snapshot: parsed };
  } catch {
    return null;
  }
}

export function saveProjectNow(): void {
  try {
    const snapshot = core.project.export();
    let name: string | undefined;
    try {
      name = useProjectStore.getState().projectName;
    } catch {
      /* UI store unavailable */
    }
    const stored: StoredProject = { v: 1, name, snapshot };
    localStorage.setItem(PROJECT_KEY, JSON.stringify(stored));
  } catch {
    /* quota or unavailable — session-only editing */
  }
}

/** Persist the project (debounced) on every store change. Idempotent. */
export function startProjectAutosave(): void {
  if (autosaveStarted || typeof window === "undefined") return;
  autosaveStarted = true;

  const schedule = () => {
    if (restoreInProgress) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(saveProjectNow, SAVE_DEBOUNCE_MS);
  };

  projectStore.subscribe(schedule);
  window.addEventListener("pagehide", saveProjectNow);
}

/** Drop the saved project (e.g. explicit "New project" flows call this). */
export function clearSavedProject(): void {
  try {
    localStorage.removeItem(PROJECT_KEY);
  } catch {
    /* noop */
  }
}

function clipSrc(clip: any): string {
  return clip?.src || "";
}

function clipLocalId(clip: any): string | null {
  return clip?.metadata?.localId || null;
}

export interface RestoreResult {
  restored: boolean;
  droppedClips: number;
}

/**
 * Restore the autosaved project, remapping local vault bytes to fresh
 * playable URLs. Clips whose blob: src died with no vault bytes are dropped
 * (they would render as black/missing otherwise).
 */
export async function restoreSavedProject(): Promise<RestoreResult> {
  const stored = readStoredProject();
  if (!stored) return { restored: false, droppedClips: 0 };
  const snapshot = stored.snapshot;

  restoreInProgress = true;
  try {
    const clips = snapshot.clips || {};
    const entries = Object.entries<any>(clips);
    let droppedClips = 0;

    for (const [id, clip] of entries) {
      const src = clipSrc(clip);
      if (!src || !src.startsWith("blob:")) continue;

      const localId = clipLocalId(clip);
      const fresh = localId ? await playableUrlForLocalId(localId) : null;
      if (fresh) {
        clip.src = fresh;
        // Thumbnails are session-only; drop dead ones, panels regenerate lazily.
        if (clip.metadata?.previewUrl?.startsWith("blob:")) {
          clip.metadata = { ...clip.metadata, previewUrl: undefined };
        }
      } else {
        delete clips[id];
        droppedClips += 1;
      }
    }

    // Drop dangling track references to removed clips.
    for (const track of snapshot.tracks || []) {
      if (Array.isArray(track.clipIds)) {
        track.clipIds = track.clipIds.filter((id: string) => clips[id]);
      }
    }

    core.project.import(snapshot);
    if (typeof stored.name === "string" && stored.name) {
      try {
        useProjectStore.getState().setProjectName(stored.name);
      } catch {
        /* name is best-effort */
      }
    }

    return { restored: true, droppedClips };
  } catch (error) {
    console.warn("[project-persistence] restore failed, starting fresh:", error);
    return { restored: false, droppedClips: 0 };
  } finally {
    restoreInProgress = false;
  }
}
