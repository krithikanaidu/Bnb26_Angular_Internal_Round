"use client";

import { core } from "@/lib/project";
import { Log } from "@openvideo/engine-pixi";
import Draggable from "@/components/shared/draggable";
import { TEXT_PRESETS } from "@/constants/text-presets";
import { ScrollArea } from "@/components/ui/scroll-area";

type TextPreset = (typeof TEXT_PRESETS)[number];

/**
 * Live preview of a text preset, rendered with its own style.
 * (The old `metadata.previewUrl` CDN images are dead, so we render the
 * actual type instead — it can never 404 and always matches the preset.)
 */
function TextPresetArt({ preset, compact = false }: { preset: TextPreset; compact?: boolean }) {
  const style = preset.style as {
    fontFamily?: string;
    fontWeight?: string | number;
    fontStyle?: string;
    color?: string;
    background?: { color?: string; paddingX?: number; paddingY?: number };
  };
  return (
    <span
      className="inline-block max-w-full truncate"
      style={{
        fontFamily: style.fontFamily ? `${style.fontFamily}, sans-serif` : undefined,
        fontWeight: (style.fontWeight as any) || 700,
        fontStyle: style.fontStyle || "normal",
        fontSize: compact ? 13 : 19,
        lineHeight: 1.25,
        color: style.color || "#fff",
        background: style.background?.color,
        padding: style.background
          ? `${(style.background.paddingY ?? 8) / 2.5}px ${(style.background.paddingX ?? 16) / 2.5}px`
          : undefined,
        borderRadius: style.background ? 6 : undefined,
      }}
    >
      {preset.text}
    </span>
  );
}

export default function PanelText() {
  const handleAddText = async (preset?: (typeof TEXT_PRESETS)[number]) => {
    try {
      const activePreset = preset || TEXT_PRESETS[0];
      // Use the new Core API to add a text clip directly with the un-normalized structure
      core.clip.add({
        type: activePreset.type,
        name: activePreset.name,
        text: preset ? activePreset.text : "This is a text clip",
        style: activePreset.style,
        timing: activePreset.timing,
        transform: activePreset.transform,
      });
    } catch (error) {
      Log.error("Failed to add text:", error);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background gap-4 py-4">
      <div className="px-4 border-b border-border/40">
        <Draggable
          data={{
            type: TEXT_PRESETS[0].type,
            name: TEXT_PRESETS[0].name,
            text: "This is a text clip",
            style: TEXT_PRESETS[0].style,
            timing: TEXT_PRESETS[0].timing,
            transform: TEXT_PRESETS[0].transform,
          }}
          renderCustomPreview={
            <div className="px-4 py-2 bg-popover border border-border rounded-md shadow-lg flex items-center justify-center max-w-56">
              <TextPresetArt preset={TEXT_PRESETS[0]} compact />
            </div>
          }
        >
          <div
            className="w-full h-9 bg-secondary hover:bg-secondary/85 text-secondary-foreground flex items-center justify-center text-sm font-medium cursor-pointer transition-colors border border-border/20 shadow-sm"
            onClick={() => handleAddText()}
          >
            Add Text
          </div>
        </Draggable>
      </div>

      <ScrollArea className="flex-1 px-4">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-4 pb-6">
          {TEXT_PRESETS.map((preset, index) => {
            return (
              <Draggable
                key={index}
                data={{
                  type: preset.type,
                  name: preset.name,
                  text: preset.text,
                  style: preset.style,
                  timing: preset.timing,
                  transform: preset.transform,
                }}
                renderCustomPreview={
                  <div className="px-4 py-2 bg-popover border border-border rounded-md shadow-lg flex items-center justify-center max-w-56">
                    <TextPresetArt preset={preset} compact />
                  </div>
                }
              >
                <button
                  onClick={() => handleAddText(preset)}
                  title={preset.name}
                  className="aspect-[3/2] w-full bg-secondary/15 hover:bg-secondary/25 border border-border/40 hover:border-border transition-all duration-200 flex flex-col items-center justify-center gap-1.5 p-3 active:scale-[0.98] shadow-sm hover:shadow-md overflow-hidden relative group rounded-md"
                >
                  <div className="flex-1 w-full flex items-center justify-center min-h-0 overflow-hidden transition-transform duration-200 group-hover:scale-105">
                    <TextPresetArt preset={preset} />
                  </div>
                  <span className="text-[10px] font-medium text-muted-foreground group-hover:text-foreground transition-colors truncate max-w-full">
                    {preset.name}
                  </span>
                </button>
              </Draggable>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
