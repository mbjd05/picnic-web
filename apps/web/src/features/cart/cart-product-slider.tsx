import { Link } from "@tanstack/react-router";

import { formatPrice } from "@/lib/format-price";
import { buildImageUrl } from "@/lib/image-url";
import type { SliderProduct } from "@/lib/types";

import { useCountryCode } from "../../country-context";

export function CartProductSlider({
  title,
  products,
}: {
  title: string;
  products: SliderProduct[];
}) {
  if (products.length === 0) return null;
  return (
    <div>
      <h2 className="text-foreground mb-3 text-lg font-semibold">{title}</h2>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {products.map((product) => (
          <ProductSliderCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}

function ProductSliderCard({ product }: { product: SliderProduct }) {
  const countryCode = useCountryCode();
  return (
    <Link
      to="/product/$id"
      params={{ id: product.id }}
      className="border-card-border bg-card-bg flex w-36 shrink-0 flex-col rounded-lg border p-3 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="relative mb-2 h-24 w-full">
        <img
          src={buildImageUrl(product.imageId, countryCode)}
          alt={product.name}
          loading="lazy"
          className="h-full w-full object-contain"
        />
      </div>
      <p className="text-foreground line-clamp-2 text-xs leading-snug font-medium">
        {product.name}
      </p>
      <p className="mt-0.5 text-xs text-gray-500">{product.unitQuantity}</p>
      <p className="text-foreground mt-auto pt-1 text-sm font-bold">
        {formatPrice(product.displayPrice)}
      </p>
    </Link>
  );
}
