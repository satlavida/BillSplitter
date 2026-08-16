import { useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import useSessionStore from '../sessionStore';
import useBillStore, { useBillStep, useDocumentTitle } from '../billStore';
import { getLiveSession, LIVE_SERVER_URL } from '../lib/liveApi';
import { connectLiveSync } from '../lib/liveSync';
import StepIndicator from '../Components/StepIndicator';
import PeopleInput from '../Components/PeopleInput';
import ItemsInput from '../Components/ItemsInput';
import ItemAssignment from '../Components/ItemAssignment';
import BillSummary from '../Components/BillSummary';

/**
 * Scoped editor for a single bill within a session. billStore is a
 * non-persisted scratch editor here: hydrated from sessionStore on entry,
 * and every change is committed back to sessionStore via a subscription
 * (same "secondary store synced against a primary store" pattern already
 * used by passAndSplitStore, one layer up).
 */
const BillEditorPage = () => {
  const { sessionId, billId } = useParams<{ sessionId: string; billId: string }>();
  const navigate = useNavigate();
  const step = useBillStep();
  const liveCode = useSessionStore((s) => (sessionId ? s.getSession(sessionId)?.liveCode : undefined) ?? null);

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
  // are updated (via syncItemsFromLive), never step/people/title, so the
  // creator's place in the wizard isn't disturbed by a background refresh.
  useEffect(() => {
    if (!sessionId || !billId || !liveCode) return;

    const refresh = () => {
      getLiveSession(liveCode)
        .then((liveSession) => {
          useSessionStore.getState().mergeLiveSnapshot(sessionId, liveSession);
          const updatedBill = useSessionStore.getState().getBill(sessionId, billId);
          if (updatedBill) useBillStore.getState().syncItemsFromLive(billId, updatedBill.items);
        })
        .catch(() => {
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
        return <PeopleInput />;
      case 2:
        return <ItemsInput />;
      case 3:
        return <ItemAssignment />;
      case 4:
        return <BillSummary />;
      default:
        return <PeopleInput />;
    }
  };

  return (
    <div>
      <div className="mb-4 no-print">
        <Link to={`/session/${sessionId}`} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
          ← Back to Session
        </Link>
      </div>
      <StepIndicator />
      {renderStep()}
    </div>
  );
};

export default BillEditorPage;
