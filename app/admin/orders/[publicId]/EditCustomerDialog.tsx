"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CustomerFormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address1: string;
  address2: string;
  postalCode: string;
  city: string;
  country: string;
};

type EditCustomerDialogProps = {
  orderId: number;
  initialValues: CustomerFormState;
  triggerIcon: ReactNode;
  triggerAriaLabel: string;
};

export default function EditCustomerDialog({
  orderId,
  initialValues,
  triggerIcon,
  triggerAriaLabel,
}: EditCustomerDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [values, setValues] = useState<CustomerFormState>(initialValues);

  useEffect(() => {
    if (!open) return;
    setValues(initialValues);
    setError("");
  }, [initialValues, open]);

  const canSubmit = useMemo(() => {
    return Boolean(values.email.trim());
  }, [values.email]);

  const handleChange = (
    key: keyof CustomerFormState,
    value: string,
  ) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/customer`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: values.firstName,
          last_name: values.lastName,
          email: values.email,
          phone: values.phone,
          address1: values.address1,
          address2: values.address2,
          postal_code: values.postalCode,
          city: values.city,
          country: values.country,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.error ?? "Unable to update customer.");
        setSubmitting(false);
        return;
      }

      setOpen(false);
      router.refresh();
    } catch {
      setError("Unable to update customer.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={triggerAriaLabel}>
          {triggerIcon}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit customer details</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="customer-first-name">First name</Label>
              <Input
                id="customer-first-name"
                value={values.firstName}
                onChange={(event) =>
                  handleChange("firstName", event.target.value)
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="customer-last-name">Last name</Label>
              <Input
                id="customer-last-name"
                value={values.lastName}
                onChange={(event) =>
                  handleChange("lastName", event.target.value)
                }
              />
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="customer-email">Email</Label>
              <Input
                id="customer-email"
                type="email"
                value={values.email}
                onChange={(event) =>
                  handleChange("email", event.target.value)
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="customer-phone">Phone</Label>
              <Input
                id="customer-phone"
                value={values.phone}
                onChange={(event) =>
                  handleChange("phone", event.target.value)
                }
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="customer-address1">Address line 1</Label>
            <Input
              id="customer-address1"
              value={values.address1}
              onChange={(event) =>
                handleChange("address1", event.target.value)
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="customer-address2">Address line 2</Label>
            <Input
              id="customer-address2"
              value={values.address2}
              onChange={(event) =>
                handleChange("address2", event.target.value)
              }
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="customer-postal">Postal code</Label>
              <Input
                id="customer-postal"
                value={values.postalCode}
                onChange={(event) =>
                  handleChange("postalCode", event.target.value)
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="customer-city">City</Label>
              <Input
                id="customer-city"
                value={values.city}
                onChange={(event) =>
                  handleChange("city", event.target.value)
                }
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="customer-country">Country</Label>
            <Input
              id="customer-country"
              value={values.country}
              onChange={(event) =>
                handleChange("country", event.target.value)
              }
            />
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
          >
            {submitting ? "Saving..." : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
