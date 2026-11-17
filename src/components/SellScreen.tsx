import React, { useState } from 'react';
import {
  AlertTriangle,
  Keyboard,
  Package,
  Plus,
  Search,
  ShoppingBasket,
  Sparkles,
  X,
} from 'lucide-react';
import type { CartItem, Product, SaleUnit } from '../types/pos';
import { formatPHP } from '../utils/format';
import {
  calculateCartTotal,
  filterAndSortProducts,
  getProductStockInCart,
} from '../utils/posLogic';

interface SellScreenProps {
  products: Product[];
  categories: string[];
  cart: CartItem[];
  continuousScan: boolean;
  onToggleContinuousScan: (next: boolean) => void;
  onManualBarcodeSubmit: (barcode: string) => void;
  unmatchedBarcode: string | null;
  onDismissUnmatched: () => void;
  onAddProductWithBarcode: (barcode: string) => void;
  onAddToCart: (product: Product, unit?: SaleUnit) => void;
  onOpenCart: () => void;
  onOpenAddProduct: () => void;
  onLoadSampleData: () => void;
}

export const SellScreen: React.FC<SellScreenProps> = ({
  products,
  categories,
  cart,
  continuousScan,
  onToggleContinuousScan,
  onManualBarcodeSubmit,
  unmatchedBarcode,
  onDismissUnmatched,
  onAddProductWithBarcode,
  onAddToCart,
  onOpenCart,
  onOpenAddProduct,
  onLoadSampleData,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [showManualBarcode, setShowManualBarcode] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [unitPromptProduct, setUnitPromptProduct] = useState<Product | null>(null);

  const filtered = filterAndSortProducts(products, {
    search,
    category: selectedCategory,
    sortBy: 'name',
  });

  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = calculateCartTotal(cart);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = manualCode.trim();
    if (!cleaned) return;
    onManualBarcodeSubmit(cleaned);
    setManualCode('');
  };

  const handleProductTap = (product: Product) => {
    const hasPiece = product.piecePrice !== undefined && product.piecePrice > 0;
    if (hasPiece) {
      setUnitPromptProduct(product);
    } else {
      onAddToCart(product, 'unit');
    }
  };

  return (
    <div className="space-y-3 pb-24">
      {/* Cart Quick Bar (one-hand friendly summary when cart has items) */}
      {cartItemCount > 0 && (
        <button
          type="button"
          onClick={onOpenCart}
          className="flex min-h-[54px] w-full items-center justify-between rounded-2xl bg-stone-900 px-4 text-white shadow-sm hover:bg-stone-800 active:scale-[0.99]"
        >
          <div className="flex items-center gap-2.5">
            <ShoppingBasket className="h-5 w-5 text-emerald-400 shrink-0" aria-hidden="true" />
            <span className="text-sm font-bold">
              View Cart ({cartItemCount} {cartItemCount === 1 ? 'item' : 'items'})
            </span>
          </div>
          <span className="font-mono-num text-lg font-bold text-emerald-300">
            {formatPHP(cartTotal)}
          </span>
        </button>
      )}

      {/* Continuous Scan & Manual Code Fallback Bar */}
      <div className="rounded-2xl border border-stone-200 bg-white p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <label className="flex min-h-[40px] cursor-pointer items-center gap-2 text-sm font-semibold text-stone-800">
            <input
              type="checkbox"
              checked={continuousScan}
              onChange={(e) => onToggleContinuousScan(e.target.checked)}
              className="h-5 w-5 rounded border-stone-300 accent-emerald-700"
            />
            <span>Continuous scan</span>
          </label>

          <button
            type="button"
            onClick={() => setShowManualBarcode((v) => !v)}
            aria-expanded={showManualBarcode}
            className={`flex min-h-[40px] items-center gap-1.5 rounded-xl border px-3 text-xs font-bold transition ${
              showManualBarcode
                ? 'border-stone-900 bg-stone-900 text-white'
                : 'border-stone-300 bg-stone-50 text-stone-800'
            }`}
          >
            <Keyboard className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Type barcode</span>
          </button>
        </div>

        {showManualBarcode && (
          <form onSubmit={handleManualSubmit} className="flex gap-2 pt-1">
            <label htmlFor="sell-manual-barcode" className="sr-only">
              Type barcode manually
            </label>
            <input
              id="sell-manual-barcode"
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Enter barcode number..."
              className="min-h-[48px] flex-1 rounded-xl border border-stone-300 px-3 font-mono-num text-base text-stone-900 placeholder:text-stone-400 focus:border-emerald-700 focus:outline-none"
            />
            <button
              type="submit"
              className="min-h-[48px] rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-800 shrink-0"
            >
              Add
            </button>
          </form>
        )}
      </div>

      {/* Unmatched Barcode Prompt */}
      {unmatchedBarcode && (
        <div
          role="alert"
          className="rounded-2xl border border-amber-300 bg-amber-50 p-3.5 space-y-2.5"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
            <div>
              <p className="text-sm font-bold text-stone-900">
                Product not found. Add it now?
              </p>
              <p className="text-xs text-stone-700">
                Barcode: <span className="font-mono-num font-semibold">{unmatchedBarcode}</span>
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onDismissUnmatched}
              className="min-h-[44px] rounded-xl border border-stone-300 bg-white text-sm font-semibold text-stone-700"
            >
              Dismiss
            </button>
            <button
              type="button"
              onClick={() => onAddProductWithBarcode(unmatchedBarcode)}
              className="min-h-[44px] rounded-xl bg-emerald-700 text-sm font-bold text-white"
            >
              Add Product
            </button>
          </div>
        </div>
      )}

      {/* Search & Category Chips */}
      {products.length > 0 && (
        <div className="space-y-2">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
              aria-hidden="true"
            />
            <label htmlFor="sell-search" className="sr-only">
              Search products by name or barcode
            </label>
            <input
              id="sell-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or barcode..."
              className="min-h-[48px] w-full rounded-xl border border-stone-200 bg-white pl-9 pr-9 text-base text-stone-900 placeholder:text-stone-400 focus:border-emerald-700 focus:outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-stone-500"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>

          <div
            className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-1"
            role="tablist"
            aria-label="Filter by category"
          >
            {['All', ...categories].map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSelectedCategory(cat)}
                  className={`min-h-[44px] rounded-xl border px-3 text-xs font-bold whitespace-nowrap shrink-0 transition ${
                    active
                      ? 'border-emerald-700 bg-emerald-700 text-white'
                      : 'border-stone-200 bg-white text-stone-700'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State or Tap-to-Add Product Grid */}
      {products.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white px-5 py-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100 text-stone-500">
            <Package className="h-6 w-6" aria-hidden="true" />
          </div>
          <h2 className="mt-3 text-base font-bold text-stone-900">
            No products yet
          </h2>
          <p className="mt-1 text-sm text-stone-600">
            Tap Scan below to add your first product, or load sample items to try it out.
          </p>
          <div className="mt-5 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={onOpenAddProduct}
              className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-bold text-white"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>Add Product Manually</span>
            </button>
            <button
              type="button"
              onClick={onLoadSampleData}
              className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-5 text-sm font-bold text-stone-800"
            >
              <Sparkles className="h-4 w-4 text-amber-600" aria-hidden="true" />
              <span>Load Sample Data (~20 Items)</span>
            </button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white px-5 py-8 text-center">
          <p className="text-sm font-semibold text-stone-800">No matching products</p>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setSelectedCategory('All');
            }}
            className="mt-3 min-h-[44px] rounded-xl border border-stone-300 px-4 text-xs font-bold text-stone-800"
          >
            Reset filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {filtered.map((product) => {
            const usedInCart = getProductStockInCart(cart, product.id);
            const remainingStock = Math.max(0, product.stock - usedInCart);
            const isOut = remainingStock <= 0;
            const isLow = !isOut && remainingStock <= product.lowStockThreshold;
            const hasPiece =
              product.piecePrice !== undefined && product.piecePrice > 0;

            return (
              <button
                key={product.id}
                type="button"
                disabled={isOut}
                onClick={() => handleProductTap(product)}
                aria-label={`Add ${product.name}, ${
                  hasPiece
                    ? `${formatPHP(product.piecePrice!)} per piece`
                    : formatPHP(product.sellingPrice)
                }, ${remainingStock} left`}
                className={`flex min-h-[126px] flex-col justify-between rounded-2xl border p-3 text-left transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 ${
                  isOut
                    ? 'border-red-200 bg-red-50/40'
                    : isLow
                      ? 'border-amber-300 bg-amber-50/30'
                      : 'border-stone-200 bg-white hover:border-emerald-600'
                }`}
              >
                <div className="flex w-full items-start gap-2">
                  {product.photoDataUrl ? (
                    <img
                      src={product.photoDataUrl}
                      alt={product.name}
                      className="h-10 w-10 shrink-0 rounded-lg border border-stone-200 object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-xs font-bold text-stone-600">
                      {product.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold leading-snug text-stone-900 line-clamp-2">
                      {product.name}
                    </p>
                  </div>
                </div>

                <div className="mt-2.5 flex w-full items-end justify-between gap-1">
                  <div>
                    <p className="font-mono-num text-base font-bold text-emerald-800 leading-tight">
                      {hasPiece
                        ? formatPHP(product.piecePrice!)
                        : formatPHP(product.sellingPrice)}
                    </p>
                    {hasPiece && (
                      <p className="text-[11px] font-medium text-stone-500">
                        pc · {formatPHP(product.sellingPrice)} {product.unit}
                      </p>
                    )}
                  </div>
                  <span
                    className={`text-xs font-bold tabular-nums shrink-0 ${
                      isOut
                        ? 'text-red-700'
                        : isLow
                          ? 'text-amber-700'
                          : 'text-stone-500'
                    }`}
                  >
                    {isOut ? 'Out' : `${remainingStock} left`}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* "Per piece or per pack?" Prompt Modal */}
      {unitPromptProduct && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
          role="dialog"
          aria-modal="true"
          aria-label="Choose piece or pack"
        >
          <div className="w-full max-w-[420px] rounded-t-3xl bg-white p-5 shadow-xl pb-safe">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-stone-900">
                  Per piece or per {unitPromptProduct.unit}?
                </h3>
                <p className="text-sm text-stone-600">{unitPromptProduct.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setUnitPromptProduct(null)}
                aria-label="Cancel selection"
                className="flex h-11 w-11 items-center justify-center rounded-xl text-stone-500"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  onAddToCart(unitPromptProduct, 'piece');
                  setUnitPromptProduct(null);
                }}
                className="flex min-h-[76px] flex-col items-center justify-center rounded-2xl border border-stone-300 bg-stone-50 p-3 hover:border-emerald-600 hover:bg-emerald-50"
              >
                <span className="text-xs font-bold text-stone-600">Per Piece</span>
                <span className="mt-1 font-mono-num text-xl font-bold text-stone-900">
                  {formatPHP(unitPromptProduct.piecePrice ?? unitPromptProduct.sellingPrice)}
                </span>
              </button>

              {(() => {
                const ppp =
                  unitPromptProduct.piecesPerPack && unitPromptProduct.piecesPerPack > 0
                    ? unitPromptProduct.piecesPerPack
                    : 10;
                const used = getProductStockInCart(cart, unitPromptProduct.id);
                const avail = unitPromptProduct.stock - used;
                const canPack = avail >= ppp;

                return (
                  <button
                    type="button"
                    disabled={!canPack}
                    onClick={() => {
                      onAddToCart(unitPromptProduct, 'pack');
                      setUnitPromptProduct(null);
                    }}
                    className="flex min-h-[76px] flex-col items-center justify-center rounded-2xl border border-emerald-300 bg-emerald-50 p-3 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <span className="text-xs font-bold text-emerald-800">
                      Per {unitPromptProduct.unit} ({ppp} pcs)
                    </span>
                    <span className="mt-1 font-mono-num text-xl font-bold text-emerald-900">
                      {formatPHP(unitPromptProduct.sellingPrice)}
                    </span>
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
