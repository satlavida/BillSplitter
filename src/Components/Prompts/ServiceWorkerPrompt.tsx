import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const ServiceWorkerPrompt = () => {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  if (!offlineReady && !needRefresh) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center gap-2 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-white px-4 py-3 rounded shadow-lg">
        <span className="text-sm">
          {offlineReady ? 'App ready to work offline' : 'New version available'}
        </span>
        {needRefresh && (
          <button
            className="px-2 py-1 text-sm bg-blue-500 text-white rounded"
            onClick={() => updateServiceWorker(true)}
          >
            Reload
          </button>
        )}
        <button
          className="px-2 py-1 text-sm bg-zinc-200 dark:bg-zinc-700 rounded"
          onClick={close}
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default ServiceWorkerPrompt;
