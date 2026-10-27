import { defineConfig } from "vite";

export default defineConfig({
  server: {
    // Allow importing the Ignition deployment addresses from the parent project
    fs: { allow: [".."] },
  },
});
