import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  Download,
  RotateCcw,
  Save,
  ScanBarcode,
  Sparkles,
  Store,
  Upload,
} from 'lucide-react';
import type { POSState, ScannerSettings } from '../types/pos';
import { validateBackupPayload } from '../utils/posLogic';
import { ConfirmDialog } from './ConfirmDialog';
import { PWAInstallButton } from './PWAInstallButton';

interface SettingsProps {
  state: POSState;
  onUpdateStoreName: (name: string) => void;
  onUpdateDefaultThreshold: (threshold: number) => void;
  onUpdateScannerSettings: (scanner: ScannerSettings) => void;
  onLoadSampleData: () => void;
  onImportData: (nextState: POSState) => void;
  onResetAllData: () => void;
  onNotify: (text: string, type?: 'success' | 'error' | 'info') => void;
}

export const Settings: React.FC<SettingsProps> = ({
  state,
  onUpdateStoreName,
  onUpdateDefaultThreshold,
  onUpdateScannerSettings,
  onLoadSampleData,
  onImportData,
  onResetAllData,
  onNotify,
}) => {
  const [storeNameInput, setStoreNameInput] = useState(state.settings.storeName);
  const [thresholdInput, setThresholdInput] = useState(
    String(state.settings.defaultLowStockThreshold)
  );
  const [confirmSample, setConfirmSample] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setStoreNameInput(state.settings.storeName);
    setThresholdInput(String(state.settings.defaultLowStockThreshold));
  }, [state.settings.storeName, state.settings.defaultLowStockThreshold]);

  const handleSaveStoreName = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = storeNameInput.trim();
    if (!cleaned) {
      onNotify('Store name cannot be empty', 'error');
      return;
    }
    onUpdateStoreName(cleaned);
  };

  const handleSaveThreshold = (e: React.FormEvent) => {
    e.preventDefault();
    const val = Math.max(0, parseInt(thresholdInput || '5', 10) || 0);
    onUpdateDefaultThreshold(val);
  };

  const handleExportJSON = () => {
    const payload = JSON.stringify(state, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `tindahan-pos-backup-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onNotify('Backup exported to JSON', 'success');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const validated = validateBackupPayload(parsed);
      if (!validated) {
        onNotify('Invalid backup JSON file', 'error');
        return;
      }
      onImportData(validated);
    } catch {
      onNotify('Could not read backup file', 'error');
    }
  };

  return (
    <div className="space-y-4 pb-6">
      {/* Store Profile */}
      <form
        onSubmit={handleSaveStoreName}
        className="rounded-2xl border border-stone-200 bg-white p-4 space-y-3"
      >
        <div className="flex items-center gap-2">
          <Store className="h-5 w-5 text-emerald-700" aria-hidden="true" />
          <h2 className="text-base font-bold text-stone-900">Store Profile</h2>
        </div>

        <div>
          <label
            htmlFor="settings-store-name"
            className="block text-xs font-semibold text-stone-600"
          >
            Store Name (header &amp; receipts)
          </label>
          <div className="mt-1.5 flex gap-2">
            <input
              id="settings-store-name"
              type="text"
              value={storeNameInput}
              onChange={(e) => setStoreNameInput(e.target.value)}
              placeholder="My Sari-Sari Store"
              className="min-h-[48px] min-w-0 flex-1 rounded-xl border border-stone-300 px-3.5 text-base font-medium text-stone-900 focus:border-emerald-700 focus:outline-none"
            />
            <button
              type="submit"
              className="flex min-h-[48px] items-center gap-1.5 rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-800 shrink-0"
            >
              <Save className="h-4 w-4" aria-hidden="true" />
              <span>Save</span>
            </button>
          </div>
        </div>
      </form>

      {/* Default Low-Stock Alert Level */}
      <form
        onSubmit={handleSaveThreshold}
        className="rounded-2xl border border-stone-200 bg-white p-4 space-y-3"
      >
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-amber-700" aria-hidden="true" />
          <h2 className="text-base font-bold text-stone-900">Default Low-Stock Alert</h2>
        </div>
        <div className="flex gap-2">
          <input
            aria-label="Default low-stock alert level"
            type="number"
            inputMode="numeric"
            min="0"
            value={thresholdInput}
            onChange={(e) => setThresholdInput(e.target.value)}
            className="min-h-[48px] flex-1 rounded-xl border border-stone-300 px-3.5 font-mono-num text-base font-bold text-stone-900 focus:border-emerald-700 focus:outline-none"
          />
          <button
            type="submit"
            className="min-h-[48px] rounded-xl bg-stone-900 px-4 text-sm font-bold text-white hover:bg-stone-800 shrink-0"
          >
            Save
          </button>
        </div>
      </form>

      {/* Scanner Settings */}
      <div className="rounded-2xl border border-stone-200 bg-white p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ScanBarcode className="h-5 w-5 text-emerald-700" aria-hidden="true" />
          <h2 className="text-base font-bold text-stone-900">Scanner Settings</h2>
        </div>

        <label className="flex min-h-[52px] cursor-pointer items-center justify-between gap-3 rounded-xl border border-stone-200 px-3.5">
          <div>
            <p className="text-sm font-semibold text-stone-900">Beep Sound on Scan</p>
            <p className="text-xs text-stone-500">Short beep when barcode is read</p>
          </div>
          <input
            type="checkbox"
            checked={state.settings.scanner.beepEnabled}
            onChange={(e) =>
              onUpdateScannerSettings({
                ...state.settings.scanner,
                beepEnabled: e.target.checked,
              })
            }
            className="h-5 w-5 accent-emerald-700"
          />
        </label>

        <label className="flex min-h-[52px] cursor-pointer items-center justify-between gap-3 rounded-xl border border-stone-200 px-3.5">
          <div>
            <p className="text-sm font-semibold text-stone-900">Vibrate on Scan</p>
            <p className="text-xs text-stone-500">Haptic vibration on phone</p>
          </div>
          <input
            type="checkbox"
            checked={state.settings.scanner.vibrationEnabled}
            onChange={(e) =>
              onUpdateScannerSettings({
                ...state.settings.scanner,
                vibrationEnabled: e.target.checked,
              })
            }
            className="h-5 w-5 accent-emerald-700"
          />
        </label>
      </div>

      {/* Install PWA */}
      <div className="rounded-2xl border border-stone-200 bg-white p-4 space-y-3">
        <h2 className="text-base font-bold text-stone-900">Install App (Offline PWA)</h2>
        <PWAInstallButton />
      </div>

      {/* Sample Data & Backup / Restore */}
      <div className="rounded-2xl border border-stone-200 bg-white p-4 space-y-2.5">
        <h2 className="text-base font-bold text-stone-900">Data &amp; Backup</h2>

        <button
          type="button"
          onClick={() => {
            if (state.products.length > 0 || state.sales.length > 0) {
              setConfirmSample(true);
            } else {
              onLoadSampleData();
            }
          }}
          className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 text-sm font-bold text-amber-900 hover:bg-amber-100"
        >
          <Sparkles className="h-4 w-4 text-amber-700" aria-hidden="true" />
          <span>Load Sample Data (~20 Items)</span>
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleExportJSON}
            className="flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3 text-xs font-bold text-stone-900 hover:bg-stone-50"
          >
            <Download className="h-4 w-4 text-emerald-700 shrink-0" aria-hidden="true" />
            <span>Export JSON</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3 text-xs font-bold text-stone-900 hover:bg-stone-50"
          >
            <Upload className="h-4 w-4 text-stone-700 shrink-0" aria-hidden="true" />
            <span>Import JSON</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={(e) => void handleFileChange(e)}
            className="hidden"
          />
        </div>
      </div>

      {/* Reset All Data */}
      <div className="rounded-2xl border border-red-200 bg-white p-4 space-y-2.5">
        <h2 className="text-base font-bold text-red-800">Reset All Data</h2>
        <p className="text-xs text-stone-600">
          Clears all products, stock history, sales, and customer credit from IndexedDB.
        </p>
        <button
          type="button"
          onClick={() => setConfirmReset(true)}
          className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-red-300 bg-red-50 px-4 text-sm font-bold text-red-700 hover:bg-red-100"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          <span>Reset All Data</span>
        </button>
      </div>

      <ConfirmDialog
        open={confirmSample}
        title="Load Sample Data?"
        message="This replaces current products, sales, and credit records with 20 sample sari-sari store products."
        confirmLabel="Load Sample Data"
        variant="warning"
        onConfirm={() => {
          onLoadSampleData();
          setConfirmSample(false);
        }}
        onCancel={() => setConfirmSample(false)}
      />

      <ConfirmDialog
        open={confirmReset}
        title="Reset All Store Data"
        message="This permanently deletes all products, receipts, stock history, and credit balances."
        confirmLabel="Erase Everything"
        variant="danger"
        requireText="RESET"
        onConfirm={() => {
          onResetAllData();
          setConfirmReset(false);
        }}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  );
};
