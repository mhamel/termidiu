import type { RendererApi } from '../shared/contracts';

declare global {
  interface Window {
    termidiu: RendererApi;
  }
}

export {};
