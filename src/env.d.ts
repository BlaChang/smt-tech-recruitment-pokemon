/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SHEETS_ENDPOINT?: string;
  readonly VITE_SUBMIT_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
