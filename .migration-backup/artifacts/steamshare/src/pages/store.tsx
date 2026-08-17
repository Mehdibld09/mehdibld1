import { Layout } from "@/components/layout";
import { useGetMe } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { ShoppingBag, Star, Package, Search, ArrowLeft } from "lucide-react";

// ── API helpers ──
async function fetchProducts() {
  const res = await fetch("/api/store/products", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load products");
  return res.json() as Promise<any[]>;
}

// ── Star rating component ──
function StarRating({ rating, max = 5, size = 14 }: {
  rating: number; max?: number; size?: number;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }, (_, i) => {
        const filled = i < Math.round(rating);
        return (
          <Star
            key={i}
            className={`${filled ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`}
            style={{ width: size, height: size }}
          />
        );
      })}
    </div>
  );
}

// ── Main page ──
export default function Store() {
  const { data: user } = useGetMe();
  const { data: products = [], isLoading } = useQuery({ queryKey: ["store-products"], queryFn: fetchProducts });
  const [search, setSearch] = useState("");
  const [, setLocation] = useLocation();

  const filtered = products.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    p.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <button onClick={() => window.history.back()} className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <ShoppingBag className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Store</h1>
              <p className="text-sm text-muted-foreground">
                {user ? (
                  <span className="flex items-center gap-1">
                    <span className="text-primary font-mono">{user.points} pts</span>
                    <span>available</span>
                  </span>
                ) : (
                  "Login to buy items"
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Products Grid */}
        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground">Loading products...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-card border border-border rounded-xl">
            <Package className="h-10 w-10 mx-auto text-muted-foreground/20 mb-3" />
            <p className="text-muted-foreground">{search ? "No products match your search." : "No products available yet."}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filtered.map((p) => (
              <div
                key={p.id}
                onClick={() => setLocation(`/store/${p.id}`)}
                className="cursor-pointer bg-card border border-border rounded-xl overflow-hidden hover:border-primary/40 transition-all hover:shadow-md group flex flex-col"
              >
                <div className="aspect-[3/4] bg-muted flex items-center justify-center overflow-hidden relative">
                  {p.imageUrl ? (
                    <img
                      src={p.imageUrl}
                      alt={p.title}
                      className={`w-full h-full object-cover transition-all duration-500 ${p.stock <= 0 ? "grayscale opacity-60" : "group-hover:scale-105"}`}
                    />
                  ) : (
                    <Package className="h-10 w-10 text-muted-foreground/30" />
                  )}
                  {p.stock <= 0 && (
                    <div className="absolute bottom-0 inset-x-0 bg-black/50 py-1 text-center">
                      <span className="text-[10px] font-bold text-white/80 uppercase tracking-widest">Out of Stock</span>
                    </div>
                  )}
                </div>
                <div className="p-3 space-y-1.5 flex-1 flex flex-col justify-between">
                  <h3 className="font-semibold text-sm line-clamp-2 leading-snug">{p.title}</h3>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {(p.paymentMode === "both" || p.paymentMode === "points" || !p.paymentMode) && (
                        <span className="text-primary font-bold text-sm font-mono">{p.price} pts</span>
                      )}
                      {p.priceUsd && (p.paymentMode === "both" || p.paymentMode === "usd") && (
                        <span className="text-xs font-semibold text-green-600 bg-green-500/10 border border-green-500/20 rounded px-1.5 py-0.5">${p.priceUsd}</span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {p.stock > 0 ? `${p.stock} in stock` : <span className="text-red-400">Out of stock</span>}
                    </div>
                    <div className="flex items-center gap-1">
                      <StarRating rating={p.avgRating} size={11} />
                      <span className="text-[11px] text-muted-foreground">
                        {p.reviewsCount > 0 ? `(${p.reviewsCount})` : ""}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
