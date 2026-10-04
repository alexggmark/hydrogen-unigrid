/// <reference types="vite/client" />
/// <reference types="react-router" />
/// <reference types="@shopify/oxygen-workers-types" />
/// <reference types="@shopify/hydrogen/react-router-types" />

// Enhance TypeScript's built-in typings.
import '@total-typescript/ts-reset';

declare global {
  interface Env {
    // the project token is public by design. without it every visitor gets A
    PUBLIC_POSTHOG_KEY?: string;
    PUBLIC_POSTHOG_HOST?: string;
  }
}
