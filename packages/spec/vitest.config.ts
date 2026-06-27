import { defineConfig } from "vitest/config";

export default defineConfig({
  // Inline (empty) postcss config stops Vite from walking up the directory
  // tree and picking up unrelated postcss/tailwind configs outside the repo.
  css: { postcss: {} },
  test: {
    include: ["test/**/*.test.ts"],
  },
});
