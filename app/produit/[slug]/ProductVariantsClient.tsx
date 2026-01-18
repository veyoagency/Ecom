"use client";

import { useMemo, useState } from "react";

type ProductVariantOption = {
  name: string;
  values: string[];
};

type ProductVariantsClientProps = {
  options: ProductVariantOption[];
};

function isColorOption(name: string) {
  return /couleur|color/i.test(name);
}

function colorFromValue(value: string) {
  const normalized = value.toLowerCase().trim();
  if (normalized.startsWith("#") || normalized.startsWith("rgb")) {
    return value;
  }
  const colorMap: Record<string, string> = {
    noir: "#111111",
    black: "#111111",
    blanc: "#ffffff",
    white: "#ffffff",
    rouge: "#c0392b",
    red: "#c0392b",
    bleu: "#2f5aa6",
    blue: "#2f5aa6",
    vert: "#1f7a4a",
    green: "#1f7a4a",
    gris: "#9ca3af",
    gray: "#9ca3af",
    grey: "#9ca3af",
    beige: "#d8c3a5",
    marron: "#7b4a2f",
    brown: "#7b4a2f",
    jaune: "#f2c94c",
    yellow: "#f2c94c",
    rose: "#e91e63",
    pink: "#e91e63",
    orange: "#f2994a",
  };
  return colorMap[normalized] ?? "#e5e7eb";
}

function toInputName(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export default function ProductVariantsClient({
  options,
}: ProductVariantsClientProps) {
  const initialSelections = useMemo(() => {
    const entries = options
      .map((option) => [option.name, option.values[0] ?? ""] as const)
      .filter(([, value]) => value);
    return Object.fromEntries(entries) as Record<string, string>;
  }, [options]);

  const [selectedValues, setSelectedValues] = useState<Record<string, string>>(
    initialSelections,
  );

  if (options.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {options.map((option) => {
        const selected = selectedValues[option.name] ?? option.values[0] ?? "";
        return isColorOption(option.name) ? (
          <div key={option.name} className="space-y-2">
            <div className="text-sm text-neutral-700">
              {option.name}{" "}
              <span className="text-neutral-500">{selected}</span>
            </div>
            <div className="flex items-center gap-2">
              {option.values.map((value, index) => (
                <label key={`${option.name}-${value}`} className="cursor-pointer">
                  <input
                    type="radio"
                    name={`variant-${toInputName(option.name)}`}
                    value={value}
                    checked={selected === value}
                    onChange={() =>
                      setSelectedValues((prev) => ({
                        ...prev,
                        [option.name]: value,
                      }))
                    }
                    aria-label={value}
                    className="peer sr-only"
                  />
                  <span
                    className="inline-flex h-7 w-7 items-center justify-center overflow-hidden !rounded-full border border-neutral-200 bg-clip-content p-[2px] peer-checked:border-black peer-checked:ring-1 peer-checked:ring-black"
                    style={{ backgroundColor: colorFromValue(value) }}
                  />
                </label>
              ))}
            </div>
          </div>
        ) : (
          <div key={option.name} className="space-y-2">
            <label className="text-sm text-neutral-700">{option.name}</label>
            <select
              className="h-11 w-full rounded-md border border-neutral-200 px-3 text-sm"
              value={selected}
              onChange={(event) =>
                setSelectedValues((prev) => ({
                  ...prev,
                  [option.name]: event.target.value,
                }))
              }
            >
              {option.values.map((value) => (
                <option key={`${option.name}-${value}`}>{value}</option>
              ))}
            </select>
          </div>
        );
      })}
    </div>
  );
}
