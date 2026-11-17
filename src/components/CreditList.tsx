import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2, ChevronRight, UserCheck, Wallet } from 'lucide-react';
import type { CreditPayment, Sale } from '../types/pos';
import { formatPHP, formatShortDateTime } from '../utils/format';
import { getCustomerCreditSummaries } from '../utils/posLogic';

interface CreditListProps {
  sales: Sale[];
  creditPayments: CreditPayment[];
  onRecordPayment: (customerName: string, amount: number, note?: string) => void;
}

export const CreditList: React.FC<CreditListProps> = ({
  sales,
  creditPayments,
  onRecordPayment,
}) => {
  const [selectedCustomerName, setSelectedCustomerName] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payNote, setPayNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const summaries = getCustomerCreditSummaries(sales, creditPayments);
  const totalReceivables = summaries.reduce((sum, c) => sum + c.balance, 0);
  const customersWithBalance = summaries.filter((c) => c.balance > 0);

  const selectedCustomer = selectedCustomerName
    ? summaries.find(
        (c) => c.customerName.toLowerCase() === selectedCustomerName.toLowerCase()
      ) ?? null
    : null;

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    const amt = parseFloat(payAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('Enter a valid payment amount greater than 0.');
      return;
    }
    if (amt > selectedCustomer.balance) {
      setError(`Amount cannot exceed balance of ${formatPHP(selectedCustomer.balance)}.`);
      return;
    }
    onRecordPayment(selectedCustomer.customerName, amt, payNote);
    setPayAmount('');
    setPayNote('');
    setError(null);
  };

  if (selectedCustomer) {
    type TimelineEntry =
      | { kind: 'sale'; date: string; sale: Sale }
      | { kind: 'payment'; date: string; payment: CreditPayment };

    const timeline: TimelineEntry[] = [
      ...selectedCustomer.creditSales.map((sale) => ({
        kind: 'sale' as const,
        date: sale.createdAt,
        sale,
      })),
      ...selectedCustomer.payments.map((payment) => ({
        kind: 'payment' as const,
        date: payment.createdAt,
        payment,
      })),
    ].sort((a, b) => b.date.localeCompare(a.date));

    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => {
            setSelectedCustomerName(null);
            setPayAmount('');
            setPayNote('');
            setError(null);
          }}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-stone-200 bg-white px-3.5 text-sm font-semibold text-stone-800 hover:bg-stone-50"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>All Customers</span>
        </button>

        {/* Customer Balance Header */}
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold text-stone-900">
                {selectedCustomer.customerName}
              </h2>
              <p className="mt-0.5 text-xs text-stone-500 tabular-nums">
                Total Credit: {formatPHP(selectedCustomer.totalCredit)} · Paid:{' '}
                {formatPHP(selectedCustomer.totalPaid)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold text-stone-500">Outstanding Balance</p>
              <p
                className={`font-mono-num text-2xl font-bold ${
                  selectedCustomer.balance > 0 ? 'text-amber-800' : 'text-emerald-700'
                }`}
              >
                {formatPHP(selectedCustomer.balance)}
              </p>
            </div>
          </div>

          {selectedCustomer.balance > 0 ? (
            <form
              onSubmit={handlePaymentSubmit}
              className="mt-4 border-t border-stone-100 pt-4 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="credit-payment-amount"
                  className="text-sm font-bold text-stone-800"
                >
                  Record Payment (₱)
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setPayAmount(selectedCustomer.balance.toFixed(2));
                    setError(null);
                  }}
                  className="min-h-[40px] rounded-lg border border-emerald-300 bg-emerald-50 px-3 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
                >
                  Pay Full ({formatPHP(selectedCustomer.balance)})
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <input
                  id="credit-payment-amount"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0.01"
                  max={selectedCustomer.balance}
                  value={payAmount}
                  onChange={(e) => {
                    setPayAmount(e.target.value);
                    setError(null);
                  }}
                  placeholder="Amount (₱)"
                  className="min-h-[48px] rounded-xl border border-stone-300 px-3.5 font-mono-num text-lg font-bold text-stone-900 focus:border-emerald-700 focus:outline-none"
                />
                <input
                  type="text"
                  aria-label="Payment note (optional)"
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  placeholder="Note (optional, e.g. Partial)"
                  className="min-h-[48px] rounded-xl border border-stone-300 px-3.5 text-sm text-stone-900 focus:border-emerald-700 focus:outline-none"
                />
              </div>

              {error && (
                <p role="alert" className="text-xs font-semibold text-red-700">
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="min-h-[48px] w-full rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-800"
              >
                Save Payment
              </button>
            </form>
          ) : (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm font-semibold text-emerald-800">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Fully paid — zero balance</span>
            </div>
          )}
        </div>

        {/* History Timeline */}
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <h3 className="text-sm font-bold text-stone-900">
            Credit &amp; Payment History
          </h3>
          <ul className="mt-3 divide-y divide-stone-100">
            {timeline.map((entry) => {
              if (entry.kind === 'payment') {
                return (
                  <li
                    key={entry.payment.id}
                    className="flex items-start justify-between gap-3 py-3"
                  >
                    <div>
                      <p className="text-sm font-bold text-emerald-800">
                        Payment Received
                      </p>
                      <p className="text-xs text-stone-500">
                        {formatShortDateTime(entry.payment.createdAt)}
                        {entry.payment.note ? ` · ${entry.payment.note}` : ''}
                      </p>
                    </div>
                    <span className="font-mono-num text-base font-bold text-emerald-700 shrink-0">
                      -{formatPHP(entry.payment.amount)}
                    </span>
                  </li>
                );
              }

              return (
                <li
                  key={entry.sale.id}
                  className="flex items-start justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-stone-900">
                      {entry.sale.receiptNumber} · Credit Purchase
                    </p>
                    <p className="text-xs text-stone-500">
                      {formatShortDateTime(entry.sale.createdAt)}
                    </p>
                    <p className="mt-1 text-xs text-stone-700">
                      {entry.sale.items
                        .map((i) => `${i.quantity}x ${i.name}`)
                        .join(', ')}
                    </p>
                  </div>
                  <span className="font-mono-num text-base font-bold text-amber-800 shrink-0">
                    +{formatPHP(entry.sale.total)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Total Receivables Banner */}
      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-stone-500">
              Total Receivables (Utang)
            </p>
            <p className="mt-1 font-mono-num text-3xl font-bold text-amber-800">
              {formatPHP(totalReceivables)}
            </p>
            <p className="mt-0.5 text-xs text-stone-600">
              {customersWithBalance.length}{' '}
              {customersWithBalance.length === 1 ? 'customer' : 'customers'} with
              outstanding balance
            </p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 shrink-0">
            <Wallet className="h-6 w-6" aria-hidden="true" />
          </div>
        </div>
      </div>

      {/* Customer List */}
      {summaries.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white px-5 py-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100 text-stone-500">
            <UserCheck className="h-6 w-6" aria-hidden="true" />
          </div>
          <h3 className="mt-3 text-base font-bold text-stone-900">
            No credit records yet
          </h3>
          <p className="mt-1 text-sm text-stone-600">
            When a customer buys on credit during checkout, their balance will appear here.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200 bg-white">
          {summaries.map((customer) => (
            <button
              key={customer.customerName}
              type="button"
              onClick={() => setSelectedCustomerName(customer.customerName)}
              className="flex min-h-[64px] w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-stone-50 active:bg-stone-100 transition"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-bold text-stone-900">
                  {customer.customerName}
                </p>
                <p className="text-xs text-stone-500">
                  {customer.creditSales.length}{' '}
                  {customer.creditSales.length === 1 ? 'purchase' : 'purchases'}
                  {customer.lastActivityAt
                    ? ` · Last ${formatShortDateTime(customer.lastActivityAt)}`
                    : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`font-mono-num text-base font-bold ${
                    customer.balance > 0 ? 'text-amber-800' : 'text-emerald-700'
                  }`}
                >
                  {customer.balance > 0 ? formatPHP(customer.balance) : 'Paid'}
                </span>
                <ChevronRight className="h-4 w-4 text-stone-400" aria-hidden="true" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
