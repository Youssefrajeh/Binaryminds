import { defineConfig } from "cypress";

// End-to-end tests run against the Vite dev server (`npm run dev:web`).
// Every /api request is stubbed in the specs, so no database, email
// provider or API server is needed.
export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:5173",
    specPattern: "cypress/e2e/**/*.cy.ts",
    supportFile: "cypress/support/e2e.ts",
    viewportWidth: 1280,
    viewportHeight: 800,
    video: false,
    // Retry once in CI runs to absorb a slow first page load; never locally
    retries: { runMode: 1, openMode: 0 },
  },
});
