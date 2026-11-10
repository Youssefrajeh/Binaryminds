// Starts Cypress through its module API. VS Code's integrated terminal sets
// ELECTRON_RUN_AS_NODE, which makes the Cypress app start as plain Node and
// fail with "bad option: --smoke-test"; clearing it here avoids that.
//
//   node cypress/launch.mjs run    headless run of every spec
//   node cypress/launch.mjs open   interactive test runner
import cypress from "cypress";

delete process.env.ELECTRON_RUN_AS_NODE;

const mode = process.argv[2] === "open" ? "open" : "run";
const spec = process.argv.slice(3).find((arg) => !arg.startsWith("-"));

if (mode === "open") {
  await cypress.open({ testingType: "e2e" });
} else {
  const result = await cypress.run({ testingType: "e2e", ...(spec ? { spec } : {}) });
  if (result.status === "failed") {
    console.error(result.message);
    process.exit(1);
  }
  process.exit(result.totalFailed > 0 ? 1 : 0);
}
