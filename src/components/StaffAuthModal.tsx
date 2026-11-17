import React from 'react';
import { ClipboardList, X } from 'lucide-react';
import type { AuditLogEntry } from '../types/pos';
import { formatShortDateTime } from '../utils/format';

interface StaffAuthModalProps {
  open: boolean;
  auditLogs: AuditLogEntry[];
  onClose: () => void;
}

export const StaffAuthModal: React.FC<StaffAuthModalProps> = ({
  open,
  auditLogs,
  onClose,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-label="Store Activity Log"
    >
      <div className="flex max-h-[88vh] w-full max-w-[440px] flex-col rounded-t-3xl bg-white shadow-xl pb-safe">
        <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-100 text-stone-700">
              <ClipboardList className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900">Store Activity Log</h2>
              <p className="text-xs text-stone-500">
                {auditLogs.length} recorded store &amp; e-wallet action(s)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close activity log"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-stone-500 hover:bg-stone-100"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {auditLogs.length === 0 ? (
            <p className="py-10 text-center text-xs text-stone-500">
              No store activity recorded yet.
            </p>
          ) : (
            <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white">
              {auditLogs.slice(0, 60).map((entry) => (
                <li key={entry.id} className="px-3.5 py-2.5 space-y-0.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-bold text-stone-900">
                      {entry.action}
                    </span>
                    <span className="text-[11px] text-stone-500 shrink-0">
                      {formatShortDateTime(entry.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-stone-600">{entry.details}</p>
                  <p className="text-[11px] text-stone-500">
                    {entry.module.toUpperCase()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
