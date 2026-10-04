import { useState } from "react";
import {
  Effect,
  getEffectOptions,
  VALUES_FILTER_SPECIAL,
  registerCustomEffect,
} from "@openvideo/engine-pixi";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatFilterName } from "@/utils/effects";
import { core, projectStore } from "@/lib/project";
import Draggable from "@/components/shared/draggable";
import { useIsDraggingOverTimeline } from "@/hooks/use-is-dragging-over-timeline";
import { PreviewArt, SafeImg } from "./preview-art";
import { Icons } from "@/components/shared/icons";
import { moveEffectTracksToTop } from "@/lib/track-order";

const EFFECT_DURATION_DEFAULT = 5000000;

const gridClasses = `
  grid
  grid-cols-[repeat(auto-fill,minmax(80px,1fr))]
  gap-4
  justify-items-center
`;

type EffectCardProps = {
  label: string;
  staticSrc: string;
  dynamicSrc: string;
  onClick: () => void;
  badge?: string;
  effectKey?: string;
};

const EffectCard = ({
  label,
  staticSrc,
  dynamicSrc,
  onClick,
  badge,
  effectKey,
}: EffectCardProps) => {
  const [dynState, setDynState] = useState<"idle" | "loading" | "ready" | "dead">("idle");
  const [isHovering, setIsHovering] = useState(false);
  const isDraggingOverTimeline = useIsDraggingOverTimeline();
  const showDynamic = isHovering && dynState === "ready";

  const preloadDynamic = () => {
    if (!dynamicSrc || dynState !== "idle") return;
    setDynState("loading");
    const img = new Image();
    img.onload = () => setDynState("ready");
    img.onerror = () => setDynState("dead");
    img.src = dynamicSrc;
  };

  return (
    <Draggable
      data={{
        type: "Effect",
        name: label,
        effectKey: effectKey || label,
        display: { from: 0, to: EFFECT_DURATION_DEFAULT },
        duration: EFFECT_DURATION_DEFAULT,
      }}
      shouldDisplayPreview={!isDraggingOverTimeline}
      renderCustomPreview={
        <div className="w-20 aspect-video overflow-hidden shadow-xl border-2 border-primary bg-secondary flex items-center justify-center">
          <span className="text-[10px] text-white font-medium px-2 text-center">{label}</span>
        </div>
      }
    >
      <div
        className="flex w-full flex-col items-center gap-2 cursor-pointer group"
        onClick={onClick}
        onMouseEnter={() => {
          setIsHovering(true);
          preloadDynamic();
        }}
        onMouseLeave={() => setIsHovering(false)}
      >
        <div className="relative w-full aspect-video bg-input/30 border border-border/50 rounded-md overflow-hidden transition-colors group-hover:border-border">
          {/* Always-on generated art — never a black box, even with no CDN */}
          <PreviewArt label={label} icon={<Icons.sparkle className="w-5 h-5" />} />
          {/* Remote thumbnails layer on top only when they actually load */}
          <SafeImg src={staticSrc} alt={label} />
          {showDynamic && dynamicSrc ? <SafeImg src={dynamicSrc} alt={label} /> : null}
          {isHovering && dynState === "loading" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <div className="w-6 h-6 border-2 border-white/40 border-t-white animate-spin rounded-full" />
            </div>
          )}

          {badge && (
            <div className="absolute top-1 right-1 bg-primary/80 text-primary-foreground text-[9px] font-semibold px-1.5 py-0.5 leading-none">
              {badge}
            </div>
          )}

          <div
            className={`absolute bottom-0 left-0 w-full px-2 py-1.5 bg-gradient-to-t from-black/85 to-transparent text-white text-[11px] font-medium truncate text-center transition-opacity duration-200 ${
              showDynamic ? "opacity-0" : ""
            }`}
          >
            {label}
          </div>
        </div>
      </div>
    </Draggable>
  );
};

// ─── Combined Effects List ────────────────────────────────────────────────────

type CustomPreset = {
  id: string;
  name: string;
  category: string;
  data: { label: string; fragment: string };
  published: boolean;
  userId: string;
};

const CombinedEffects = () => {
  const [ownPresets, setOwnPresets] = useState<CustomPreset[]>([]);
  const effects = getEffectOptions();

  const specialEffects = Object.keys(VALUES_FILTER_SPECIAL).map((filterName) => ({
    key: filterName,
    label: formatFilterName(filterName),
    previewStatic: `https://cdn.subgen.co/previews/effects/static/effect_${filterName}_static.webp`,
    previewDynamic: `https://cdn.subgen.co/previews/effects/dynamic/effect_${filterName}_dynamic.webp`,
  }));
  const allEffects = [...specialEffects, ...effects];

  const handleDefaultClick = async (key: string) => {
    const effectValues: Record<string, any> = {};
    if (key === "embossFilter") effectValues.strength = 5;
    if (key === "pixelateFilter") effectValues.size = 10;

    // Place at the playhead (not 0–5s) and keep the effect track above the
    // footage — the engine only applies effects to tracks below them.
    const from = Math.max(0, projectStore.getState().currentTime ?? 0);
    await core.clip.add({
      type: "Effect",
      name: formatFilterName(key),
      effectKey: key,
      display: { from, to: from + EFFECT_DURATION_DEFAULT },
      duration: EFFECT_DURATION_DEFAULT,
      values: effectValues,
    });
    await moveEffectTracksToTop();
  };

  const handleCustomClick = async (preset: CustomPreset) => {
    const key = `custom_${preset.id}`;
    await registerCustomEffect(key, {
      key,
      label: preset.data.label || preset.name,
      fragment: preset.data.fragment,
    } as any);
    const from = Math.max(0, projectStore.getState().currentTime ?? 0);
    await core.clip.add({
      type: "Effect",
      name: preset.data.label || preset.name,
      effectKey: key,
      display: { from, to: from + EFFECT_DURATION_DEFAULT },
      duration: EFFECT_DURATION_DEFAULT,
    });
    await moveEffectTracksToTop();
  };

  return (
    <>
      {/* Default effects */}
      {allEffects.map((effect) => (
        <EffectCard
          key={effect.key}
          label={effect.label}
          effectKey={effect.key}
          staticSrc={effect.previewStatic}
          dynamicSrc={effect.previewDynamic}
          onClick={() => handleDefaultClick(effect.key)}
        />
      ))}

      {/* Custom effects */}
      {ownPresets.map((preset) => (
        <EffectCard
          key={preset.id}
          label={preset.data.label || preset.name}
          effectKey={`custom_${preset.id}`}
          staticSrc=""
          dynamicSrc=""
          onClick={() => handleCustomClick(preset)}
          badge="Custom"
        />
      ))}
    </>
  );
};

// ─── Panel ────────────────────────────────────────────────────────────────────

const PanelEffect = () => {
  return (
    <div className="p-4 h-full">
      <ScrollArea className="h-full">
        <div className={gridClasses}>
          <CombinedEffects />
        </div>
      </ScrollArea>
    </div>
  );
};

export default PanelEffect;
