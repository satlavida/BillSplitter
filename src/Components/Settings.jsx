import React, { useMemo } from 'react';
import useCurrencyStore from '../currencyStore';
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
    </div>
  );
};

export default Settings;

