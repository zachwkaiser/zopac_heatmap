// Allow importing CSS and common asset file types as modules for TypeScript
declare module '*.css';
declare module '*.scss';
declare module '*.sass';
declare module '*.png';
declare module '*.jpg';
declare module '*.jpeg';
declare module '*.gif';
declare module '*.svg';

// CSS modules
declare module '*.module.css';
declare module '*.module.scss';

// Vite environment variables
interface ImportMetaEnv {
  readonly VITE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
