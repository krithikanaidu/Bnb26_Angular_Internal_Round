"use client";

import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useProjectStore } from "@/stores/project-store";
import { usePanelStore } from "@/stores/panel-store";
import { Button } from "@/components/ui/button";
import { ExportPopover } from "./export-popover";
import { TaskbarPopover } from "./taskbar-popover";
import { ShortcutsModal } from "./shortcuts-modal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "next-themes";
import {
  RiArchiveDrawerLine,
  RiSideBarLine,
  RiArrowLeftLine,
  RiMenuLine,
  RiLayout3Line,
  RiMoonLine,
  RiSunLine,
  RiComputerLine,
  RiKeyboardLine,
  RiDownloadLine,
  RiUploadLine,
  RiAddLine,
} from "@remixicon/react";
import { RiLockLine, RiArrowDownSLine } from "@remixicon/react";
import { core } from "@/lib/project";
import { clearSavedProject, saveProjectNow } from "@/lib/project-persistence";
import { data } from "./data";

export default function Header() {
  const { projectName, resetProject, setProjectName } = useProjectStore();
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [draftName, setDraftName] = useState(projectName);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const { theme, setTheme } = useTheme();

  const {
    showLeftPanel,
    showRightPanel,
    showTimeline,
    toggleLeftPanel,
    toggleRightPanel,
    toggleTimeline,
    resetLayout,
  } = usePanelStore();

  useEffect(() => {
    if (!isEditingName) setDraftName(projectName);
  }, [projectName, isEditingName]);

  useEffect(() => {
    if (isEditingName) nameInputRef.current?.select();
  }, [isEditingName]);

  const commitName = () => {
    setIsEditingName(false);
    const clean = draftName.trim();
    if (clean) setProjectName(clean);
    else setDraftName(projectName);
  };

  const handleNewProject = () => {
    resetProject();
    core.project.new();
    // Don't let the next reload resurrect the discarded project.
    clearSavedProject();
    saveProjectNow();
  };

  const handleExportJSON = () => {
    try {
      const projectData = core.project.export();
      const jsonString = JSON.stringify(projectData, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${projectName || "project"}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export project:", err);
    }
  };

  const handleLoadJSON = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const projectData = JSON.parse(text);

        const name = projectData.name || file.name.replace(/\.json$/i, "");
        setProjectName(name);

        core.project.import(projectData);
      } catch (err) {
        console.error("Failed to load project JSON:", err);
        alert("Invalid project file");
      }
    };
    input.click();
  };

  // Global keydown listener: Export (Ctrl/⌘+E), Shortcuts (?)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "e") {
        e.preventDefault();
        setIsExportOpen(true);
        return;
      }
      if (!isTyping && e.key === "?" && !e.ctrlKey && !e.metaKey) {
        setIsShortcutsOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="ve-header h-12 border-b shrink-0 bg-background/85 backdrop-blur-md relative z-40">
      <div className="h-full grid grid-cols-[1fr_auto_1fr] items-center px-3 gap-2">
        {/* Left: back, menu, view, shortcuts */}
        <div className="flex items-center justify-start gap-0.5 min-w-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
            <Link to="/" title="Back to CreatorAI dashboard">
              <RiArrowLeftLine className="size-4" />
              <span className="sr-only">Back to CreatorAI</span>
            </Link>
          </Button>

          <span className="mx-1 h-4 w-px bg-border" />

          {/* Menu Icon with Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <RiMenuLine className="size-4" />
                <span className="sr-only">Menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 text-xs">
              <DropdownMenuItem className="text-xs" onClick={handleNewProject}>
                <RiAddLine className="mr-2 size-4" />
                <span>New Project</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="text-xs" onClick={handleLoadJSON}>
                <RiUploadLine className="mr-2 size-4" />
                <span>Load from JSON</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="text-xs" onClick={handleExportJSON}>
                <RiDownloadLine className="mr-2 size-4" />
                <span>Export to JSON</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="text-xs">
                  <span className="flex-1">Theme</span>
                  {theme === "dark" ? (
                    <RiMoonLine className="size-4 text-muted-foreground" />
                  ) : theme === "light" ? (
                    <RiSunLine className="size-4 text-muted-foreground" />
                  ) : (
                    <RiComputerLine className="size-4 text-muted-foreground" />
                  )}
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent className="w-36 text-xs">
                    <DropdownMenuItem className="text-xs" onClick={() => setTheme("light")}>
                      <RiSunLine className="mr-2 size-4" />
                      <span className="flex-1">Light</span>
                      {theme === "light" && <span className="text-xs">✓</span>}
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-xs" onClick={() => setTheme("dark")}>
                      <RiMoonLine className="mr-2 size-4" />
                      <span className="flex-1">Dark</span>
                      {theme === "dark" && <span className="text-xs">✓</span>}
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-xs" onClick={() => setTheme("system")}>
                      <RiComputerLine className="mr-2 size-4" />
                      <span className="flex-1">System</span>
                      {theme === "system" && <span className="text-xs">✓</span>}
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* View Menu with Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 text-xs flex items-center gap-1 px-2">
                <RiLayout3Line className="size-4" />
                <span className="hidden sm:inline">View</span>
                <RiArrowDownSLine className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 text-xs">
              <DropdownMenuItem className="text-xs" onClick={toggleLeftPanel}>
                <RiSideBarLine className="mr-2 size-4" />
                <span className="flex-1">Media panel</span>
                {showLeftPanel && <span className="text-xs">✓</span>}
              </DropdownMenuItem>
              <DropdownMenuItem className="text-xs" onClick={toggleRightPanel}>
                <RiSideBarLine className="mr-2 size-4 rotate-180" />
                <span className="flex-1">Properties panel</span>
                {showRightPanel && <span className="text-xs">✓</span>}
              </DropdownMenuItem>
              <DropdownMenuItem className="text-xs" onClick={toggleTimeline}>
                <span className="flex-1 pl-6">Timeline</span>
                {showTimeline && <span className="text-xs">✓</span>}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-xs" onClick={resetLayout}>
                <span className="pl-6">Reset layout</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setIsShortcutsOpen(true)}
            title="Keyboard shortcuts (?)"
          >
            <RiKeyboardLine className="size-4" />
            <span className="sr-only">Keyboard shortcuts</span>
          </Button>
        </div>

        {/* Center: workspace + editable project name */}
        <div className="flex items-center justify-center gap-1.5 text-xs min-w-0">
          <RiLockLine size={13} className="shrink-0 text-muted-foreground" />
          <span className="font-medium text-muted-foreground hidden md:inline">Personal</span>
          <span className="text-muted-foreground/50 hidden md:inline">/</span>
          {isEditingName ? (
            <input
              ref={nameInputRef}
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitName();
                if (e.key === "Escape") {
                  setDraftName(projectName);
                  setIsEditingName(false);
                }
              }}
              className="ve-name-input h-7 w-44 rounded-md border border-primary/50 bg-secondary/60 px-2 text-xs font-semibold text-foreground outline-none"
            />
          ) : (
            <button
              onClick={() => setIsEditingName(true)}
              title="Rename project"
              className="ve-name-btn truncate max-w-44 rounded-md px-2 py-1 text-xs font-semibold text-foreground transition-colors hover:bg-accent"
            >
              {projectName || "Untitled video"}
            </button>
          )}
        </div>

        {/* Right: tasks + export */}
        <div className="flex items-center justify-end gap-2">
          <TaskbarPopover>
            <RiArchiveDrawerLine className="size-4" />
            <span className="sr-only">Tasks</span>
          </TaskbarPopover>

          <ExportPopover open={isExportOpen} onOpenChange={setIsExportOpen}>
            <Button className="ve-export-btn h-8 text-xs font-semibold px-4 rounded-lg flex items-center gap-2 border-0">
              <RiDownloadLine className="size-3.5" />
              <span>Export</span>
              <kbd className="hidden lg:inline rounded bg-white/20 px-1 text-[9px] font-medium">
                ⌘E
              </kbd>
            </Button>
          </ExportPopover>
        </div>
      </div>

      <ShortcutsModal open={isShortcutsOpen} onOpenChange={setIsShortcutsOpen} />
    </div>
  );
}
