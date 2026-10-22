// The font files wrangler bundles as data (wrangler.jsonc's rules).
declare module '*.ttf' { const data: ArrayBuffer; export default data }
