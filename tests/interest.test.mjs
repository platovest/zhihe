import assert from "node:assert/strict";
import test from "node:test";
import { OFFER_ID, parseInterestInput } from "../lib/interest.ts";

const valid = {
  email: "Hello@Example.com ",
  offerId: OFFER_ID,
  source: "partner",
  consent: true,
  website: "",
};

test("accepts and normalizes a valid purchase intent", () => {
  const parsed = parseInterestInput(valid);
  assert.equal(parsed?.email, "hello@example.com");
  assert.equal(parsed?.source, "partner");
});

test("rejects invalid email, offer, source, consent and honeypot", () => {
  const cases = [
    { ...valid, email: "not-an-email" },
    { ...valid, offerId: "client-price" },
    { ...valid, source: "private-referrer" },
    { ...valid, consent: false },
    { ...valid, website: "bot.example" },
  ];

  for (const input of cases) assert.equal(parseInterestInput(input), null);
});

test("defaults an omitted source to direct", () => {
  const withoutSource = { ...valid };
  delete withoutSource.source;
  assert.equal(parseInterestInput(withoutSource)?.source, "direct");
});
