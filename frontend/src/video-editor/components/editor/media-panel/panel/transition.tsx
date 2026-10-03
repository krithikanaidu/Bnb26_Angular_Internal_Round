import { useState } from "react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getTransitionOptions, registerCustomTransition } from "@openvideo/engine-pixi";
import { Icons } from "@/components/shared/icons";
import { core } from "@/lib/project";
import Draggable from "@/components/shared/draggable";
import { useIsDraggingOverTimeline } from "@/hooks/use-is-dragging-over-timeline";
import { PreviewArt, SafeImg } from "./preview-art";
import { resolveTransitionTargets } from "@/lib/track-order";

const TRANSITION_DURATION_DEFAULT = 2_000_000;

const gridClasses = `
  grid
  grid-cols-[repeat(auto-fill,minmax(80px,1fr))]
  gap-4
  justify-items-center
`;

// ─── Types ────────────────────────────────────────────────────────────────────

type CustomPreset = {
  id: string;
  name: string;
  category: string;
  data: { label: string; fragment: string };
  published: boolean;
  userId: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

// ─── Shared card for built-in transitions ─────────────────────────────────────

type TransitionCardProps = {
  effectKey: string;
  label: string;
  previewStatic: string;
  previewDynamic: string;
  onClick: () => void;
  badge?: string;
};

const TransitionCard = ({
  effectKey,
  label,
  previewStatic,
  previewDynamic,
  onClick,
  badge,
}: TransitionCardProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const [dynOk, setDynOk] = useState(true);
  const isDraggingOverTimeline = useIsDraggingOverTimeline();
  const showDynamic = isHovered && previewDynamic && dynOk;

  const dragData = {
    type: "Transition",
    name: label,
    transitionKey: effectKey,
    duration: TRANSITION_DURATION_DEFAULT,
  };

  return (
    <Draggable
      data={dragData}
      shouldDisplayPreview={!isDraggingOverTimeline}
      renderCustomPreview={
        <div className="w-12 h-12 bg-black rounded flex items-center justify-center opacity-90 shadow-lg border border-primary/50">
          <Icons.transition className="text-white w-6 h-6" />
        </div>
      }
    >
      <div
        className="flex w-full items-center gap-2 flex-col group cursor-pointer"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={onClick}
      >
        <div className="relative w-full aspect-video bg-input/30 border border-border/50 rounded-md overflow-hidden transition-colors group-hover:border-border">
          {/* Always-on generated art — never a black box, even with no CDN */}
          <PreviewArt label={label} icon={<Icons.transition className="w-5 h-5" />} />
          {/* Remote thumbnails layer on top only when they actually load */}
          <SafeImg src={previewStatic} alt={label} />
          {showDynamic ? (
            <SafeImg src={previewDynamic} alt={label} onFail={() => setDynOk(false)} />
          ) : null}

          {badge && (
            <div className="absolute top-1 right-1 bg-primary/80 text-primary-foreground text-[9px] font-semibold px-1.5 py-0.5 leading-none">
              {badge}
            </div>
          )}

          <div className="absolute bottom-0 left-0 w-full px-2 py-1.5 bg-gradient-to-t from-black/85 to-transparent text-white text-[11px] font-medium truncate text-center transition-opacity duration-150 group-hover:opacity-0">
            {label}
          </div>
        </div>
      </div>
    </Draggable>
  );
};

// ─── Combined Transition List ────────────────────────────────────────────────

const CombinedTransitions = () => {
  const [ownPresets, setOwnPresets] = useState<CustomPreset[]>([]);
  const allDefaults = getTransitionOptions();

  // Click-adding must link two real clips — the studio ignores transitions
  // without fromClipId/toClipId. Attaches at the playhead (or selection).
  const addTransitionAtPlayhead = async (name: string, transitionKey: string) => {
    const targets = resolveTransitionTargets();
    if (!targets) {
      toast.error("Add a video clip first", {
        description:
          "Transitions join two clips. Add footage to the timeline, move the playhead over a cut, then pick a transition.",
      });
      return;
    }
    await core.clip.add({
      type: "Transition",
      name,
      transitionKey,
      duration: targets.duration,
      fromClipId: targets.fromClipId,
      toClipId: targets.toClipId,
    } as any);
    toast.success(`Transition added: ${name}`, {
      description: "Tweak its length from the right panel when selected.",
    });
  };

  const handleCustomClick = async (preset: CustomPreset) => {
    const key = `custom_${preset.id}`;
    await registerCustomTransition(key, {
      key,
      label: preset.data.label || preset.name,
      fragment: preset.data.fragment,
    } as any);
    await addTransitionAtPlayhead(preset.data.label || preset.name, key);
  };

  const customPresets = [...ownPresets];

  return (
    <>
      {/* Default transitions */}
      {allDefaults.map((effect) => (
        <TransitionCard
          key={effect.key}
          effectKey={effect.key}
          label={effect.label}
          previewStatic={effect.previewStatic}
          previewDynamic={effect.previewDynamic}
          onClick={() => addTransitionAtPlayhead(effect.label, effect.key)}
        />
      ))}

      {/* Custom transitions */}
      {customPresets.map((preset) => (
        <TransitionCard
          key={preset.id}
          effectKey={preset.data.fragment}
          label={preset.data.label || preset.name}
          previewStatic=""
          previewDynamic=""
          onClick={() => handleCustomClick(preset)}
          badge="Custom"
        />
      ))}
    </>
  );
};

// ─── Panel ────────────────────────────────────────────────────────────────────

const PanelTransition = () => {
  return (
    <div className="p-4 h-full">
      <ScrollArea className="h-full">
        <div className={gridClasses}>
          <CombinedTransitions />
        </div>
      </ScrollArea>
    </div>
  );
};

export default PanelTransition;
