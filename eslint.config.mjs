import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  // eslint-plugin-react still auto-detects via context.getFilename(),
  // which ESLint 10 removed. Pinning the version skips that path.
  { settings: { react: { version: "19.2.8" } } },
];

export default config;
