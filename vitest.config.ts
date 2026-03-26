import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.ts"],
    alias: {
      obsidian: path.resolve(__dirname, "./src/__mocks__/obsidian.ts"),
    },
  },
});
