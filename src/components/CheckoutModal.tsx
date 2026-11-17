import React, { useEffect, useState } from 'react';
import { Banknote, CheckCircle2, Receipt, UserCheck, X } from 'lucide-react';
import type { CartItem, PaymentMethod, Sale } from '../types/pos';
import { formatPHP, formatShortDateTime } from '../utils/format';
import { calculateCartTotal, calculateChange } from '../utils/posLogic';

interface CheckoutModalProps {
  open: boolean;
  storeName: string;
  cart: CartItem[];
  existingCustomers: string[];
  completedSale: Sale | null;
  onConfirmSale: (options: {
    paymentMethod: PaymentMethod;
    cashReceived?: number;
    customerName?: string;
  }) => void;
  onClose: () => void;
}

const QUICK_CASH_AMOUNTS = [20, 50, 100, 200, 500, 1000];

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  open,
  storeName,
  cart,
  existingCustomers,
  completedSale,
  onConfirmSale,
  onClose,
}) => {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [cashInput, setCashInput] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const total = calculateCartTotal(cart);

  useEffect(() => {
    if (open && !completedSale) {
      setPaymentMethod('cash');
      setCashInput('');
      setCustomerName('');
      setError(null);
    }
  }, [open, completedSale]);

  if (!open) return null;

  // Receipt Summary Screen after completing checkout
  if (completedSale) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Sale Receipt"
      >
        <div className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
            </div>
            <h2 className="mt-2.5 text-lg font-bold text-stone-900">Sale Saved</h2>
            <p className="text-xs text-stone-500">
              {storeName} · {completedSale.receiptNumber} ·{' '}
              {formatShortDateTime(completedSale.createdAt)}
            </p>
          </div>

          <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 p-4 space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-stone-600">
              <Receipt className="h-4 w-4" aria-hidden="true" />
              <span>Items Sold</span>
            </div>
            <ul className="divide-y divide-stone-200 text-sm">
              {completedSale.items.map((item, idx) => (
                <li
                  key={`${item.productId}-${item.unit}-${idx}`}
                  className="flex items-baseline justify-between gap-2 py-1.5"
                >
                  <span className="text-stone-800">
                    {item.quantity}x {item.name}
                    {item.unit !== 'unit' ? ` (${item.unit})` : ''}
                  </span>
                  <span className="font-mono-num font-semibold text-stone-900 shrink-0">
                    {formatPHP(item.subtotal)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="border-t border-stone-300 pt-2.5 space-y-1">
              <div className="flex items-baseline justify-between text-base font-bold text-stone-900">
                <span>Total</span>
                <span className="font-mono-num text-xl">{formatPHP(completedSale.total)}</span>
              </div>

              {completedSale.paymentMethod === 'cash' ? (
                <>
                  <div className="flex items-baseline justify-between text-sm text-stone-600">
                    <span>Cash Received</span>
                    <span className="font-mono-num font-semibold">
                      {formatPHP(completedSale.cashReceived ?? 0)}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between text-base font-bold text-emerald-700">
                    <span>Change</span>
                    <span className="font-mono-num text-xl">
                      {formatPHP(completedSale.change ?? 0)}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex items-baseline justify-between text-sm font-semibold text-amber-800">
                  <span>Charged to Credit</span>
                  <span>{completedSale.customerName}</span>
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="mt-5 min-h-[52px] w-full rounded-xl bg-emerald-700 px-4 text-base font-bold text-white hover:bg-emerald-800"
          >
            New Sale
          </button>
        </div>
      </div>
    );
  }

  const parsedCash = parseFloat(cashInput);
  const cashVal = Number.isFinite(parsedCash) ? parsedCash : 0;
  const change = calculateChange(total, cashVal);
  const cashReady = cashVal >= total;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (paymentMethod === 'cash') {
      if (!cashReady) {
        setError('Please enter cash received equal to or greater than the total.');
        return;
      }
      onConfirmSale({ paymentMethod: 'cash', cashReceived: cashVal });
    } else {
      const name = customerName.trim();
      if (!name) {
        setError('Please select or enter a customer name.');
        return;
      }
      onConfirmSale({ paymentMethod: 'credit', customerName: name });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-label="Checkout"
    >
      <div className="w-full max-w-[420px] rounded-t-3xl bg-white p-5 shadow-xl max-h-[92vh] overflow-y-auto pb-safe">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <h2 className="text-lg font-bold text-stone-900">Checkout</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close checkout"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-stone-500 hover:bg-stone-100"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Total Due Banner */}
        <div className="mt-4 flex items-baseline justify-between rounded-2xl bg-stone-100 px-4 py-3.5">
          <span className="text-sm font-semibold text-stone-700">Amount Due</span>
          <span className="font-mono-num text-3xl font-bold text-stone-900">
            {formatPHP(total)}
          </span>
        </div>

        {/* Cash vs Credit Switch */}
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-stone-100 p-1">
          <button
            type="button"
            onClick={() => {
              setPaymentMethod('cash');
              setError(null);
            }}
            className={`flex min-h-[48px] items-center justify-center gap-2 rounded-lg text-sm font-bold transition ${
              paymentMethod === 'cash'
                ? 'bg-white text-emerald-800 shadow-sm'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Banknote className="h-4 w-4" aria-hidden="true" />
            <span>Cash</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setPaymentMethod('credit');
              setError(null);
            }}
            className={`flex min-h-[48px] items-center justify-center gap-2 rounded-lg text-sm font-bold transition ${
              paymentMethod === 'credit'
                ? 'bg-white text-amber-800 shadow-sm'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <UserCheck className="h-4 w-4" aria-hidden="true" />
            <span>Credit (Utang)</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {paymentMethod === 'cash' ? (
            <>
              <div>
                <label
                  htmlFor="cash-received-input"
                  className="block text-sm font-semibold text-stone-700"
                >
                  Cash Received (₱)
                </label>
                <input
                  id="cash-received-input"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={cashInput}
                  onChange={(e) => {
                    setCashInput(e.target.value);
                    setError(null);
                  }}
                  placeholder={total.toFixed(2)}
                  className="mt-1.5 min-h-[54px] w-full rounded-xl border border-stone-300 px-4 font-mono-num text-2xl font-bold text-stone-900 focus:border-emerald-700 focus:outline-none"
                />
              </div>

              {/* Quick Cash Buttons */}
              <div className="grid grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCashInput(total.toFixed(2));
                    setError(null);
                  }}
                  className="min-h-[48px] rounded-xl border border-emerald-300 bg-emerald-50 px-2 text-sm font-bold text-emerald-800 hover:bg-emerald-100"
                >
                  Exact
                </button>
                {QUICK_CASH_AMOUNTS.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => {
                      setCashInput(String(amt));
                      setError(null);
                    }}
                    className="min-h-[48px] rounded-xl border border-stone-300 bg-white px-2 font-mono-num text-sm font-bold text-stone-900 hover:bg-stone-50"
                  >
                    ₱{amt}
                  </button>
                ))}
              </div>

              {/* Change Display */}
              <div
                className={`rounded-2xl border px-4 py-3.5 ${
                  cashInput === ''
                    ? 'border-stone-200 bg-stone-50'
                    : cashReady
                      ? 'border-emerald-200 bg-emerald-50'
                      : 'border-red-200 bg-red-50'
                }`}
              >
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold text-stone-700">
                    {cashInput === ''
                      ? 'Change'
                      : cashReady
                        ? 'Change'
                        : 'Still Needed'}
                  </span>
                  <span
                    className={`font-mono-num text-3xl font-bold ${
                      cashInput === ''
                        ? 'text-stone-400'
                        : cashReady
                          ? 'text-emerald-800'
                          : 'text-red-700'
                    }`}
                  >
                    {cashInput === ''
                      ? formatPHP(0)
                      : formatPHP(Math.abs(change))}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div>
                <label
                  htmlFor="credit-customer-input"
                  className="block text-sm font-semibold text-stone-700"
                >
                  Customer Name
                </label>
                <input
                  id="credit-customer-input"
                  type="text"
                  value={customerName}
                  onChange={(e) => {
                    setCustomerName(e.target.value);
                    setError(null);
                  }}
                  placeholder="e.g. Ate Maria"
                  className="mt-1.5 min-h-[52px] w-full rounded-xl border border-stone-300 px-3.5 text-base font-medium text-stone-900 focus:border-emerald-700 focus:outline-none"
                />
              </div>

              {existingCustomers.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-stone-600">
                    Existing Customers
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {existingCustomers.map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => {
                          setCustomerName(name);
                          setError(null);
                        }}
                        className={`min-h-[44px] rounded-xl border px-3 text-sm font-semibold transition ${
                          customerName.trim().toLowerCase() === name.toLowerCase()
                            ? 'border-amber-700 bg-amber-700 text-white'
                            : 'border-stone-300 bg-white text-stone-800 hover:bg-stone-50'
                        }`}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm font-semibold text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            className={`min-h-[54px] w-full rounded-xl px-4 text-base font-bold text-white shadow-sm transition active:scale-[0.99] ${
              paymentMethod === 'cash'
                ? 'bg-emerald-700 hover:bg-emerald-800'
                : 'bg-amber-700 hover:bg-amber-800'
            }`}
          >
            {paymentMethod === 'cash'
              ? `Complete Cash Sale · ${formatPHP(total)}`
              : `Record Credit · ${formatPHP(total)}`}
          </button>
        </form>
      </div>
    </div>
  );
};
