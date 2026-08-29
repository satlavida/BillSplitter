import { useMemo } from 'react';
import useCurrencyStore from '../currencyStore';
import useSettingsStore from '../settingsStore';
import { useShallow } from 'zustand/shallow';
import { Checkbox, SearchSelect } from '../ui/components';
import { getCurrencyOptions } from '../lib/currencyDisplay';

const Settings = () => {
  const { currency, changeCurrency } = useCurrencyStore(
    useShallow((state) => ({
      currency: state.currency,
      changeCurrency: state.changeCurrency,
    }))
  );

  const { autoAddSelf, selfName, setAutoAddSelf, setSelfName, useDetailedQuantitySplit, setUseDetailedQuantitySplit, autoQuantitySplit, setAutoQuantitySplit } =
    useSettingsStore(
      useShallow((state) => ({
        autoAddSelf: state.autoAddSelf,
        selfName: state.selfName,
        setAutoAddSelf: state.setAutoAddSelf,
        setSelfName: state.setSelfName,
        useDetailedQuantitySplit: state.useDetailedQuantitySplit,
        setUseDetailedQuantitySplit: state.setUseDetailedQuantitySplit,
        autoQuantitySplit: state.autoQuantitySplit,
        setAutoQuantitySplit: state.setAutoQuantitySplit,
      }))
    );

  const currencyOptions = useMemo(() => getCurrencyOptions(), []);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-zinc-800 dark:text-white">Settings</h2>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Currency</label>
        <SearchSelect
          value={currency}
          onChange={changeCurrency}
          searchPlaceholder="Search currency..."
          options={currencyOptions.map(({ code, symbol }) => ({ value: code, label: `${code} (${symbol})` }))}
        />
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Used as the starting currency for new sessions — each session can change its own currency later from its Session Settings panel.
        </p>
      </div>

      <div>
        <Checkbox
          id="auto-add-self"
          checked={autoAddSelf}
          onChange={(e) => setAutoAddSelf(e.target.checked)}
          label="Add yourself to bill automatically"
        />
        {autoAddSelf && (
          <input
            type="text"
            value={selfName}
            onChange={(e) => setSelfName(e.target.value)}
            placeholder="Your name"
            className="mt-2 w-full p-2 border border-zinc-300 dark:border-zinc-600
              bg-white dark:bg-zinc-700 text-zinc-800 dark:text-white
              rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1
              dark:focus-visible:ring-blue-400 dark:focus-visible:ring-offset-zinc-800
              transition-colors"
          />
        )}
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">This name will be added automatically to any new session you create.</p>
      </div>

      <div>
        <Checkbox
          id="use-detailed-quantity-split"
          checked={useDetailedQuantitySplit}
          onChange={(e) => setUseDetailedQuantitySplit(e.target.checked)}
          label="Use Detailed Quantity Split (beta)"
        />
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Give each person an independent share number instead of the default Basic view's live pool that shrinks as others pick.
        </p>
      </div>

      <div>
        <Checkbox
          id="auto-quantity-split"
          checked={autoQuantitySplit}
          onChange={(e) => setAutoQuantitySplit(e.target.checked)}
          label="Default multi-quantity items to Quantity Split"
        />
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          A newly-added item with more than 1 quantity (manually or via receipt scan) starts as Quantity Split instead of Equal Split.
        </p>
      </div>
    </div>
  );
};

export default Settings;
