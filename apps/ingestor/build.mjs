// Gera dist/index.js e dist/simulator.js. O pacote compartilhado é embutido;
// as dependências de terceiros continuam em node_modules.
import { build } from "esbuild";

await build({
  entryPoints: ["src/index.ts", "src/simulator.ts"],
  outdir: "dist",
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  sourcemap: true,
  external: ["mqtt", "@supabase/supabase-js", "zod"],
  logLevel: "info",
});
