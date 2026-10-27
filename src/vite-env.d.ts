/// <reference types="vite/client" />

interface GrupoFestaBridge {
  versao: string;
  plataforma: string;
}

declare global {
  interface Window {
    grupoFesta?: GrupoFestaBridge;
  }
}

export {};
