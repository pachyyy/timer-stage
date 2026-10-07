/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import path from "node:path";
import { Config } from "@remotion/cli/config";
import { enableTailwind } from "@remotion/tailwind-v4";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// Studio defaults to 3000, which is where the Next app's own dev server lives.
Config.setStudioPort(3100);

/**
 * Scenes import the app's real shadcn primitives (`@/components/ui/*`), pure helpers
 * (`@/lib/timer/*`) and message dictionaries straight from ../src and ../messages, so the docs
 * GIFs restyle themselves whenever the app does. Those files resolve their own dependencies from
 * the root node_modules — React is pinned to this project's copy so the two never mix (a second
 * React breaks every hook-using primitive, e.g. Radix Tabs).
 */
Config.overrideBundlerConfig((config) => {
  const withTailwind = enableTailwind(config);
  const here = process.cwd();
  return {
    ...withTailwind,
    resolve: {
      ...withTailwind.resolve,
      alias: {
        ...(withTailwind.resolve?.alias as Record<string, string> | undefined),
        "@": path.resolve(here, "../src"),
        react: path.resolve(here, "node_modules/react"),
        "react-dom": path.resolve(here, "node_modules/react-dom"),
      },
    },
  };
});
