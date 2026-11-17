import React, { useEffect, useState } from 'react';
import { History, MinusCircle, PackagePlus, X } from 'lucide-react';
import type { Product, StockMovement } from '../types/pos';
import { formatPHP, formatShortDateTime } from '../utils/format';

type StockAdjustTab = 'restock' | 'adjust' | 'history';

interface StockAdjustProps {
  open: boolean;
  initialMode?: StockAdjustTab;
  product: Product | null;
  movements: StockMovement[];
  onRestock: (productId: string, addQty: number, newCostPrice?: number, note?: string) => void;
  onAdjust: (productId: string, deltaQty: number, reason: string) => void;
  onClose: () => void;
}

const ADJUST_REASONS = ['Damaged', 'Expired', 'Missing / Lost', 'Count Correction'];

export const StockAdjust: React.FC<StockAdjustProps> = ({
  open,
  initialMode = 'restock',
  product,
  movements,
  onRestock,
  onAdjust,
  onClose,
}) => {
  const [tab, setTab] = useState<StockAdjustTab>(initialMode);
  const [restockQty, setRestockQty] = useState('10');
  const [newCost, setNewCost] = useState('');
  const [restockNote, setRestockNote] = useState('');

  const [adjustDirection, setAdjustDirection] = useState<'remove' | 'add'>('remove');
  const [adjustQty, setAdjustQty] = useState('1');
  const [adjustReason, setAdjustReason] = useState('Damaged');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !product) return;
    setTab(initialMode);
    setRestockQty('10');
    setNewCost('');
    setRestockNote('');
    setAdjustDirection('remove');
    setAdjustQty('1');
    setAdjustReason('Damaged');
    setError(null);
  }, [open, product, initialMode]);

  if (!open || !product) return null;

  const productMovements = movements
    .filter((m) => m.productId === product.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const handleRestockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const qty = parseInt(restockQty, 10);
    if (!Number.isFinite(qty) || qty <= 0) {
      setError('Enter quantity received (greater than 0).');
      return;
    }
    const costVal = newCost.trim() !== '' ? parseFloat(newCost) : undefined;
    if (costVal !== undefined && (!Number.isFinite(costVal) || costVal < 0)) {
      setError('Cost price must be 0 or higher.');
      return;
    }
    onRestock(product.id, qty, costVal, restockNote);
    onClose();
  };

  const handleAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const qty = parseInt(adjustQty, 10);
    if (!Number.isFinite(qty) || qty <= 0) {
      setError('Enter adjustment quantity greater than 0.');
      return;
    }
    const delta = adjustDirection === 'remove' ? -qty : qty;
    onAdjust(product.id, delta, adjustReason);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-label={`Manage stock for ${product.name}`}
    >
      <div className="w-full max-w-[420px] rounded-t-3xl bg-white p-4 shadow-xl max-h-[90vh] overflow-y-auto pb-safe">
        <div className="flex items-start justify-between gap-3 border-b border-stone-100 pb-3">
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold text-stone-900">
              {product.name}
            </h2>
            <p className="text-xs text-stone-600 tabular-nums">
              Current stock: <strong>{product.stock}</strong> · Cost:{' '}
              <span className="font-mono-num">{formatPHP(product.costPrice)}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close stock management"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-stone-500 hover:bg-stone-100"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="mt-3 grid grid-cols-3 gap-1.5 rounded-xl bg-stone-100 p-1">
          <button
            type="button"
            onClick={() => {
              setTab('restock');
              setError(null);
            }}
            className={`flex min-h-[44px] items-center justify-center gap-1 rounded-lg text-xs font-bold transition ${
              tab === 'restock' ? 'bg-white text-emerald-800 shadow-sm' : 'text-stone-600'
            }`}
          >
            <PackagePlus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Add Stock</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('adjust');
              setError(null);
            }}
            className={`flex min-h-[44px] items-center justify-center gap-1 rounded-lg text-xs font-bold transition ${
              tab === 'adjust' ? 'bg-white text-amber-800 shadow-sm' : 'text-stone-600'
            }`}
          >
            <MinusCircle className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Adjust</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('history');
              setError(null);
            }}
            className={`flex min-h-[44px] items-center justify-center gap-1 rounded-lg text-xs font-bold transition ${
              tab === 'history' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600'
            }`}
          >
            <History className="h-3.5 w-3.5" aria-hidden="true" />
            <span>History</span>
          </button>
        </div>

        {tab === 'restock' && (
          <form onSubmit={handleRestockSubmit} className="mt-4 space-y-3.5">
            <div>
              <label
                htmlFor="restock-qty"
                className="block text-sm font-semibold text-stone-700"
              >
                Quantity Received
              </label>
              <input
                id="restock-qty"
                type="number"
                inputMode="numeric"
                min="1"
                required
                value={restockQty}
                onChange={(e) => setRestockQty(e.target.value)}
                className="mt-1 min-h-[52px] w-full rounded-xl border border-stone-300 px-3.5 font-mono-num text-2xl font-bold text-stone-900 focus:border-emerald-700 focus:outline-none"
              />
              <div className="mt-2 grid grid-cols-4 gap-2">
                {[5, 10, 20, 50].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setRestockQty(String(preset))}
                    className="min-h-[44px] rounded-xl border border-stone-300 bg-stone-50 font-mono-num text-sm font-bold text-stone-800 hover:bg-stone-100"
                  >
                    +{preset}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label
                htmlFor="restock-new-cost"
                className="block text-xs font-semibold text-stone-600"
              >
                New Cost Price (Optional ₱ · current {formatPHP(product.costPrice)})
              </label>
              <input
                id="restock-new-cost"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={newCost}
                onChange={(e) => setNewCost(e.target.value)}
                placeholder={String(product.costPrice)}
                className="mt-1 min-h-[48px] w-full rounded-xl border border-stone-300 px-3.5 font-mono-num text-base text-stone-900 focus:border-emerald-700 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="restock-note"
                className="block text-xs font-semibold text-stone-600"
              >
                Note (Optional)
              </label>
              <input
                id="restock-note"
                type="text"
                value={restockNote}
                onChange={(e) => setRestockNote(e.target.value)}
                placeholder="e.g. Delivery from supplier"
                className="mt-1 min-h-[48px] w-full rounded-xl border border-stone-300 px-3.5 text-sm text-stone-900 focus:border-emerald-700 focus:outline-none"
              />
            </div>

            {error && (
              <p role="alert" className="text-xs font-semibold text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="min-h-[52px] w-full rounded-xl bg-emerald-700 text-base font-bold text-white hover:bg-emerald-800"
            >
              Add Stock
            </button>
          </form>
        )}

        {tab === 'adjust' && (
          <form onSubmit={handleAdjustSubmit} className="mt-4 space-y-3.5">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAdjustDirection('remove')}
                className={`min-h-[48px] rounded-xl border text-sm font-bold ${
                  adjustDirection === 'remove'
                    ? 'border-red-600 bg-red-50 text-red-800'
                    : 'border-stone-200 bg-white text-stone-700'
                }`}
              >
                Remove Stock (-)
              </button>
              <button
                type="button"
                onClick={() => setAdjustDirection('add')}
                className={`min-h-[48px] rounded-xl border text-sm font-bold ${
                  adjustDirection === 'add'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                    : 'border-stone-200 bg-white text-stone-700'
                }`}
              >
                Add Correction (+)
              </button>
            </div>

            <div>
              <label
                htmlFor="adjust-qty"
                className="block text-sm font-semibold text-stone-700"
              >
                Quantity
              </label>
              <input
                id="adjust-qty"
                type="number"
                inputMode="numeric"
                min="1"
                required
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)}
                className="mt-1 min-h-[52px] w-full rounded-xl border border-stone-300 px-3.5 font-mono-num text-2xl font-bold text-stone-900 focus:border-emerald-700 focus:outline-none"
              />
            </div>

            <div>
              <span className="block text-sm font-semibold text-stone-700">
                Reason
              </span>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                {ADJUST_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setAdjustReason(r)}
                    className={`min-h-[44px] rounded-xl border px-2 text-xs font-bold transition ${
                      adjustReason === r
                        ? 'border-amber-700 bg-amber-50 text-amber-900'
                        : 'border-stone-200 bg-white text-stone-700'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p role="alert" className="text-xs font-semibold text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="min-h-[52px] w-full rounded-xl bg-amber-700 text-base font-bold text-white hover:bg-amber-800"
            >
              Save Adjustment
            </button>
          </form>
        )}

        {tab === 'history' && (
          <div className="mt-4">
            {productMovements.length === 0 ? (
              <p className="py-8 text-center text-sm text-stone-500">
                No stock movements recorded for this product yet.
              </p>
            ) : (
              <ul className="divide-y divide-stone-100">
                {productMovements.map((mov) => (
                  <li
                    key={mov.id}
                    className="flex items-start justify-between gap-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold capitalize text-stone-900">
                        {mov.type}
                        {mov.reason ? ` · ${mov.reason}` : ''}
                      </p>
                      <p className="text-xs text-stone-500">
                        {formatShortDateTime(mov.createdAt)} · {mov.previousStock} →{' '}
                        {mov.newStock}
                      </p>
                    </div>
                    <span
                      className={`font-mono-num text-sm font-bold shrink-0 ${
                        mov.quantityChange >= 0 ? 'text-emerald-700' : 'text-red-700'
                      }`}
                    >
                      {mov.quantityChange > 0
                        ? `+${mov.quantityChange}`
                        : mov.quantityChange}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
