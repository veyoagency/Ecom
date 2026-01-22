import type { Transaction } from "sequelize";

import { Customer } from "@/lib/models";

type UpsertCustomerInput = {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  address1?: string | null;
  address2?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
};

function normalizeText(value: string | null | undefined) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export async function upsertCustomer(
  input: UpsertCustomerInput,
  options?: { transaction?: Transaction },
) {
  const email = normalizeEmail(input.email);
  const firstName = normalizeText(input.firstName);
  const lastName = normalizeText(input.lastName);
  const phone = normalizeText(input.phone);
  const address1 = normalizeText(input.address1);
  const address2 = normalizeText(input.address2);
  const postalCode = normalizeText(input.postalCode);
  const city = normalizeText(input.city);
  const country = normalizeText(input.country);

  const existing = await Customer.findOne({
    where: { email },
    transaction: options?.transaction,
  });

  if (existing) {
    const updates: Partial<Customer> = {};
    if (firstName) updates.first_name = firstName;
    if (lastName) updates.last_name = lastName;
    if (phone) updates.phone = phone;
    if (address1) updates.address1 = address1;
    if (address2) updates.address2 = address2;
    if (postalCode) updates.postal_code = postalCode;
    if (city) updates.city = city;
    if (country) updates.country = country;
    if (Object.keys(updates).length > 0) {
      await existing.update(updates, { transaction: options?.transaction });
    }
    return existing;
  }

  return Customer.create(
    {
      email,
      first_name: firstName,
      last_name: lastName,
      phone,
      address1,
      address2,
      postal_code: postalCode,
      city,
      country,
    },
    { transaction: options?.transaction },
  );
}
