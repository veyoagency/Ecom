export const ORDER_STATUSES = [
  "pending_payment",
  "payment_link_sent",
  "paid",
  "fulfilled",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const DEFAULT_PAGE_SIZE = 24;
export const MAX_PAGE_SIZE = 100;

export const DEFAULT_COUNTRY = "FR";
