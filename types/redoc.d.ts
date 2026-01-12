import type { DetailedHTMLProps, HTMLAttributes } from "react";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      redoc: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
        "spec-url"?: string;
      };
    }
  }
}

export {};
