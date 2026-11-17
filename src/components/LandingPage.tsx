import React from 'react';
import {
  ArrowRight,
  ChevronRight,
  CloudOff,
  DoorOpen,
  Lock,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Wallet,
} from 'lucide-react';
import type { POSState } from '../types/pos';
import { formatPHP, formatShortDateTime, toLocalDateKey } from '../utils/format';
import { computeEWalletSummary } from '../utils/ewalletLogic';
import { getReportSummary } from '../utils/posLogic';

interface LandingPageProps {
  state: POSState;
  isOnline: boolean;
  onOpenStoreShift: () => void;
  onCloseStoreShift: () => void;
  onOpenPOS: () => void;
  onOpenEWallet: () => void;
  onOpenActivityLog: () => void;
  onSyncNow: () => void;
  onLoadSampleData: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  state,
  isOnline,
  onOpenStoreShift,
  onCloseStoreShift,
  onOpenPOS,
  onOpenEWallet,
  onOpenActivityLog,
  onSyncNow,
  onLoadSampleData,
}) => {
  const todayKey = toLocalDateKey(new Date());
  const posToday = getReportSummary(state.sales, 'today');
  const ewalletToday = computeEWalletSummary(state.ewalletTransactions, todayKey);
  const openEWalletSession = state.ewalletSessions.find((s) => s.status === 'open');
  const pendingSyncCount = state.syncQueue.filter((q) => q.status === 'pending').length;
  const conflictSyncCount = state.syncQueue.filter((q) => q.status === 'conflict').length;
  const lowStockCount = state.products.filter(
    (p) => p.stock <= p.lowStockThreshold
  ).length;

  const isStoreEmpty =
    state.products.length === 0 &&
    state.sales.length === 0 &&
    state.ewalletTransactions.length === 0;

  return (
    <div className="space-y-4 pb-8">
      {/* Hero / Store Status & Open Store Card */}
      <section className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-emerald-700">
              Daily Store Operations
            </p>
            <h2 className="mt-0.5 text-xl font-bold tracking-tight text-stone-900">
              {state.settings.storeName}
            </h2>
            <p className="mt-1 text-xs text-stone-600">
              {state.storeShift.isOpen
                ? `Store Open · Started ${formatShortDateTime(
                    state.storeShift.openedAt ?? new Date().toISOString()
                  )}`
                : 'Store Closed · Tap Open Store to begin today’s shift'}
            </p>
          </div>
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
              state.storeShift.isOpen
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-stone-100 text-stone-600'
            }`}
          >
            <Store className="h-6 w-6" aria-hidden="true" />
          </div>
        </div>

        {/* Open / Close Store CTA */}
        <div className="grid grid-cols-1 gap-2">
          {!state.storeShift.isOpen ? (
            <button
              type="button"
              onClick={onOpenStoreShift}
              className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 text-base font-bold text-white shadow-sm hover:bg-emerald-800 active:scale-[0.99] transition"
            >
              <DoorOpen className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span>Open Store</span>
            </button>
          ) : (
            <div className="flex items-center justify-between gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-3.5 py-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
                <span className="text-sm font-bold text-emerald-900 truncate">
                  Store Shift Active
                </span>
              </div>
              <button
                type="button"
                onClick={onCloseStoreShift}
                className="flex min-h-[40px] items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3 text-xs font-bold text-stone-800 hover:bg-stone-50 shrink-0"
              >
                <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Close Store</span>
              </button>
            </div>
          )}
        </div>

        {/* Offline / Sync Status Row */}
        <button
          type="button"
          onClick={onSyncNow}
          className="flex min-h-[48px] w-full items-center justify-between gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3.5 text-left hover:bg-stone-100"
        >
          <div className="min-w-0 flex items-center gap-2">
            {isOnline ? (
              <RefreshCw className="h-4 w-4 shrink-0 text-stone-600" aria-hidden="true" />
            ) : (
              <CloudOff className="h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
            )}
            <span className="text-xs font-medium text-stone-600">
              {isOnline ? 'Local Storage + Sync' : 'Offline Mode'}
            </span>
          </div>
          <span
            className={`text-xs font-bold ${
              conflictSyncCount > 0
                ? 'text-red-700'
                : pendingSyncCount > 0
                  ? 'text-amber-800'
                  : 'text-emerald-800'
            }`}
          >
            {conflictSyncCount > 0
              ? `${conflictSyncCount} conflict`
              : pendingSyncCount > 0
                ? `${pendingSyncCount} queued`
                : 'All Synced'}
          </span>
        </button>
      </section>

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
