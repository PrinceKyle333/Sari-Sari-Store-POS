import React from 'react';
import { motion } from 'motion/react';
import { ArrowRight, BookUser, CloudOff, ScanBarcode, Wallet } from 'lucide-react';

interface WelcomeScreenProps {
  storeName: string;
  onEnter: () => void;
}

const FEATURES = [
  { icon: ScanBarcode, title: 'Scan & Sell', text: 'Barcode checkout in seconds' },
  { icon: BookUser, title: 'Utang Tracker', text: 'Know who owes what' },
  { icon: Wallet, title: 'E-Wallet', text: 'GCash, Maya & more' },
  { icon: CloudOff, title: 'Works Offline', text: 'Data stays on your phone' },
];

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ storeName, onEnter }) => {
  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-[#023824] text-white"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* Background: soft glow + the logo's yellow swoosh */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-emerald-500/20 blur-3xl" />
        <svg
          className="absolute bottom-0 left-0 w-full"
          viewBox="0 0 400 140"
          preserveAspectRatio="none"
          style={{ height: '14vh' }}
        >
          <path d="M0 140V95C90 55 210 120 400 40v100Z" fill="#0b5c35" />
          <path d="M0 140c120-55 250-60 400-118v26C260 100 130 110 40 140Z" fill="#facc15" />
        </svg>
      </div>

      <div className="relative mx-auto flex min-h-full w-full max-w-[440px] flex-col items-center px-6 pb-[16vh] pt-14">
        <motion.img
          src="/reston-logo.png"
          alt="Reston Store logo"
          width={168}
          height={168}
          className="h-[168px] w-[168px] rounded-[38px] shadow-2xl shadow-black/40"
          initial={{ opacity: 0, scale: 0.8, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        />

        <motion.div
          className="mt-7 text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.45 }}
        >
          <h1 className="text-3xl font-bold tracking-tight">
            Reston <span className="text-yellow-400">Store</span>
          </h1>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.25em] text-emerald-100/80">
            POS Application
          </p>
          <p className="mx-auto mt-4 max-w-[300px] text-sm leading-relaxed text-emerald-50/85">
            Sales, inventory, utang and e-wallet records for your sari-sari store — all in one
            app.
          </p>
        </motion.div>

        <motion.ul
          className="mt-8 grid w-full grid-cols-2 gap-2.5"
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { delayChildren: 0.35, staggerChildren: 0.07 } } }}
        >
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <motion.li
              key={title}
              variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
              className="rounded-2xl border border-white/10 bg-white/[0.06] p-3.5 backdrop-blur-sm"
            >
              <Icon className="h-5 w-5 text-yellow-400" aria-hidden="true" />
              <p className="mt-2 text-sm font-bold">{title}</p>
              <p className="mt-0.5 text-xs leading-snug text-emerald-50/70">{text}</p>
            </motion.li>
          ))}
        </motion.ul>

        <motion.div
          className="mt-8 w-full"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65, duration: 0.4 }}
        >
          <button
            type="button"
            onClick={onEnter}
            className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-5 text-base font-bold text-[#023824] shadow-lg shadow-black/25 transition hover:bg-yellow-300 active:scale-[0.99]"
          >
            <span>Enter Store</span>
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </button>
          <p className="mt-3 truncate text-center text-xs text-emerald-50/70">{storeName}</p>
        </motion.div>
      </div>
    </div>
  );
};
