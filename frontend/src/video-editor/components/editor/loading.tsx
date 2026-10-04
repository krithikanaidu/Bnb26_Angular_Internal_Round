import { useEffect, useState } from "react";

const TIPS = [
  "Drag media straight onto the canvas or timeline",
  "Press Space to play / pause anywhere",
  "Press ? anytime to see all shortcuts",
  "Right-click the canvas for quick actions",
  "Ctrl / ⌘ + E opens export instantly",
];

export const Loading = () => {
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTipIndex((i) => (i + 1) % TIPS.length), 2600);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="ve-loading h-screen w-screen bg-background flex items-center justify-center flex-col gap-6 select-none">
      {/* Brand mark */}
      <div className="flex items-center gap-3">
        <div className="ve-loading-mark">
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="flex flex-col">
          <span className="text-base font-bold tracking-tight text-foreground">
            CreatorAI Studio
          </span>
          <span className="text-[11px] text-muted-foreground">Video editor</span>
        </div>
      </div>

      {/* Progress shimmer */}
      <div className="ve-loading-bar">
        <div className="ve-loading-bar-fill" />
      </div>

      {/* Rotating tip */}
      <div className="text-xs text-muted-foreground h-4 transition-opacity" key={tipIndex}>
        {TIPS[tipIndex]}
      </div>
    </div>
  );
};
