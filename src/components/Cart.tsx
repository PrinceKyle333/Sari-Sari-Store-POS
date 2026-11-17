import React from 'react';
import { Minus, Plus, ShoppingBasket, Trash2 } from 'lucide-react';
import type { CartItem, SaleUnit } from '../types/pos';
import { formatPHP } from '../utils/format';
import { calculateCartTotal, getCartItemKey } from '../utils/posLogic';

interface CartProps {
  items: CartItem[];
  onUpdateQty: (productId: string, unit: SaleUnit, delta: number) => void;
  onRemoveItem: (productId: string, unit: SaleUnit) => void;
  onClearCart: () => void;
  onCheckout: () => void;
}

export const Cart: React.FC<CartProps> = ({
  items,
  onUpdateQty,
  onRemoveItem,
  onClearCart,
  onCheckout,
}) => {
  const total = calculateCartTotal(items);
  const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="flex h-full flex-col rounded-2xl border border-stone-200 bg-white">
      <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <ShoppingBasket className="h-5 w-5 text-emerald-700" aria-hidden="true" />
          <h2 className="text-base font-bold text-stone-900">
            Current Order {totalCount > 0 ? `(${totalCount})` : ''}
          </h2>
        </div>
        {items.length > 0 && (
          <button
            type="button"
            onClick={onClearCart}
            className="min-h-[40px] rounded-lg px-2.5 text-xs font-semibold text-red-700 hover:bg-red-50"
          >
            Clear
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 text-center">
          <p className="text-sm font-semibold text-stone-700">Cart is empty</p>
          <p className="mt-1 text-xs text-stone-500">
            Scan a barcode or tap any product to add items.
          </p>
        </div>
      ) : (
        <>
          <ul className="flex-1 divide-y divide-stone-100 overflow-y-auto px-4">
            {items.map((item) => {
              const lineTotal = item.unitPrice * item.quantity;
              const unitLabel =
                item.unit === 'piece'
                  ? 'Per piece'
                  : item.unit === 'pack'
                    ? `Pack (${item.stockMultiplier} pcs)`
                    : 'Unit';

              return (
                <li
                  key={getCartItemKey(item.productId, item.unit)}
                  className="py-3 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-stone-900 leading-snug">
                        {item.name}
                      </p>
                      <p className="text-xs text-stone-500 tabular-nums">
                        {unitLabel} · {formatPHP(item.unitPrice)} each
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveItem(item.productId, item.unit)}
                      aria-label={`Remove ${item.name} from cart`}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-stone-400 hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onUpdateQty(item.productId, item.unit, -1)}
                        aria-label={`Decrease quantity of ${item.name}`}
                        className="flex h-11 w-11 items-center justify-center rounded-xl border border-stone-300 bg-stone-50 text-stone-800 hover:bg-stone-100 active:scale-95"
                      >
                        <Minus className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <span className="min-w-[36px] text-center font-mono-num text-base font-bold text-stone-900">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => onUpdateQty(item.productId, item.unit, 1)}
                        aria-label={`Increase quantity of ${item.name}`}
                        className="flex h-11 w-11 items-center justify-center rounded-xl border border-stone-300 bg-stone-50 text-stone-800 hover:bg-stone-100 active:scale-95"
                      >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                    <span className="font-mono-num text-base font-bold text-stone-900">
                      {formatPHP(lineTotal)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="border-t border-stone-200 bg-stone-50/70 p-4 space-y-3 rounded-b-2xl">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold text-stone-600">Total</span>
              <span className="font-mono-num text-2xl font-bold text-stone-900">
                {formatPHP(total)}
              </span>
            </div>
            <button
              type="button"
              onClick={onCheckout}
              className="min-h-[52px] w-full rounded-xl bg-emerald-700 px-4 text-base font-bold text-white shadow-sm hover:bg-emerald-800 active:scale-[0.99] transition"
            >
              Checkout · {formatPHP(total)}
            </button>
          </div>
        </>
      )}
    </div>
  );
};
