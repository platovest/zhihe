export const OFFER_ID = "overseas-launch-v2";
export const CONSENT_VERSION = "2026-09-13";

const allowedSources = new Set(["direct", "organic", "partner", "research"]);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type InterestInput = {
  email: string;
  offerId: typeof OFFER_ID;
  source: "direct" | "organic" | "partner" | "research";
  consent: true;
  website: "";
};

export function parseInterestInput(value: unknown): InterestInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const input = value as Record<string, unknown>;
  const email =
    typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const source = typeof input.source === "string" ? input.source : "direct";

  if (
    email.length > 254 ||
    !emailPattern.test(email) ||
    input.offerId !== OFFER_ID ||
    input.consent !== true ||
    !allowedSources.has(source) ||
    (input.website ?? "") !== ""
  ) {
    return null;
  }

  return {
    email,
    offerId: OFFER_ID,
    source: source as InterestInput["source"],
    consent: true,
    website: "",
  };
}
