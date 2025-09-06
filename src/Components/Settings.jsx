import React, { useMemo } from 'react';
import useCurrencyStore from '../currencyStore';
import useBillStore from '../billStore';
import { useShallow } from 'zustand/shallow';

const getCurrencySymbol = (code) => {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: code,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    })
      .formatToParts(0)
      .find(part => part.type === 'currency')
      .value;
  } catch {
    return code;
  }
};

const getCurrencyCodes = () => {
  if (typeof Intl.supportedValuesOf === 'function') {
    return Intl.supportedValuesOf('currency');
  }
  return [
    'USD','EUR','GBP','JPY','CAD','AUD','CHF','CNY','SEK','NZD',
    'MXN','SGD','HKD','NOK','KRW','TRY','RUB','INR','BRL','ZAR'
  ];
};

const Settings = () => {
  const { currency, changeCurrency } = useCurrencyStore(
    useShallow(state => ({
      currency: state.currency,
      changeCurrency: state.changeCurrency
    }))
  );

  const { showPostTaxPrice, setShowPostTaxPrice } = useBillStore(
    useShallow(state => ({
      showPostTaxPrice: state.showPostTaxPrice,
      setShowPostTaxPrice: state.setShowPostTaxPrice,
    }))
  );

  const currencyOptions = useMemo(() => {
    return getCurrencyCodes()
      .map(code => ({ code, symbol: getCurrencySymbol(code) }))
      .sort((a, b) => a.code.localeCompare(b.code));
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-zinc-800 dark:text-white">Settings</h2>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          Currency
        </label>
        <select
          value={currency}
          onChange={(e) => changeCurrency(e.target.value)}
          className="w-full p-2 border rounded-md bg-white dark:bg-zinc-800 dark:text-white dark:border-zinc-600"
        >
          {currencyOptions.map(({ code, symbol }) => (
            <option key={code} value={code}>
              {code} ({symbol})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={!!showPostTaxPrice}
            onChange={(e) => setShowPostTaxPrice(e.target.checked)}
            className="h-4 w-4"
          />
          Show Post-tax price for item
        </label>
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">Display each item's total price including allocated section/global tax.</p>
      </div>
    </div>
  );
};

export default Settings;
