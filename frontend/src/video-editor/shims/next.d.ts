// Type declarations for Next.js modules shimmed for the Vite port.
// Runtime implementations live in `./shims/` and are aliased in vite.config.js.

declare module "next/navigation" {
  export function useParams<T extends Record<string, string> = Record<string, string>>(): T;
  export function useRouter(): {
    push: (url: string) => void;
    replace: (url: string) => void;
    back: () => void;
    forward: () => void;
    refresh: () => void;
  };
  export function usePathname(): string;
  export function useSearchParams(): URLSearchParams;
  export function notFound(): never;
  export function redirect(url: string): never;
}

declare module "next/image" {
  import type { ImgHTMLAttributes } from "react";
  export interface NextImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> {
    src: string | { src: string };
    alt: string;
    fill?: boolean;
    priority?: boolean;
  }
  export default function Image(props: NextImageProps): JSX.Element;
}

declare module "next-themes" {
  import type { ReactNode } from "react";
  export interface ThemeProviderProps {
    children?: ReactNode;
    attribute?: string;
    defaultTheme?: string;
    enableSystem?: boolean;
    disableTransitionOnChange?: boolean;
    [key: string]: unknown;
  }
  export function ThemeProvider(props: ThemeProviderProps): JSX.Element;
  export function useTheme(): {
    theme: string;
    setTheme: (theme: string) => void;
    resolvedTheme: string;
    themes: string[];
  };
}

declare module "next/server" {
  export class NextResponse extends Response {
    static json(body: unknown, init?: ResponseInit): Response;
  }
  export class NextRequest extends Request {}
}
