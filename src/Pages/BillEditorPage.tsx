import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useSessionStore from '../sessionStore';
import useBillStore, { useDocumentTitle } from '../billStore';
import { getLiveSession, LIVE_SERVER_URL } from '../lib/liveApi';
import { connectLiveSync, createStaleResponseGuard } from '../lib/liveSync';
import StepIndicator from '../Components/StepIndicator';
import ItemsInput from '../Components/ItemsInput';
import ItemAssignment from '../Components/ItemAssignment';
import BillSummary from '../Components/BillSummary';
import BillSettingsModal from '../Components/BillSettingsModal';
import { BackLink, IconButton } from '../ui/components';

/**
 * Scoped editor for a single bill within a session. billStore is a
 * non-persisted scratch editor here: hydrated from sessionStore on entry,
 * and every change is committed back to sessionStore via a subscription
 * (same "secondary store synced against a primary store" pattern already
 * used by passAndSplitStore, one layer up).
 */
const BillEditorPage = () => {
  const { sessionId, billId, step: stepParam } = useParams<{ sessionId: string; billId: string; step: string }>();
  const navigate = useNavigate();
  const step = Number(stepParam) || 1;
  const liveCode = useSessionStore((s) => (sessionId ? s.getSession(sessionId)?.liveCode : undefined) ?? null);
  const sessionCurrency = useSessionStore((s) => (sessionId ? s.getSession(sessionId)?.currency : undefined) ?? 'USD');
  const billDate = useSessionStore((s) => (sessionId && billId ? s.getBill(sessionId, billId)?.date : undefined) ?? new Date().toISOString());
  const [billSettingsOpen, setBillSettingsOpen] = useState(false);

  useEffect(() => {
    if (!sessionId || !billId) return;

    const session = useSessionStore.getState().getSession(sessionId);
    const bill = useSessionStore.getState().getBill(sessionId, billId);

    if (!session || !bill) {
      navigate('/sessions', { replace: true });
      return;
    }

    useSessionStore.getState().setCurrentSession(sessionId);
    useSessionStore.getState().setCurrentBill(sessionId, billId);
    useBillStore.getState().hydrateFromSession(session.people, bill);
  }, [sessionId, billId, navigate]);

  // Two-way sync between billStore's step (still the source of truth
  // StepIndicator/nextStep/prevStep/goToStep write to) and the URL's step
  // segment (the source of truth for rendering/navigation — req 14): a
  // billStore step change navigates the URL; a URL step change (browser
  // back/forward, or a direct link) resets billStore back in step.
  // syncingFromRoute guards against the two effects re-triggering each
  // other — without it, a browser-back-driven store update would
  // immediately push a *new* history entry for the same URL, corrupting
  // the back/forward stack instead of just following it.
  const syncingFromRoute = useRef(false);

  useEffect(() => {
    if (!sessionId || !billId) return;
    const unsubscribe = useBillStore.subscribe((state, prevState) => {
      if (state.billId !== billId || state.step === prevState.step) return;
      if (syncingFromRoute.current) return;
      navigate(`/session/${sessionId}/bill/${billId}/step/${state.step}`);
    });
    return unsubscribe;
  }, [sessionId, billId, navigate]);

  useEffect(() => {
    if (useBillStore.getState().step !== step) {
      syncingFromRoute.current = true;
      useBillStore.getState().goToStep(step);
      syncingFromRoute.current = false;
    }
  }, [step]);

  useEffect(() => {
    if (!sessionId || !billId) return;

    const unsubscribe = useBillStore.subscribe((state) => {
      // Guard against committing stale state mid-hydration (e.g. the tail
      // end of a previous bill's subscription firing after navigation).
      if (state.billId !== billId) return;

      useSessionStore.getState().updateBill(sessionId, billId, {
        items: state.items,
        taxAmount: state.taxAmount,
        currency: state.currency,
        exchangeRate: state.exchangeRate,
        exchangeRateDate: state.exchangeRateDate,
        exchangeRateIsOverride: state.exchangeRateIsOverride,
        title: state.title,
      });
      useSessionStore.getState().setSessionPeople(sessionId, state.people);
    });

    return unsubscribe;
  }, [sessionId, billId]);

  // Keeps this bill's "claimed by" state and fraction-correctness reads
  // live while the creator sits in the editor — without this, joiner
  // claims/unclaims/item-adds only ever appeared after navigating away and
  // back (BillEditorPage's hydration effect above is one-shot). Mirrors
  // LiveSessionPanel.tsx's connectLiveSync usage; only billStore's items
  // and people are updated (via syncItemsFromLive), never step/title, so
  // the creator's place in the wizard isn't disturbed by a background
  // refresh.
  useEffect(() => {
    if (!sessionId || !billId || !liveCode) return;

    // See createStaleResponseGuard's comment: a single edit here (e.g. an
    // item's split-type change) can trigger several SSE events in quick
    // succession, each kicking off its own refresh — guard against an
    // earlier-triggered-but-slower-to-resolve refresh clobbering the
    // result of a later one that already applied.
    const applyIfLatest = createStaleResponseGuard();

    const refresh = () => {
      applyIfLatest(getLiveSession(liveCode), (liveSession) => {
        useSessionStore.getState().mergeLiveSnapshot(sessionId, liveSession);
        const updatedSession = useSessionStore.getState().getSession(sessionId);
        const updatedBill = useSessionStore.getState().getBill(sessionId, billId);
        if (updatedBill && updatedSession) {
          useBillStore.getState().syncItemsFromLive(billId, updatedBill.items, updatedSession.people);
        }
      }).catch(() => {
        // Transient refresh failures aren't worth surfacing here — the
        // next poll/event will retry, matching LiveSessionPanel/JoinerSessionView.
      });
    };

    const handle = connectLiveSync(liveCode, {
      baseUrl: LIVE_SERVER_URL,
      onStatusChange: () => {},
      onEvent: refresh,
      onPoll: refresh,
    });

    return () => handle.disconnect();
  }, [sessionId, billId, liveCode]);

  useDocumentTitle();

  if (!sessionId || !billId) return null;

  const renderStep = () => {
    switch (step) {
      case 1:
        return <ItemsInput />;
      case 2:
        return <ItemAssignment />;
      case 3:
        return <BillSummary />;
      default:
        return <ItemsInput />;
    }
  };

  return (
    <div>
      <div className="mb-4 no-print flex justify-between items-center gap-2">
        <BackLink to={`/session/${sessionId}`}>← Back to Session</BackLink>
        <IconButton
          onClick={() => setBillSettingsOpen(true)}
          aria-label="Bill Settings"
          title="Bill Settings"
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        />
      </div>
      <StepIndicator />
      {renderStep()}

      <BillSettingsModal isOpen={billSettingsOpen} onClose={() => setBillSettingsOpen(false)} sessionCurrency={sessionCurrency} billDate={billDate} />
    </div>
  );
};

export default BillEditorPage;
