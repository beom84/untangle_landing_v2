import Clarity from "@microsoft/clarity";

const CLARITY_PROJECT_ID = "x7blez7fd9";

let initialized = false;

export function initClarity() {
  if (initialized || typeof window === "undefined") return;
  Clarity.init(CLARITY_PROJECT_ID);
  initialized = true;
}
