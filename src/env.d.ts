/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Optional override for where submissions are posted. Left unset in
   * production, where /api/submit holds the endpoint and token server-side.
   */
  readonly VITE_SUBMIT_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
