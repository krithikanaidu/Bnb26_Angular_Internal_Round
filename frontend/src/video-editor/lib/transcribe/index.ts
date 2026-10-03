import { createClient } from "@deepgram/sdk";
import { deepgramToCombo } from "./deepgram-to-combo";
import type { TranscriptObject } from "./types";

export interface TranscribeOptions {
  /**
   * Audio URL to transcribe
   */
  url: string;

  /**
   * API key for Deepgram (optional, defaults to env variable)
   */
  apiKey?: string;

  /**
   * Target language for transcription (optional)
   * If not provided, will auto-detect
   */
  language?: string;

  /**
   * Deepgram model to use (optional, defaults to "nova-3")
   */
  model?: string;

  /**
   * Whether to enable smart formatting (optional, defaults to true)
   */
  smartFormat?: boolean;

  /**
   * Whether to include paragraphs in the result (optional, defaults to true)
   */
  paragraphs?: boolean;

  /**
   * Whether to include word-level timestamps (optional, defaults to true)
   */
  words?: boolean;
}

/**
 * Transcribe audio from a URL using Deepgram
 *
 * @param options - Transcription options
 * @returns Parsed transcription result in Combo format
 *
 * @example
 * ```typescript
 * const result = await transcribe({
 *   url: "https://example.com/audio.mp3",
 *   language: "en"
 * });
 * ```
 */
export async function transcribe(
  options: TranscribeOptions,
): Promise<Partial<TranscriptObject> | null> {
  const {
    url,
    apiKey,
    language,
    model = "nova-3",
    smartFormat = true,
    paragraphs = true,
    words = true,
  } = options;
  const resolvedKey =
    apiKey ||
    (typeof import.meta !== "undefined"
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ((import.meta as any).env?.DEEPGRAM_API_KEY ??
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (import.meta as any).env?.VITE_DEEPGRAM_API_KEY)
      : undefined);

  if (!url) {
    throw new Error("Audio URL is required");
  }

  if (!resolvedKey) {
    throw new Error("Deepgram API key is required");
  }

  // Create Deepgram client
  const deepgram = createClient(resolvedKey);

  // Build Deepgram options
  const deepgramOptions: any = {
    model,
    smart_format: smartFormat,
    paragraphs,
    detect_language: true,
  };

  // Add language if provided
  if (language && language !== "auto") {
    deepgramOptions.language = language;
  }

  // Transcribe audio
  const { result, error } = await deepgram.listen.prerecorded.transcribeUrl(
    { url },
    deepgramOptions,
  );

  if (error) {
    throw new Error(error.message || "Failed to transcribe audio");
  }

  // Convert Deepgram result to Combo format
  const parsed = await deepgramToCombo(result);

  return parsed;
}

export { deepgramToCombo } from "./deepgram-to-combo";
export { detectLanguage } from "./detect-language";
// Export types
export * from "./types";
