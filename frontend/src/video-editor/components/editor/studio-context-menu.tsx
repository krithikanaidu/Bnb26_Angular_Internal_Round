"use client";

import * as React from "react";
import { useCallback } from "react";
import { useStore } from "zustand";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  RiClipboardLine,
  RiFileCopyLine,
  RiMoreLine,
  RiLockLine,
  RiLockUnlockLine,
  RiDeleteBinLine,
} from "@remixicon/react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { core, projectStore } from "@/lib/project";
import { duplicateClips, pasteClipsAt, addClipsAndSelect } from "@/lib/clipboard";
import { AnyClip } from "@openvideo/core";

export function useClipActions(clipOverride?: any) {
  const selectedIds = useStore(projectStore, (s) => s.selectedIds);
  const primaryId = clipOverride?.id || selectedIds[0];
  const selectedClip = useStore(projectStore, (s) => s.clips[primaryId]);
  const clipboard = useStore(projectStore, (s) => s.clipboard);

  const hasClipboard = clipboard.length > 0;
  const isLocked = selectedClip?.locked ?? false;

  const handleCopy = useCallback(() => {
    if (!selectedClip) return;
    projectStore
      .getState()
      .setClipboard([JSON.parse(JSON.stringify(selectedClip)) as AnyClip]);
  }, [selectedClip]);

  const handlePaste = useCallback(async () => {
    const items = projectStore.getState().clipboard;
    if (items.length === 0) return;

    const currentTime = core.store.getState().currentTime;
    await addClipsAndSelect(pasteClipsAt(items as AnyClip[], currentTime));
  }, []);

  const handleDuplicate = useCallback(async () => {
    const ids = clipOverride ? [clipOverride.id] : selectedIds;
    if (ids.length === 0) return;
    const { clips } = projectStore.getState();
    const clipsToDuplicate = ids
      .map((id) => clips[id])
      .filter(Boolean)
      .map((clip) => JSON.parse(JSON.stringify(clip)));
    if (clipsToDuplicate.length === 0) return;
    await addClipsAndSelect(duplicateClips(clipsToDuplicate as AnyClip[]));
  }, [selectedIds, clipOverride]);

  const handleToggleLock = useCallback(async () => {
    if (!selectedClip) return;
    core.clip.update(selectedClip.id, { locked: !isLocked });
  }, [selectedClip, isLocked]);

  const handleDelete = useCallback(async () => {
    const ids = clipOverride ? [clipOverride.id] : selectedIds;
    if (ids.length === 0) return;
    core.clip.remove(ids);
  }, [selectedIds, clipOverride]);

  return {
    selectedClip,
    isLocked,
    hasClipboard,
    handleCopy,
    handlePaste,
    handleDuplicate,
    handleToggleLock,
    handleDelete,
  };
}

export function StudioContextMenu() {
  const {
    selectedClip,
    isLocked,
    hasClipboard,
    handleCopy,
    handlePaste,
    handleDuplicate,
    handleToggleLock,
    handleDelete,
  } = useClipActions();

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "w-9 h-9 rounded-full transition-all hover:bg-accent/50 active:scale-90",
              )}
            >
              <RiMoreLine className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>More</p>
        </TooltipContent>
      </Tooltip>

      <DropdownMenuContent className="w-44">
        <DropdownMenuGroup>
          {!isLocked && (
            <>
              <DropdownMenuItem onClick={handleCopy} disabled={!selectedClip}>
                <RiFileCopyLine />
                Copy
                <DropdownMenuShortcut>⌘ C</DropdownMenuShortcut>
              </DropdownMenuItem>

              <DropdownMenuItem onClick={handlePaste} disabled={!hasClipboard}>
                <RiClipboardLine />
                Paste
                <DropdownMenuShortcut>⌘ V</DropdownMenuShortcut>
              </DropdownMenuItem>

              <DropdownMenuItem onClick={handleDuplicate} disabled={!selectedClip}>
                <RiFileCopyLine />
                Duplicate
                <DropdownMenuShortcut>⌘ D</DropdownMenuShortcut>
              </DropdownMenuItem>
            </>
          )}

          <DropdownMenuItem onClick={handleToggleLock} disabled={!selectedClip}>
            {isLocked ? <RiLockUnlockLine /> : <RiLockLine />}
            {isLocked ? "Unlock" : "Lock"}
            <DropdownMenuShortcut>⌘ L</DropdownMenuShortcut>
          </DropdownMenuItem>

          {!isLocked && (
            <DropdownMenuItem onClick={handleDelete} disabled={!selectedClip}>
              <RiDeleteBinLine />
              Delete
              <DropdownMenuShortcut>⌫</DropdownMenuShortcut>
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
