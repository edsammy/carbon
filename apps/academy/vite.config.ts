import { vitePlugin as remix } from "@remix-run/dev";
import { vercelPreset } from "@vercel/remix/vite";
import path from "node:path";
import { flatRoutes } from "remix-flat-routes";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  build: {
    sourcemap: false,
    rollupOptions: {
      onwarn(warning, defaultHandler) {
        if (warning.code === "SOURCEMAP_ERROR") {
          return;
        }

        defaultHandler(warning);
      },
    },
  },
  define: {
    global: "globalThis",
  },
  ssr: {
    noExternal: [
      "@slack/bolt",
      "react-tweet",
      "react-dropzone",
      "react-icons",
      "react-phone-number-input",
      "tailwind-merge",
    ],
  },
  server: {
    port: 4111,
  },
  plugins: [
    remix({
      presets: [vercelPreset()],
      future: {
        unstable_singleFetch: false,
      },
      ignoredRouteFiles: ["**/.*"],
      serverModuleFormat: "esm",
      routes: async (defineRoutes) => {
        return flatRoutes("routes", defineRoutes, {
          // eslint-disable-next-line no-undef
          appDir: path.resolve(__dirname, "app"),
        });
      },
    }),
    tsconfigPaths(),
  ],
  resolve: {
    alias: {
      "@carbon/utils": path.resolve(
        __dirname,
        "../../packages/utils/src/index.ts"
      ),
      "@carbon/form": path.resolve(
        __dirname,
        "../../packages/form/src/index.tsx"
      ),
    },
  },
});
