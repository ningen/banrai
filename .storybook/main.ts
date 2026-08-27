import type { StorybookConfig } from "@storybook/react-vite";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = fileURLToPath(new URL("../web/", import.meta.url));

const config: StorybookConfig = {
  stories: ["../web/src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-a11y", "@storybook/addon-docs"],
  framework: {
    name: "@storybook/react-vite",
    options: {
      viteConfigPath: "./web/vite.config.ts",
    },
  },
  async viteFinal(config) {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      "@": path.resolve(webRoot, "src"),
    };
    const hasTailwind = (config.plugins ?? []).some(
      (p) => p && typeof p === "object" && "name" in p && String((p as { name?: string }).name).includes("tailwindcss"),
    );
    if (!hasTailwind) {
      config.plugins = [...(config.plugins ?? []), tailwindcss()];
    }
    return config;
  },
};

export default config;
