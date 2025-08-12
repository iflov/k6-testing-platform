export type ScenarioId =
  | "smoke"
  | "load"
  | "stress"
  | "spike"
  | "soak"
  | "breakpoint";

export const scenarios = new Map<ScenarioId, string>([
  ["smoke", "k6-scripts/scenarios/smoke-test.js"],
  ["load", "k6-scripts/scenarios/load-test.js"],
  ["stress", "k6-scripts/scenarios/stress-test.js"],
  ["spike", "k6-scripts/scenarios/spike-test.js"],
  ["soak", "k6-scripts/scenarios/soak-test.js"],
  ["breakpoint", "k6-scripts/scenarios/breakpoint-test.js"],
]);
