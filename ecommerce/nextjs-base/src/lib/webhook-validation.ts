import { stripe } from "@/lib/stripe";
import type Stripe from "stripe";

/**
 * Validates the Stripe webhook signature and returns the event.
 * Throws if the signature is invalid or the body is malformed.
 */
export function validateStripeWebhookSignature(
  rawBody: Buffer | string,
  signature: string
): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_SECRET environment variable is not set");
  }

  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}
