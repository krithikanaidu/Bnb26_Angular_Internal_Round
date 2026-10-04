import { Component } from 'react';
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  failed: boolean;
}

/** Catches render crashes inside the heavy editor canvas/engine tree. */
export class VideoEditorErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    // eslint-disable-next-line no-console
    console.error('Video editor crashed:', error);
  }

  render() {
    if (this.state.failed) {
      return (
        <div
          style={{
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            alignItems: 'center',
            justifyContent: 'center',
            background: '#09090b',
            color: '#e4e4e7',
            padding: 24,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 700 }}>Video Editor crashed</div>
          <div style={{ fontSize: 13, color: '#9aa7bd', maxWidth: 420 }}>
            Something went wrong while rendering the canvas. Your project JSON is safe — export it
            from the menu before reloading if needed.
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: '#7c5cff',
              border: 0,
              color: '#fff',
              padding: '9px 18px',
              borderRadius: 10,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Reload editor
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
