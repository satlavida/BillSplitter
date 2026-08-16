import { useMemo } from 'react';
import useCurrencyStore from '../currencyStore';
import { useShallow } from 'zustand/shallow';
import { Dropdown } from '../ui/components';

const getCurrencySymbol = (code: string): string => {
  try {
    return (
      new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: code,
        currencyDisplay: 'narrowSymbol',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })
        .formatToParts(0)
        .find((part) => part.type === 'currency')?.value ?? code
    );
  } catch {
    return code;
  }
};

const getCurrencyCodes = (): string[] => {
  if (typeof Intl.supportedValuesOf === 'function') {
    return Intl.supportedValuesOf('currency');
  }
  return ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'SEK', 'NZD', 'MXN', 'SGD', 'HKD', 'NOK', 'KRW', 'TRY', 'RUB', 'INR', 'BRL', 'ZAR'];
};

const Settings = () => {
  const { currency, changeCurrency } = useCurrencyStore(
    useShallow((state) => ({
      currency: state.currency,
      changeCurrency: state.changeCurrency,
    }))
  );

  const currencyOptions = useMemo(() => {
    return getCurrencyCodes()
      .map((code) => ({ code, symbol: getCurrencySymbol(code) }))
      .sort((a, b) => a.code.localeCompare(b.code));
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-zinc-800 dark:text-white">Settings</h2>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Currency</label>
        <Dropdown
          value={currency}
          onChange={(e) => changeCurrency(e.target.value)}
          options={currencyOptions.map(({ code, symbol }) => ({ value: code, label: `${code} (${symbol})` }))}
        />
      </div>
    </div>
  );
};

export default Settings;
