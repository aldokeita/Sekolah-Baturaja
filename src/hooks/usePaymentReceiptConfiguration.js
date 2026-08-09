import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_PAYMENT_RECEIPT_CONFIG,
  fetchPaymentReceiptConfiguration,
  getPaymentReceiptConfiguration,
  normalizePaymentReceiptConfiguration,
  subscribePaymentReceiptConfiguration,
} from '@/lib/paymentReceiptConfiguration';

/**
 * Hook bersama untuk renderer kuitansi dan editor.
 *
 * Nilai cache dipakai lebih dulu agar preview tidak berkedip. Hydrate hanya
 * dilakukan sekali per mount, sedangkan perubahan dari save/apply langsung
 * diteruskan ke semua komponen yang sedang menampilkan kuitansi.
 */
export const usePaymentReceiptConfiguration = () => {
  const [config, setConfig] = useState(() => getPaymentReceiptConfiguration());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const next = await fetchPaymentReceiptConfiguration();
      setConfig(next);
      return next;
    } catch (loadError) {
      setConfig((current) => normalizePaymentReceiptConfiguration(current || DEFAULT_PAYMENT_RECEIPT_CONFIG));
      setError(loadError);
      throw loadError;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const unsubscribe = subscribePaymentReceiptConfiguration((next) => {
      if (active) setConfig(normalizePaymentReceiptConfiguration(next));
    });

    refresh().catch(() => {
      // The hook keeps the cached/default config available and exposes the
      // error for an editor or renderer to present an appropriate message.
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [refresh]);

  return {
    config,
    // Alias keeps the hook convenient for code that calls the value
    // `configuration`, without maintaining a second state object.
    configuration: config,
    isLoading,
    error,
    refresh,
  };
};

export default usePaymentReceiptConfiguration;
