import { ShippingOption } from "@/lib/models";

export function parseMoneyToCents(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }
  const raw = typeof value === "number" ? value.toString() : String(value);
  const normalized = raw.replace(",", ".");
  const amount = Number.parseFloat(normalized);
  if (!Number.isFinite(amount) || amount < 0) {
    return null;
  }
  return Math.round(amount * 100);
}

export function isWithinOrderTotal(option: ShippingOption, subtotalCents: number) {
  const minCents = parseMoneyToCents(option.min_order_total);
  const maxCents = parseMoneyToCents(option.max_order_total);
  if (minCents !== null && subtotalCents < minCents) {
    return false;
  }
  if (maxCents !== null && subtotalCents > maxCents) {
    return false;
  }
  return true;
}

export async function resolveShippingSelection(params: {
  optionId: number | null;
  subtotalCents: number;
  defaultShippingCents: number;
}) {
  const { optionId, subtotalCents, defaultShippingCents } = params;
  if (!optionId) {
    return { option: null, shippingCents: defaultShippingCents };
  }

  const option = await ShippingOption.findByPk(optionId);
  if (!option) {
    throw new Error("Shipping option not found.");
  }

  const shippingCents = parseMoneyToCents(option.price);
  if (shippingCents === null) {
    throw new Error("Shipping price is invalid.");
  }

  if (!isWithinOrderTotal(option, subtotalCents)) {
    throw new Error("Shipping option not available for this order.");
  }

  return { option, shippingCents };
}
