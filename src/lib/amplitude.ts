import * as amplitude from "@amplitude/analytics-browser";
import { LANDING_VARIANT } from "@/lib/experiment";
import { isTrackingEnabled } from "@/lib/tracking";

let initialized = false;

const SEARCH_ENGINE_HOST_FRAGMENTS = [
  "google.",
  "bing.",
  "naver.",
  "duckduckgo.",
];

type SourceContext = {
  traffic_source_bucket: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
  referrer: string;
  referrer_host: string;
  page_url: string;
  page_path: string;
};

function getSafeLocation() {
  if (typeof window === "undefined") return null;
  return window.location;
}

function getSafeReferrer() {
  if (typeof document === "undefined") return "";
  return document.referrer || "";
}

function normalizeParamValue(value: string | null) {
  return value?.trim() || "";
}

function getNormalizedMatchValue(value: string) {
  return value.trim().toLowerCase();
}

function getReferrerHost(referrer: string) {
  if (!referrer) return "";

  try {
    return new URL(referrer).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function isSearchEngineReferrer(host: string) {
  const normalizedHost = host.toLowerCase();
  return SEARCH_ENGINE_HOST_FRAGMENTS.some((fragment) =>
    normalizedHost.includes(fragment),
  );
}

function getTrafficSourceBucket(
  utmSource: string,
  utmMedium: string,
  referrerHost: string,
) {
  const source = getNormalizedMatchValue(utmSource);
  const medium = getNormalizedMatchValue(utmMedium);
  const hasUtm = source !== "" || medium !== "";

  if (source === "instagram" && medium === "social") {
    return "instagram_profile";
  }

  if (source === "threads" && medium === "social") {
    return "threads_post";
  }

  if (source === "instagram" && medium === "paid_social") {
    return "instagram_ads";
  }

  if (medium === "community" || medium === "referral") {
    return "community_referral";
  }

  if (!hasUtm && isSearchEngineReferrer(referrerHost)) {
    return "organic_search";
  }

  if (!hasUtm && !referrerHost) {
    return "direct";
  }

  return "referral_other";
}

function getSourceContext(): SourceContext {
  const location = getSafeLocation();
  const searchParams = location ? new URLSearchParams(location.search) : null;
  const referrer = getSafeReferrer();
  const referrerHost = getReferrerHost(referrer);
  const utmSource = normalizeParamValue(searchParams?.get("utm_source") ?? null);
  const utmMedium = normalizeParamValue(searchParams?.get("utm_medium") ?? null);

  return {
    traffic_source_bucket: getTrafficSourceBucket(
      utmSource,
      utmMedium,
      referrerHost,
    ),
    utm_source: utmSource,
    utm_medium: utmMedium,
    utm_campaign: normalizeParamValue(searchParams?.get("utm_campaign") ?? null),
    utm_content: normalizeParamValue(searchParams?.get("utm_content") ?? null),
    utm_term: normalizeParamValue(searchParams?.get("utm_term") ?? null),
    referrer,
    referrer_host: referrerHost,
    page_url: location?.href || "",
    page_path: location?.pathname || "",
  };
}

function getDefaultEventProps() {
  return {
    landing_variant: LANDING_VARIANT,
    ...getSourceContext(),
  };
}

export function initAmplitude() {
  const apiKey = process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY;
  if (!apiKey || initialized || !isTrackingEnabled()) return;
  amplitude.init(apiKey, { autocapture: false });
  initialized = true;
}

export function track(event: string, props?: Record<string, unknown>) {
  if (!isTrackingEnabled()) return;
  amplitude.track(event, {
    ...getDefaultEventProps(),
    ...props,
  });
}
