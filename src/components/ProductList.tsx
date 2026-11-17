import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowUpDown,
  Clock,
  Edit3,
  Package,
  PackagePlus,
  Plus,
  ScanBarcode,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type { Product, ProductSortOption } from '../types/pos';
import { formatPHP } from '../utils/format';
import { filterAndSortProducts, getExpiryStatus } from '../utils/posLogic';
import { ConfirmDialog } from './ConfirmDialog';

interface ProductListProps {
  products: Product[];
  categories: string[];
  onScanToAdd: () => void;
  onScanToRestock: () => void;
  onOpenAddManual: () => void;
  onOpenEdit: (product: Product) => void;
  onOpenStockAdjust: (product: Product, mode?: 'restock' | 'adjust' | 'history') => void;
  onDeleteProduct: (productId: string) => void;
}

export const ProductList: React.FC<ProductListProps> = ({
  products,
  categories,
  onScanToAdd,
  onScanToRestock,
  onOpenAddManual,
  onOpenEdit,
  onOpenStockAdjust,
  onDeleteProduct,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [sortBy, setSortBy] = useState<ProductSortOption>('name');
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  const sortedProducts = filterAndSortProducts(products, {
    search,
    category: selectedCategory,
    sortBy,
  });

  const lowCount = products.filter(
    (p) => p.stock > 0 && p.stock <= p.lowStockThreshold
  ).length;
  const outCount = products.filter((p) => p.stock <= 0).length;

  return (
    <div className="space-y-3 pb-24">
      {/* Top Primary Scan & Add Actions */}
      <div className="rounded-2xl border border-stone-200 bg-white p-3 space-y-2">
        <button
          type="button"
          onClick={onScanToAdd}
          className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-base font-bold text-white shadow-sm hover:bg-emerald-800 active:scale-[0.99]"
        >
          <ScanBarcode className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span>Scan to Add Product</span>
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onScanToRestock}
            className="flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl border border-stone-300 bg-stone-50 px-3 text-xs font-bold text-stone-900 hover:bg-stone-100"
          >
            <PackagePlus className="h-4 w-4 text-emerald-700 shrink-0" aria-hidden="true" />
            <span>Scan to Restock</span>
          </button>
          <button
            type="button"
            onClick={onOpenAddManual}
            className="flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3 text-xs font-bold text-stone-900 hover:bg-stone-50"
          >
            <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Add Without Barcode</span>
          </button>
        </div>
      </div>

      {/* Inventory Summary & Search / Filter / Sort */}
      {products.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-baseline justify-between px-1">
            <h2 className="text-sm font-bold text-stone-900">
              Products ({products.length})
            </h2>
            {(lowCount > 0 || outCount > 0) && (
              <p className="text-xs font-semibold">
                {outCount > 0 && <span className="text-red-700">{outCount} out</span>}
                {outCount > 0 && lowCount > 0 && ' · '}
                {lowCount > 0 && <span className="text-amber-700">{lowCount} low</span>}
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
                aria-hidden="true"
              />
              <label htmlFor="inventory-search" className="sr-only">
                Search products by name or barcode
              </label>
              <input
                id="inventory-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or barcode..."
                className="min-h-[48px] w-full rounded-xl border border-stone-200 bg-white pl-9 pr-9 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-700 focus:outline-none"
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

            <div className="relative flex items-center">
              <ArrowUpDown
                className="pointer-events-none absolute left-3 h-4 w-4 text-stone-500"
                aria-hidden="true"
              />
              <label htmlFor="inventory-sort" className="sr-only">
                Sort products
              </label>
              <select
                id="inventory-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as ProductSortOption)}
                className="min-h-[48px] rounded-xl border border-stone-200 bg-white pl-8 pr-3 text-xs font-bold text-stone-800 focus:border-emerald-700 focus:outline-none"
              >
                <option value="name">Name</option>
                <option value="stock">Stock</option>
                <option value="expiry">Expiry</option>
              </select>
            </div>
          </div>

          <div
            className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-1"
            role="tablist"
            aria-label="Filter inventory by category"
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
                  className={`min-h-[40px] rounded-xl border px-3 text-xs font-bold whitespace-nowrap shrink-0 transition ${
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

      {/* List or Empty State */}
      {products.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white px-5 py-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100 text-stone-500">
            <Package className="h-6 w-6" aria-hidden="true" />
          </div>
          <h3 className="mt-3 text-base font-bold text-stone-900">
            No products yet
          </h3>
          <p className="mt-1 text-sm text-stone-600">
            Tap Scan below or &ldquo;Scan to Add Product&rdquo; above to add your first item.
          </p>
        </div>
      ) : sortedProducts.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white px-5 py-8 text-center">
          <p className="text-sm font-semibold text-stone-700">No matching products</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {sortedProducts.map((product) => {
            const isOut = product.stock <= 0;
            const isLow = !isOut && product.stock <= product.lowStockThreshold;
            const expiry = getExpiryStatus(product.expirationDate);
            const hasPiece = product.piecePrice !== undefined && product.piecePrice > 0;

            return (
              <div
                key={product.id}
                className={`rounded-2xl border p-3.5 transition ${
                  isOut
                    ? 'border-red-300 bg-red-50/50'
                    : isLow
                      ? 'border-amber-300 bg-amber-50/40'
                      : 'border-stone-200 bg-white'
                }`}
              >
                <div className="flex items-start gap-3">
                  {product.photoDataUrl ? (
                    <img
                      src={product.photoDataUrl}
                      alt={product.name}
                      className="h-12 w-12 shrink-0 rounded-xl border border-stone-200 object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-500">
                      <Package className="h-5 w-5" aria-hidden="true" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-bold leading-snug text-stone-900">
                        {product.name}
                      </h3>
                      <div className="text-right shrink-0">
                        <p className="font-mono-num text-sm font-bold text-stone-900">
                          {formatPHP(product.sellingPrice)}
                        </p>
                        {hasPiece && (
                          <p className="font-mono-num text-[11px] font-medium text-stone-600">
                            {formatPHP(product.piecePrice!)} / pc
                          </p>
                        )}
                      </div>
                    </div>

                    <p className="mt-0.5 text-xs text-stone-500 truncate">
                      {product.category} · {product.unit} · Cost{' '}
                      <span className="font-mono-num">{formatPHP(product.costPrice)}</span>
                    </p>
                    {product.barcode && (
                      <p className="mt-0.5 font-mono-num text-[11px] text-stone-400 truncate">
                        {product.barcode}
                      </p>
                    )}

                    {(expiry.status === 'expiring_soon' || expiry.status === 'expired') && (
                      <p
                        className={`mt-1 flex items-center gap-1 text-xs font-bold ${
                          expiry.status === 'expired' ? 'text-red-700' : 'text-amber-700'
                        }`}
                      >
                        <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>
                          {expiry.status === 'expired'
                            ? `Expired (${product.expirationDate})`
                            : `Expiring soon (${expiry.daysLeft}d left)`}
                        </span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2 border-t border-stone-200/70 pt-2.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {(isOut || isLow) && (
                      <AlertTriangle
                        className={`h-4 w-4 shrink-0 ${
                          isOut ? 'text-red-700' : 'text-amber-700'
                        }`}
                        aria-hidden="true"
                      />
                    )}
                    <span
                      className={`text-xs font-bold tabular-nums whitespace-nowrap ${
                        isOut
                          ? 'text-red-700'
                          : isLow
                            ? 'text-amber-800'
                            : 'text-stone-800'
                      }`}
                    >
                      {isOut
                        ? 'Out of stock'
                        : isLow
                          ? `Low: ${product.stock}`
                          : `Stock: ${product.stock}`}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onOpenStockAdjust(product, 'restock')}
                      className="flex min-h-[44px] items-center gap-1 rounded-xl border border-emerald-300 bg-emerald-50 px-2.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
                    >
                      <PackagePlus className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Stock</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenEdit(product)}
                      aria-label={`Edit ${product.name}`}
                      className="flex h-11 w-11 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-700 hover:bg-stone-100"
                    >
                      <Edit3 className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(product)}
                      aria-label={`Delete ${product.name}`}
                      className="flex h-11 w-11 items-center justify-center rounded-xl border border-stone-200 bg-white text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Product"
        message={
          deleteTarget
            ? `Delete "${deleteTarget.name}"? Past sales will remain in your reports.`
            : ''
        }
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          if (deleteTarget) onDeleteProduct(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
