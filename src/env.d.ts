/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SHEETS_ENDPOINT?: string;
  readonly VITE_SUBMIT_TOKEN?: string;
  readonly VITE_GL2_CALCULATOR_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
