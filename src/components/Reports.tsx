import React, { useState } from 'react';
import {
  AlertTriangle,
  Ban,
  BarChart3,
  Boxes,
  ReceiptText,
  TrendingUp,
} from 'lucide-react';
import type { Product, ReportDateRange, Sale } from '../types/pos';
import { formatPHP, formatShortDateTime, toLocalDateKey } from '../utils/format';
import { getInventoryValuation, getReportSummary } from '../utils/posLogic';
import { ConfirmDialog } from './ConfirmDialog';

interface ReportsProps {
  products: Product[];
  sales: Sale[];
  onVoidSale: (saleId: string) => void;
}

const RANGE_OPTIONS: Array<{ value: ReportDateRange; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'custom', label: 'Custom' },
];

export const Reports: React.FC<ReportsProps> = ({ products, sales, onVoidSale }) => {
  const todayKey = toLocalDateKey(new Date());
  const [range, setRange] = useState<ReportDateRange>('today');
  const [customStart, setCustomStart] = useState(todayKey);
  const [customEnd, setCustomEnd] = useState(todayKey);
  const [voidTarget, setVoidTarget] = useState<Sale | null>(null);

  const summary = getReportSummary(sales, range, { customStart, customEnd });
  const valuation = getInventoryValuation(products);
  const maxDayTotal = Math.max(1, ...summary.last7Days.map((d) => d.total));

  return (
    <div className="space-y-4 pb-6">
      {/* Date Range Filter */}
      <div className="rounded-2xl border border-stone-200 bg-white p-3 space-y-3">
        <div className="grid grid-cols-4 gap-1.5" role="tablist" aria-label="Report date range">
          {RANGE_OPTIONS.map((opt) => {
            const active = range === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setRange(opt.value)}
                className={`min-h-[44px] rounded-xl px-1.5 text-xs font-bold transition whitespace-nowrap ${
                  active
                    ? 'bg-emerald-700 text-white'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {range === 'custom' && (
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <div>
              <label htmlFor="report-start" className="block text-xs font-semibold text-stone-600">
                From
              </label>
              <input
                id="report-start"
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="mt-1 min-h-[44px] w-full rounded-xl border border-stone-300 px-2.5 text-xs text-stone-900"
              />
            </div>
            <div>
              <label htmlFor="report-end" className="block text-xs font-semibold text-stone-600">
                To
              </label>
              <input
                id="report-end"
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="mt-1 min-h-[44px] w-full rounded-xl border border-stone-300 px-2.5 text-xs text-stone-900"
              />
            </div>
          </div>
        )}
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl border border-stone-200 bg-white p-3.5">
          <p className="text-xs font-semibold text-stone-500">Total Sales</p>
          <p className="mt-1 font-mono-num text-xl font-bold text-stone-900">
            {formatPHP(summary.totalSales)}
          </p>
          <p className="mt-0.5 text-xs text-stone-500 tabular-nums">
            {summary.transactionCount}{' '}
            {summary.transactionCount === 1 ? 'transaction' : 'transactions'}
          </p>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-3.5">
          <p className="text-xs font-semibold text-stone-500">Gross Profit</p>
          <p className="mt-1 font-mono-num text-xl font-bold text-emerald-700">
            {formatPHP(summary.grossProfit)}
          </p>
          <p className="mt-0.5 text-xs text-stone-500">Selling minus cost</p>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-3.5">
          <p className="text-xs font-semibold text-stone-500">Cash Sales</p>
          <p className="mt-1 font-mono-num text-xl font-bold text-stone-900">
            {formatPHP(summary.cashSales)}
          </p>
          <p className="mt-0.5 text-xs text-stone-500">Paid on checkout</p>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-3.5">
          <p className="text-xs font-semibold text-stone-500">Credit Sales</p>
          <p className="mt-1 font-mono-num text-xl font-bold text-amber-800">
            {formatPHP(summary.creditSales)}
          </p>
          <p className="mt-0.5 text-xs text-stone-500">Recorded to utang</p>
        </div>
      </div>

      {/* 7-Day Bar Chart */}
      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-emerald-700" aria-hidden="true" />
          <h3 className="text-sm font-bold text-stone-900">
            Daily Sales (Last 7 Days)
          </h3>
        </div>
        <div className="mt-3 flex h-40 items-end justify-between gap-1.5 pt-4">
          {summary.last7Days.map((day) => {
            const pct =
              day.total > 0
                ? Math.max(8, Math.round((day.total / maxDayTotal) * 100))
                : 4;
            return (
              <div
                key={day.dateKey}
                className="flex h-full flex-1 flex-col items-center justify-end gap-1"
              >
                <span className="font-mono-num text-[10px] font-semibold text-stone-600 truncate max-w-full">
                  {day.total > 0 ? `₱${Math.round(day.total)}` : '—'}
                </span>
                <div className="flex w-full flex-1 items-end justify-center">
                  <div
                    title={`${day.label}: ${formatPHP(day.total)}`}
                    style={{ height: `${pct}%` }}
                    className={`w-full max-w-[32px] rounded-t-lg transition-all ${
                      day.total > 0 ? 'bg-emerald-600' : 'bg-stone-200'
                    }`}
                  />
                </div>
                <span className="text-[11px] font-semibold text-stone-600">
                  {day.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Inventory Valuation */}
      <div className="rounded-2xl border border-stone-200 bg-white p-4 space-y-2.5">
        <div className="flex items-center gap-2">
          <Boxes className="h-4 w-4 text-emerald-700" aria-hidden="true" />
          <h3 className="text-sm font-bold text-stone-900">Inventory Value</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-stone-50 p-3">
            <p className="text-xs text-stone-500">At Cost Price</p>
            <p className="mt-0.5 font-mono-num text-base font-bold text-stone-900">
              {formatPHP(valuation.costValue)}
            </p>
          </div>
          <div className="rounded-xl bg-emerald-50 p-3">
            <p className="text-xs text-emerald-800">At Selling Price</p>
            <p className="mt-0.5 font-mono-num text-base font-bold text-emerald-900">
              {formatPHP(valuation.sellingValue)}
            </p>
          </div>
        </div>
      </div>

      {/* Top 5 Best-Selling & Top 5 Most Profitable */}
      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <h3 className="text-sm font-bold text-stone-900">
          Top 5 Best-Selling Products
        </h3>
        {summary.topSellingProducts.length === 0 ? (
          <p className="mt-4 text-center text-xs text-stone-500">
            No sales in this date range yet.
          </p>
        ) : (
          <ul className="mt-2.5 divide-y divide-stone-100">
            {summary.topSellingProducts.map((prod, idx) => (
              <li
                key={prod.productId}
                className="flex items-center justify-between gap-2 py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-stone-100 font-mono-num text-xs font-bold text-stone-700">
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-stone-900">
                      {prod.name}
                    </p>
                    <p className="text-xs text-stone-500 tabular-nums">
                      {prod.quantitySold} sold
                    </p>
                  </div>
                </div>
                <span className="font-mono-num text-sm font-bold text-stone-900 shrink-0">
                  {formatPHP(prod.revenue)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-emerald-700" aria-hidden="true" />
          <h3 className="text-sm font-bold text-stone-900">
            Top 5 Most Profitable Products
          </h3>
        </div>
        {summary.topProfitableProducts.length === 0 ? (
          <p className="mt-4 text-center text-xs text-stone-500">
            No sales in this date range yet.
          </p>
        ) : (
          <ul className="mt-2.5 divide-y divide-stone-100">
            {summary.topProfitableProducts.map((prod, idx) => (
              <li
                key={prod.productId}
                className="flex items-center justify-between gap-2 py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-50 font-mono-num text-xs font-bold text-emerald-800">
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-stone-900">
                      {prod.name}
                    </p>
                    <p className="text-xs text-stone-500 tabular-nums">
                      Sales {formatPHP(prod.revenue)}
                    </p>
                  </div>
                </div>
                <span className="font-mono-num text-sm font-bold text-emerald-700 shrink-0">
                  +{formatPHP(prod.profit)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Low-Stock Shopping List */}
      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-700" aria-hidden="true" />
          <h3 className="text-sm font-bold text-stone-900">
            Low-Stock Shopping List ({valuation.lowStockProducts.length})
          </h3>
        </div>
        {valuation.lowStockProducts.length === 0 ? (
          <p className="mt-3 text-xs text-stone-500">
            All products are stocked above alert levels.
          </p>
        ) : (
          <ul className="mt-2.5 divide-y divide-stone-100">
            {valuation.lowStockProducts.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-2 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-stone-900">
                    {p.name}
                  </p>
                  <p className="text-xs text-stone-500">
                    {p.supplierName ? `Supplier: ${p.supplierName}` : p.category}
                  </p>
                </div>
                <span
                  className={`font-mono-num text-xs font-bold shrink-0 ${
                    p.stock <= 0 ? 'text-red-700' : 'text-amber-700'
                  }`}
                >
                  {p.stock <= 0 ? 'Out (0)' : `${p.stock} left`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Past Transactions */}
      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <ReceiptText className="h-4 w-4 text-stone-700" aria-hidden="true" />
          <h3 className="text-sm font-bold text-stone-900">
            Transactions ({summary.filteredSales.length})
          </h3>
        </div>

        {summary.filteredSales.length === 0 ? (
          <p className="mt-4 pb-2 text-center text-xs text-stone-500">
            No transactions recorded for this period.
          </p>
        ) : (
          <ul className="mt-2.5 divide-y divide-stone-100">
            {summary.filteredSales.map((sale) => (
              <li
                key={sale.id}
                className={`py-3 ${sale.voided ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono-num text-sm font-bold text-stone-900">
                        {sale.receiptNumber}
                      </span>
                      <span className="text-xs text-stone-500">
                        {formatShortDateTime(sale.createdAt)}
                      </span>
                      <span
                        className={`text-xs font-bold ${
                          sale.voided
                            ? 'text-red-700'
                            : sale.paymentMethod === 'cash'
                              ? 'text-emerald-700'
                              : 'text-amber-800'
                        }`}
                      >
                        ·{' '}
                        {sale.voided
                          ? 'Voided'
                          : sale.paymentMethod === 'cash'
                            ? 'Cash'
                            : `Credit (${sale.customerName})`}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-stone-600">
                      {sale.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`font-mono-num text-sm font-bold ${
                        sale.voided ? 'line-through text-stone-500' : 'text-stone-900'
                      }`}
                    >
                      {formatPHP(sale.total)}
                    </span>
                    {!sale.voided && (
                      <button
                        type="button"
                        onClick={() => setVoidTarget(sale)}
                        aria-label={`Void transaction ${sale.receiptNumber}`}
                        className="flex min-h-[44px] items-center gap-1 rounded-xl border border-stone-200 px-2.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                      >
                        <Ban className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Void</span>
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={!!voidTarget}
        title="Void Transaction"
        message={
          voidTarget
            ? `Void ${voidTarget.receiptNumber} (${formatPHP(voidTarget.total)})? Stock will be restored automatically.`
            : ''
        }
        confirmLabel="Void Sale"
        variant="danger"
        onConfirm={() => {
          if (voidTarget) onVoidSale(voidTarget.id);
          setVoidTarget(null);
        }}
        onCancel={() => setVoidTarget(null)}
      />
    </div>
  );
};
