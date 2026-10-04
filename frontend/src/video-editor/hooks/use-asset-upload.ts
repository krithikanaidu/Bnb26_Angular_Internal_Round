"use client";

import { useState, useCallback } from "react";
import { useAssetsStore, type ProjectFile } from "@/stores/assets-store";
import { getPresignedConfig, uploadFileWithConfig } from "@/lib/upload-utils";
import { isApiUnavailable } from "@/lib/editor-api";
import { saveLocalMedia, sessionUrlFor } from "@/lib/local-media-store";
import { generateThumbnail } from "@/lib/thumbnail-generator";
import { analyzeVideo } from "@/lib/video-analysis";

export type MediaType = "image" | "video" | "audio";

interface UploadResult {
  success: boolean;
  fileName: string;
  error?: string;
}

interface UseAssetUploadOptions {
  spaceId: string | null;
  onComplete?: () => void;
}

export function useAssetUpload({ spaceId, onComplete }: UseAssetUploadOptions) {
  const [isUploading, setIsUploading] = useState(false);
  const { addFiles, updateFile } = useAssetsStore();

  const detectFileType = (file: File): MediaType => {
    const mime = file.type.toLowerCase();
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (mime.startsWith("audio/") || ["mp3", "wav", "ogg", "flac", "aac", "m4a"].includes(ext))
      return "audio";
    if (mime.startsWith("video/") || ["mp4", "webm", "mov", "avi", "mkv"].includes(ext))
      return "video";
    return "image";
  };

  const createTempFile = (file: File, spaceId: string): ProjectFile => ({
    id: `temp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    spaceId,
    name: file.name,
    type: detectFileType(file),
    src: "",
    duration: undefined,
    size: file.size,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    indexingStatus: null,
    uploadProgress: 0,
  });

  const processFile = async (file: File, tempId: string): Promise<UploadResult> => {
    const type = detectFileType(file);
    let currentId = tempId;
    const targetSpaceId = spaceId || "guest";

    try {
      // Asset id first: local-only uploads reuse it as the vault key so the
      // session URL, the record and the stored bytes always line up.
      const guestAssetId = crypto.randomUUID();

      // Step 1: Analyze + thumbnail in parallel (both fully client-side).
      // Cloud presign is optional: without a /api backend we fall back to a
      // local blob URL so uploads keep working inside this browser session.
      const [videoInfo, thumbnailBlob] = await Promise.all([
        type === "video" ? analyzeVideo(file) : Promise.resolve(undefined),
        generateThumbnail(file).catch(() => null),
      ]);

      let uploadConfig: Awaited<ReturnType<typeof getPresignedConfig>> | null = null;
      try {
        uploadConfig = await getPresignedConfig(file.name);
      } catch (error) {
        if (!isApiUnavailable(error)) throw error;
        uploadConfig = null;
      }
      const localSrc = uploadConfig ? null : sessionUrlFor(guestAssetId, file);
      const fileSrc = uploadConfig?.url ?? localSrc ?? "";
      // Step 2: Presign thumbnail if generated (cloud only)
      let thumbnailUploadConfig: Awaited<ReturnType<typeof getPresignedConfig>> | null = null;
      let thumbnailSrc: string | undefined;
      if (thumbnailBlob) {
        if (uploadConfig) {
          const thumbName = `thumb_${file.name.replace(/\.[^.]+$/, "")}.webp`;
          thumbnailUploadConfig = await getPresignedConfig(thumbName).catch(() => null);
          thumbnailSrc = thumbnailUploadConfig?.url;
        } else {
          thumbnailSrc = URL.createObjectURL(
            thumbnailBlob instanceof File
              ? thumbnailBlob
              : new File([thumbnailBlob], "thumbnail.webp", { type: "image/webp" }),
          );
        }
      }

      // Step 3: Create asset locally
      // Persist bytes so the asset survives reload (blob: URLs don't).
      // Cloud uploads don't need this; local-only ones do.
      let localId: string | null = null;
      if (!uploadConfig) {
        localId = guestAssetId;
        void saveLocalMedia({
          id: localId,
          blob: file,
          name: file.name,
          mime: file.type || "application/octet-stream",
          size: file.size,
          createdAt: Date.now(),
        });
      }
      const newAsset = {
        id: guestAssetId,
        spaceId: targetSpaceId,
        name: file.name,
        type,
        src: fileSrc,
        localId,
        thumbnailSrc,
        duration: videoInfo?.duration,
        size: file.size,
        width: videoInfo?.width,
        height: videoInfo?.height,
        fps: videoInfo?.estimatedFps,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        indexingStatus: null,
        indexingProgress: null,
        indexingStage: null,
        indexingError: null,
      };
      currentId = guestAssetId;

      // Step 4: Update temp file with real ID
      updateFile(tempId, {
        id: currentId,
        src: fileSrc,
        thumbnailSrc: thumbnailSrc ?? null,
        duration: videoInfo?.duration,
        width: videoInfo?.width,
        height: videoInfo?.height,
        uploadProgress: 0,
        indexingStatus: null,
        indexingStage: null,
        indexingProgress: null,
        indexingError: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Step 5: Upload file + thumbnail to R2 (cloud only — skipped for local blob URLs)
      if (uploadConfig) {
        await Promise.all([
          uploadFileWithConfig(file, uploadConfig, (progress) => {
            updateFile(currentId, { uploadProgress: progress });
          }),
          thumbnailBlob && thumbnailUploadConfig
            ? uploadFileWithConfig(
                new File([thumbnailBlob], "thumbnail.webp", { type: "image/webp" }),
                thumbnailUploadConfig,
              ).catch(() => null)
            : Promise.resolve(),
        ]);
      }

      // Step 6: Clear progress and save to localStorage
      updateFile(currentId, {
        uploadProgress: null,
        indexingStatus: null,
      });

      // Save to localStorage
      const localKey = `ov_assets_${targetSpaceId}`;
      const stored = localStorage.getItem(localKey);
      const existingAssets = stored ? JSON.parse(stored) : [];
      const updatedAssets = [newAsset, ...existingAssets];
      localStorage.setItem(localKey, JSON.stringify(updatedAssets));

      return { success: true, fileName: file.name };
    } catch (error: any) {
      console.error(`[Upload] Failed for ${file.name}:`, error);
      updateFile(currentId, { uploadProgress: null, indexingStatus: "failed" });
      return { success: false, fileName: file.name, error: error.message };
    }
  };

  const uploadFiles = useCallback(
    async (files: FileList | null) => {
      const targetSpaceId = spaceId || "guest";
      if (!files?.length) return;

      setIsUploading(true);
      const fileArray = Array.from(files);

      // Create temp entries
      const tempFiles = fileArray.map((file) => createTempFile(file, targetSpaceId));
      addFiles(tempFiles);

      // Process all files
      const results = await Promise.all(
        fileArray.map((file, index) => processFile(file, tempFiles[index].id)),
      );

      setIsUploading(false);
      onComplete?.();

      return results;
    },
    [spaceId, addFiles, updateFile, onComplete],
  );

  return { uploadFiles, isUploading };
}
