// Vite shim for `next/navigation` (only what the editor uses).
import { useParams as useRouterParams } from 'react-router-dom';

export function useParams() {
  try {
    return useRouterParams() ?? {};
  } catch {
    return {};
  }
}

export function useRouter() {
  return {
    push: (url) => {
      window.location.href = url;
    },
    replace: (url) => {
      window.location.replace(url);
    },
    back: () => window.history.back(),
    forward: () => window.history.forward(),
    refresh: () => window.location.reload(),
  };
}

export function usePathname() {
  return window.location.pathname;
}

export function useSearchParams() {
  return new URLSearchParams(window.location.search);
}

export function notFound() {
  throw new Error('Not found');
}

export function redirect(url) {
  window.location.href = url;
}
