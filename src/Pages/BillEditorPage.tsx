import { useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import useSessionStore from '../sessionStore';
import useBillStore, { useBillStep, useDocumentTitle } from '../billStore';
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
