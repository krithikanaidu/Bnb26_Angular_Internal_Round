"use client";

import { RiCloudOffLine } from "@remixicon/react";
import type { ComponentType } from "react";

interface BackendEmptyStateProps {
  icon: ComponentType<{ size?: number | string; className?: string }>;
  title: string;
  hint?: string;
}

/**
 * Friendly empty state shown when a stock-media panel can't reach the
 * `/api/*` backend. Uploads from the device and the timeline keep working.
 */
export function BackendEmptyState({ icon: Icon, title, hint }: BackendEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-6 text-center gap-2">
      <span className="flex size-11 items-center justify-center rounded-full bg-secondary/60 text-muted-foreground">
        <Icon size={20} />
      </span>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {hint ??
          "The stock library needs the /api backend. Device uploads and timeline editing work offline."}
      </p>
      <span className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/40 px-2.5 py-1 text-[10px] text-muted-foreground">
        <RiCloudOffLine size={12} />
        Backend not connected
      </span>
    </div>
  );
}
