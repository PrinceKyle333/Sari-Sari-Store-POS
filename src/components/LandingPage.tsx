import React from 'react';
import { ArrowRight, ChevronRight, ShoppingBag, Sparkles, Wallet } from 'lucide-react';
import type { POSState } from '../types/pos';
import { formatPHP, toLocalDateKey } from '../utils/format';
import { computeEWalletSummary } from '../utils/ewalletLogic';
import { getReportSummary } from '../utils/posLogic';

interface LandingPageProps {
  state: POSState;
  onOpenPOS: () => void;
  onOpenEWallet: () => void;
  onOpenActivityLog: () => void;
  onLoadSampleData: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  state,
  onOpenPOS,
  onOpenEWallet,
  onOpenActivityLog,
  onLoadSampleData,
}) => {
  const todayKey = toLocalDateKey(new Date());
  const posToday = getReportSummary(state.sales, 'today');
  const ewalletToday = computeEWalletSummary(state.ewalletTransactions, todayKey);
  const openEWalletSession = state.ewalletSessions.find((s) => s.status === 'open');
  const lowStockCount = state.products.filter(
    (p) => p.stock <= p.lowStockThreshold
  ).length;

  const isStoreEmpty =
    state.products.length === 0 &&
    state.sales.length === 0 &&
    state.ewalletTransactions.length === 0;

  return (
    <div className="space-y-4 pb-8">
      {/* Two Main Module Launch Cards */}
      <section aria-label="Store modules" className="space-y-3">
        <div className="flex items-baseline justify-between px-1">
          <h3 className="text-sm font-bold text-stone-900">Choose Workspace</h3>
          <span className="text-xs text-stone-500">Separate ledgers &amp; reports</span>
        </div>

        {/* Module 1: Open POS */}
        <button
          type="button"
          onClick={onOpenPOS}
          className="group flex w-full flex-col rounded-3xl border border-stone-200 bg-white p-4 text-left shadow-sm hover:border-emerald-700 active:scale-[0.99] transition"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-700 text-white">
                <ShoppingBag className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-stone-900">Open POS</h4>
                <p className="text-xs text-stone-600">
                  Sales, barcode scan, inventory &amp; utang
                </p>
              </div>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800 shrink-0">
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-stone-100 pt-3">
            <div>
              <p className="text-[11px] text-stone-500">Today Sales</p>
              <p className="font-mono-num text-sm font-bold text-stone-900">
                {formatPHP(posToday.totalSales)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-stone-500">Products</p>
              <p className="font-mono-num text-sm font-bold text-stone-900">
                {state.products.length}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-stone-500">Low Stock</p>
              <p
                className={`font-mono-num text-sm font-bold ${
                  lowStockCount > 0 ? 'text-amber-700' : 'text-stone-900'
                }`}
              >
                {lowStockCount}
              </p>
            </div>
          </div>
        </button>

        {/* Module 2: Open E-Wallet */}
        <button
          type="button"
          onClick={onOpenEWallet}
          className="group flex w-full flex-col rounded-3xl border border-stone-200 bg-white p-4 text-left shadow-sm hover:border-sky-700 active:scale-[0.99] transition"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-700 text-white">
                <Wallet className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-stone-900">Open E-Wallet</h4>
                <p className="text-xs text-stone-600">
                  GCash, Maya, MariBank, claim &amp; EOD session
                </p>
              </div>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-800 shrink-0">
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-stone-100 pt-3">
            <div>
              <p className="text-[11px] text-stone-500">Fees Today</p>
              <p className="font-mono-num text-sm font-bold text-sky-800">
                {formatPHP(ewalletToday.totalServiceFees)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-stone-500">Pending</p>
              <p
                className={`font-mono-num text-sm font-bold ${
                  ewalletToday.pendingCount > 0 ? 'text-amber-700' : 'text-stone-900'
                }`}
              >
                {ewalletToday.pendingCount}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-stone-500">Session</p>
              <p
                className={`text-sm font-bold ${
                  openEWalletSession ? 'text-emerald-700' : 'text-stone-600'
                }`}
              >
                {openEWalletSession ? 'Open' : 'Closed'}
              </p>
            </div>
          </div>
        </button>
      </section>

      {/* Quick Store Tools & Sample Data */}
      <section className="rounded-2xl border border-stone-200 bg-white divide-y divide-stone-100">
        <button
          type="button"
          onClick={onOpenActivityLog}
          className="flex min-h-[54px] w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-stone-50"
        >
          <div>
            <p className="text-sm font-bold text-stone-900">Activity Log</p>
            <p className="text-xs text-stone-500">
              {state.auditLogs.length} recorded store &amp; e-wallet action(s)
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-stone-400 shrink-0" aria-hidden="true" />
        </button>

        {isStoreEmpty && (
          <button
            type="button"
            onClick={onLoadSampleData}
            className="flex min-h-[54px] w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-amber-50/50"
          >
            <div className="flex items-center gap-2.5">
              <Sparkles className="h-5 w-5 text-amber-600 shrink-0" aria-hidden="true" />
              <div>
                <p className="text-sm font-bold text-stone-900">
                  Load Sample POS &amp; E-Wallet Data
                </p>
                <p className="text-xs text-stone-500">
                  Adds 20 products, sales, GCash/Maya/MariBank records &amp; session
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-stone-400 shrink-0" aria-hidden="true" />
          </button>
        )}
      </section>
    </div>
  );
};
