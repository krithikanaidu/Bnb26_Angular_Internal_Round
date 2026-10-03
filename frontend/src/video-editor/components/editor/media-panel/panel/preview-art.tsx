"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Deterministic hue per label so every card gets its own duotone. */
export function hashHue(label: string): number {
  let h = 0;
  for (let i = 0; i < label.length; i++) {
    h = (h * 31 + label.charCodeAt(i)) % 360;
  }
  return h;
}

interface PreviewArtProps {
  label: string;
  icon?: ReactNode;
  className?: string;
}

/**
 * Offline-safe preview art for effect / transition cards.
 * Renders a duotone "sample scene" (glow + horizon + sheen + grain) derived
 * from the label — always looks intentional, never a black box. Remote
 * thumbnail <img>s layer on top via SafeImg when the CDN cooperates.
 */
export function PreviewArt({ label, icon, className }: PreviewArtProps) {
  const hue = hashHue(label || "x");
  const hue2 = (hue + 48) % 360;
  const hue3 = (hue + 310) % 360;

  return (
    <div
      aria-hidden
      className={cn("absolute inset-0 overflow-hidden", className)}
      style={{
        background: `linear-gradient(155deg, hsl(${hue} 38% 22%) 0%, hsl(${hue2} 42% 13%) 58%, hsl(${hue3} 36% 8%) 100%)`,
      }}
    >
      {/* glow */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(90% 70% at 72% 18%, hsl(${hue} 80% 62% / 0.5) 0%, transparent 60%)`,
        }}
      />
      {/* horizon silhouette */}
      <div
        className="absolute inset-x-0 bottom-0"
        style={{
          height: "42%",
          background: `linear-gradient(to top, hsl(${hue2} 30% 6% / 0.9), transparent)`,
        }}
      />
      <div
        className="absolute inset-x-0"
        style={{
          bottom: "30%",
          height: "1px",
          background: `linear-gradient(to right, transparent, hsl(${hue} 70% 70% / 0.55), transparent)`,
        }}
      />
      {/* sheen */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(115deg, transparent 30%, rgb(255 255 255 / 0.07) 45%, transparent 60%)",
        }}
      />
      {/* grain */}
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage: "radial-gradient(rgb(255 255 255 / 0.13) 0.5px, transparent 0.6px)",
          backgroundSize: "7px 7px",
        }}
      />
      {icon && (
        <div className="absolute inset-0 flex items-center justify-center text-white/40">
          {icon}
        </div>
      )}
    </div>
  );
}

interface SafeImgProps {
  src?: string;
  alt: string;
  className?: string;
  onFail?: () => void;
  onLoad?: () => void;
}

/** <img> that removes itself on error (dead CDN) instead of showing broken art. */
export function SafeImg({ src, alt, className, onFail, onLoad }: SafeImgProps) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;
  return (
    <img
      src={src}
      alt={alt}
      draggable={false}
      className={cn("absolute inset-0 h-full w-full object-cover", className)}
      onError={() => {
        setFailed(true);
        onFail?.();
      }}
      onLoad={onLoad}
    />
  );
}
