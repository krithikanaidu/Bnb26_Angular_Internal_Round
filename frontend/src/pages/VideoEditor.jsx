import { Link } from 'react-router-dom';
import '../video-editor/app/globals.css';
import Editor from '../video-editor/components/editor/editor';
import { ThemeProvider } from '../video-editor/shims/next-themes';
import { TooltipProvider } from '../video-editor/components/ui/tooltip';
import { Toaster } from '../video-editor/components/ui/sonner';
import { VideoEditorErrorBoundary } from './VideoEditorErrorBoundary';

/**
 * Full-screen client-side video editor (ported from react-video-editor).
 * Lives under src/video-editor/* and renders standalone (outside the
 * CreatorAI sidebar layout) because it manages its own header/panels.
 */
export default function VideoEditor() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <TooltipProvider>
        <VideoEditorErrorBoundary>
          <div className="ve-root">
            <Editor />
            {/* Floating home pill — bottom-left so it never covers header controls */}
            <Link to="/dashboard" className="ve-home-pill" title="Back to the workspace">
              <span className="ve-home-pill-dot" />
              CreatorAI
            </Link>
          </div>
        </VideoEditorErrorBoundary>
      </TooltipProvider>
      <Toaster />
    </ThemeProvider>
  );
}
