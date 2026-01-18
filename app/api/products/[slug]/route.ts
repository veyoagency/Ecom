import { NextResponse } from "next/server";

import { Product, ProductImage } from "@/lib/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: { slug: string } },
) {
  const { slug } = context.params;

  const product = await Product.findOne({
    where: { slug, active: true },
    include: [
      {
        model: ProductImage,
        as: "images",
        attributes: ["id", "url", "position"],
        required: false,
      },
    ],
    order: [[{ model: ProductImage, as: "images" }, "position", "ASC"]],
  });
  if (!product) {
    return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });
  }

  return NextResponse.json({ product: product.toJSON() });
}
