import { NextResponse } from "next/server";

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/lib/constants";
import { Product, ProductImage } from "@/lib/models";
import { parseInteger } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInteger(searchParams.get("limit"), DEFAULT_PAGE_SIZE, {
    min: 1,
    max: MAX_PAGE_SIZE,
  });
  const offset = parseInteger(searchParams.get("offset"), 0, { min: 0 });

  const products = await Product.findAll({
    where: { active: true },
    include: [
      {
        model: ProductImage,
        as: "images",
        attributes: ["id", "url", "position"],
        required: false,
      },
    ],
    order: [
      ["created_at", "DESC"],
      [{ model: ProductImage, as: "images" }, "position", "ASC"],
    ],
    limit,
    offset,
    distinct: true,
  });

  return NextResponse.json({
    products: products.map((product) => product.toJSON()),
    limit,
    offset,
  });
}
