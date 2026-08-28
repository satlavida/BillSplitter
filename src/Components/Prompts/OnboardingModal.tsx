import { useMemo } from 'react';
import useCurrencyStore from '../../currencyStore';
import useSettingsStore from '../../settingsStore';
import { useShallow } from 'zustand/shallow';
import { Modal, Button, Checkbox, SearchSelect } from '../../ui/components';
import { getCurrencyOptions } from '../../lib/currencyDisplay';

// Bump this id (e.g. "onboarding_v2") if the onboarding flow's questions
// change materially and existing users should see it again; completion is
// tracked per-id in settingsStore so old and new ids can coexist.
const ONBOARDING_ID = 'onboarding_v1';

// One-time setup modal shown on first use, letting the user set their
// currency and whether/how to auto-add themselves to bills — the same
// settings available later on the Settings page. Client-side only:
// nothing here is pushed to the live server.
const OnboardingModal = () => {
  const { currency, changeCurrency } = useCurrencyStore(
    useShallow((state) => ({
      currency: state.currency,
      changeCurrency: state.changeCurrency,
    }))
  );

  const { autoAddSelf, selfName, setAutoAddSelf, setSelfName, completedOnboarding, completeOnboarding } = useSettingsStore(
    useShallow((state) => ({
      autoAddSelf: state.autoAddSelf,
      selfName: state.selfName,
      setAutoAddSelf: state.setAutoAddSelf,
      setSelfName: state.setSelfName,
      completedOnboarding: state.completedOnboarding,
      completeOnboarding: state.completeOnboarding,
    }))
  );

  const currencyOptions = useMemo(() => getCurrencyOptions(), []);

  const isOpen = !completedOnboarding[ONBOARDING_ID];
  const finish = () => completeOnboarding(ONBOARDING_ID);

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={finish} title="Welcome to Bill Splitter">
      <div className="space-y-4">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Let's get you set up. You can always change these later in Settings.
        </p>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Currency</label>
          <SearchSelect
            value={currency}
            onChange={changeCurrency}
            searchPlaceholder="Search currency..."
            options={currencyOptions.map(({ code, symbol }) => ({ value: code, label: `${code} (${symbol})` }))}
          />
        </div>

        <div>
          <Checkbox
            id="onboarding-auto-add-self"
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

        <div className="flex justify-end pt-2">
          <Button onClick={finish}>Get Started</Button>
        </div>
      </div>
    </Modal>
  );
};

export default OnboardingModal;
