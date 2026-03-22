import React from 'react';
import { createPortal } from 'react-dom';
import { QrCode, X } from 'lucide-react';

const ANDROID_STORE_URL =
  'https://play.google.com/store/apps/details?id=net.alerthawk.alerthawk_mobile';
const IOS_STORE_URL = 'https://apps.apple.com/us/app/alerthawk/id6739902511';

interface MobileAppQrDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileAppQrDialog({ isOpen, onClose }: MobileAppQrDialogProps) {
  React.useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const modal = (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mobile-app-qr-dialog-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg bg-gray-50 dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200/80 dark:border-gray-700 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
              <QrCode className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0">
              <h2
                id="mobile-app-qr-dialog-title"
                className="text-lg font-semibold text-gray-900 dark:text-white truncate"
              >
                Mobile app setup
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Download, install, and connect AlertHawk on your phone
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800 dark:text-gray-400 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-6">
          <section>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              1. Install the app
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
              Choose your store and install AlertHawk on your device.
            </p>
            <div className="flex flex-wrap gap-3 items-center">
              <a
                href={IOS_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg"
              >
                <img
                  src="/assets/ios.png"
                  alt="Download on the App Store"
                  className="h-11 w-auto"
                />
              </a>
              <a
                href={ANDROID_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg"
              >
                <img
                  src="/assets/android.png"
                  alt="Get it on Google Play"
                  className="h-11 w-auto"
                />
              </a>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              2. Connect to this environment
            </h3>
            <ol className="text-sm text-gray-600 dark:text-gray-300 space-y-2 list-decimal list-inside">
              <li>Open the AlertHawk app after installation.</li>
              <li>
                Tap the <strong className="text-gray-800 dark:text-gray-200">Settings</strong> button
                at the bottom of the screen.
              </li>
              <li>Scan the QR code below using the app.</li>
              <li>
                Tap the <strong className="text-gray-800 dark:text-gray-200">Save</strong> button.
              </li>
              <li>Sign in with your Microsoft account.</li>
            </ol>
          </section>

          <section className="flex flex-col items-center">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 text-center">
              Scan with the mobile app
            </p>
            <p
              className="text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/50 border border-amber-200/80 dark:border-amber-800/60 rounded-lg px-3 py-2 mb-3 max-w-sm text-center leading-relaxed"
              role="note"
            >
              This QR code can only be read from inside the AlertHawk app (Settings). Do not scan it with
              your phone camera or a generic QR scanner.
            </p>
            <div className="bg-white p-3 rounded-xl shadow-inner border border-gray-200 dark:border-gray-600">
              <img
                src="/assets/QR.png"
                alt="QR code to configure AlertHawk mobile app"
                className="w-52 h-52 sm:w-56 sm:h-56 object-contain"
                width={224}
                height={224}
              />
            </div>
          </section>
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
