import { useEffect, useRef } from "react";
import hotkeys from "hotkeys-js";
import { toast } from "sonner";
import { useStore } from "zustand";
import { projectStore, core } from "@/lib/project";
import { pasteClipsAt, addClipsAndSelect } from "@/lib/clipboard";
import CanvasTimeline from "@/components/editor/timeline/items/timeline";
import type { AnyClip } from "@openvideo/core";

interface UseEditorHotkeysProps {
  timelineCanvas: CanvasTimeline | null;
  setZoomLevel?: (zoomLevel: number | ((prev: number) => number)) => void;
}

const isTextEntryActive = () => {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || el.isContentEditable;
};

export function useEditorHotkeys({ setZoomLevel }: UseEditorHotkeysProps) {
  // Keep latest values in a ref so hotkeys bind once instead of
  // re-subscribing on every playback tick / selection change.
  const currentTimeUs = useStore(projectStore, (s) => s.currentTime);
  const selectedIds = useStore(projectStore, (s) => s.selectedIds);
  const fps = useStore(projectStore, (s) => s.settings.fps);

  const stateRef = useRef({ currentTimeUs, selectedIds, fps });
  stateRef.current = { currentTimeUs, selectedIds, fps };

  const setZoomRef = useRef(setZoomLevel);
  setZoomRef.current = setZoomLevel;

  useEffect(() => {
    // Play/Pause
    hotkeys("space", (event) => {
      event.preventDefault();
      core.playback.toggle();
    });

    // Split
    hotkeys("command+b, ctrl+b, command+k, ctrl+k", (event) => {
      event.preventDefault();
      const { currentTimeUs, selectedIds } = stateRef.current;
      const { clips } = projectStore.getState();
      const candidates =
        selectedIds.length > 0
          ? selectedIds.map((id) => clips[id]).filter(Boolean)
          : Object.values(clips);
      const canSplit = candidates.some((clip) => {
        const { from, to } = clip.timing?.display ?? {};
        return Number.isFinite(from) && Number.isFinite(to) && currentTimeUs > from && currentTimeUs < to;
      });
      if (!canSplit) {
        toast.info("Place the playhead over a clip to split");
        return;
      }
      core.clip.split(currentTimeUs);
    });

    // Delete
    hotkeys("backspace, delete", (event) => {
      if (isTextEntryActive()) return;

      event.preventDefault();
      const { selectedIds } = stateRef.current;
      if (selectedIds.length > 0) {
        core.clip.remove(selectedIds);
      }
    });

    // Select All
    hotkeys("command+a, ctrl+a", (event) => {
      if (isTextEntryActive()) return;

      event.preventDefault();
      const { clips } = projectStore.getState();
      projectStore.getState().select(Object.keys(clips));
    });

    // Copy
    hotkeys("command+c, ctrl+c", (event) => {
      if (isTextEntryActive()) return;

      event.preventDefault();
      const { clips, selectedIds } = projectStore.getState();
      if (selectedIds.length === 0) return;

      const items = selectedIds
        .map((id) => clips[id])
        .filter(Boolean)
        .map((clip) => JSON.parse(JSON.stringify(clip)));
      projectStore.getState().setClipboard(items);
    });

    // Cut
    hotkeys("command+x, ctrl+x", (event) => {
      if (isTextEntryActive()) return;

      event.preventDefault();
      const { clips, selectedIds } = projectStore.getState();
      if (selectedIds.length === 0) return;

      const items = selectedIds
        .map((id) => clips[id])
        .filter(Boolean)
        .map((clip) => JSON.parse(JSON.stringify(clip)));
      projectStore.getState().setClipboard(items);

      core.clip.remove(selectedIds);
    });

    // Paste
    hotkeys("command+v, ctrl+v", (event) => {
      if (isTextEntryActive()) return;

      event.preventDefault();
      const clipboard = projectStore.getState().clipboard;
      if (clipboard.length === 0) return;

      const currentTime = core.store.getState().currentTime;
      void addClipsAndSelect(pasteClipsAt(clipboard as AnyClip[], currentTime));
    });

    // Zoom In
    hotkeys("command+=, ctrl+=", (event) => {
      event.preventDefault();
      setZoomRef.current?.((prev) => Math.min(10, prev + 0.15));
    });

    // Zoom Out
    hotkeys("command+-, ctrl+-", (event) => {
      event.preventDefault();
      setZoomRef.current?.((prev) => Math.max(0.1, prev - 0.15));
    });

    // Undo / Redo
    hotkeys("command+z, ctrl+z", (event) => {
      if (isTextEntryActive()) return;

      event.preventDefault();
      core.undo();
    });

    hotkeys("command+shift+z, ctrl+shift+z, command+y, ctrl+y", (event) => {
      if (isTextEntryActive()) return;

      event.preventDefault();
      core.redo();
    });

    // Move Up
    hotkeys("up, shift+up", (event) => {
      if (isTextEntryActive()) return;
      event.preventDefault();
      const step = event.shiftKey ? 5 : 1;
      const { selectedIds } = stateRef.current;
      const { clips } = projectStore.getState();
      selectedIds.forEach((id) => {
        const clip = clips[id];
        if (clip) {
          core.clip.update(id, {
            transform: { ...clip.transform, y: clip.transform.y - step },
          });
        }
      });
    });

    // Move Down
    hotkeys("down, shift+down", (event) => {
      if (isTextEntryActive()) return;
      event.preventDefault();
      const step = event.shiftKey ? 5 : 1;
      const { selectedIds } = stateRef.current;
      const { clips } = projectStore.getState();
      selectedIds.forEach((id) => {
        const clip = clips[id];
        if (clip) {
          core.clip.update(id, {
            transform: { ...clip.transform, y: clip.transform.y + step },
          });
        }
      });
    });

    // Move Left
    hotkeys("left, shift+left", (event) => {
      if (isTextEntryActive()) return;
      event.preventDefault();
      const step = event.shiftKey ? 5 : 1;
      const { selectedIds } = stateRef.current;
      const { clips } = projectStore.getState();
      selectedIds.forEach((id) => {
        const clip = clips[id];
        if (clip) {
          core.clip.update(id, {
            transform: { ...clip.transform, x: clip.transform.x - step },
          });
        }
      });
    });

    // Move Right
    hotkeys("right, shift+right", (event) => {
      if (isTextEntryActive()) return;
      event.preventDefault();
      const step = event.shiftKey ? 5 : 1;
      const { selectedIds } = stateRef.current;
      const { clips } = projectStore.getState();
      selectedIds.forEach((id) => {
        const clip = clips[id];
        if (clip) {
          core.clip.update(id, {
            transform: { ...clip.transform, x: clip.transform.x + step },
          });
        }
      });
    });

    // Last Frame
    hotkeys("command+left, ctrl+left", (event) => {
      event.preventDefault();
      const frameDurationUs = 1_000_000 / stateRef.current.fps;
      core.seek(Math.max(0, stateRef.current.currentTimeUs - frameDurationUs));
    });

    // Next Frame
    hotkeys("command+right, ctrl+right", (event) => {
      event.preventDefault();
      const frameDurationUs = 1_000_000 / stateRef.current.fps;
      core.seek(stateRef.current.currentTimeUs + frameDurationUs);
    });

    return () => {
      hotkeys.unbind("space");
      hotkeys.unbind("command+b, ctrl+b, command+k, ctrl+k");
      hotkeys.unbind("backspace, delete");
      hotkeys.unbind("command+a, ctrl+a");
      hotkeys.unbind("command+c, ctrl+c");
      hotkeys.unbind("command+x, ctrl+x");
      hotkeys.unbind("command+v, ctrl+v");
      hotkeys.unbind("command+=, ctrl+=");
      hotkeys.unbind("command+-, ctrl+-");
      hotkeys.unbind("command+z, ctrl+z");
      hotkeys.unbind("command+shift+z, ctrl+shift+z, command+y, ctrl+y");
      hotkeys.unbind("up, shift+up");
      hotkeys.unbind("down, shift+down");
      hotkeys.unbind("left, shift+left");
      hotkeys.unbind("right, shift+right");
      hotkeys.unbind("command+left, ctrl+left");
      hotkeys.unbind("command+right, ctrl+right");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
