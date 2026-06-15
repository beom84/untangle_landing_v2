import Clarity from "@microsoft/clarity";
import { isTrackingEnabled } from "@/lib/tracking";

const CLARITY_PROJECT_ID = "x7blez7fd9";

let initialized = false;

export function initClarity() {
  if (initialized || !isTrackingEnabled()) return;
  Clarity.init(CLARITY_PROJECT_ID);
  initialized = true;
}
