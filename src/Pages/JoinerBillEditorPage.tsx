import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getJoiner, getLiveSession, LIVE_SERVER_URL } from '../lib/liveApi';
import { getStoredJoinerId, getStoredJoinerToken } from '../lib/joinerStorage';
import { markBillVisited } from '../lib/joinerVisitTracking';
import { connectLiveSync } from '../lib/liveSync';
import { usePresenceHeartbeat } from '../hooks/usePresenceHeartbeat';
import JoinerItemRow from '../Components/joiner/JoinerItemRow';
import JoinerItemListRow from '../Components/joiner/JoinerItemListRow';
import AddItemForm from '../Components/joiner/AddItemForm';
import JoinerScanReceiptButton from '../Components/joiner/JoinerScanReceiptButton';
import { Alert, Card, ProgressBar, Checkbox, Button } from '../ui/components';
import BillTotalsSummary from '../Components/BillTotalsSummary';
import { toSessionCurrency } from '../lib/currencyConvert';
import type { LiveSession } from '../schemas/live.schema';

const STEPS = [
  { number: 1, title: 'Items' },
  { number: 2, title: 'Assign' },
  { number: 3, title: 'Summary' },
];

// A joiner-facing mirror of BillEditorPage.tsx's step-wise wizard (same 3
// steps: Items/Assign/Summary, same /step/:n route shape — see App.tsx),
// reusing the existing joiner components (JoinerItemRow, AddItemForm) rather
// than the creator's billStore-backed step components, since those are
// hard-wired to local scratch-editor state a joiner's remote/live data
// doesn't fit. People are session-scoped and shown in the session-level
// people list, not in this per-bill wizard. Read-only when the session's
// permissionMode is read_only or it's been settled — same gate
// JoinerSessionView applies.
const JoinerBillEditorPage = () => {
  const { code, billId, step: stepParam } = useParams<{ code: string; billId: string; step: string }>();
  const navigate = useNavigate();
  const step = Number(stepParam) || 1;

  const [session, setSession] = useState<LiveSession | null>(null);
  const [myPersonId, setMyPersonId] = useState<string | null>(null);
  const [joinerToken, setJoinerToken] = useState<string | null>(null);
  const [identityError, setIdentityError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Defaults to the bill's own currency — that's the whole point of
  // per-bill currency — with an opt-in toggle to view it converted into the
  // session's currency instead. Local UI state only, not persisted.
  const [showSessionCurrency, setShowSessionCurrency] = useState(false);

  usePresenceHeartbeat(code ?? null, myPersonId, joinerToken);

  // This route is only ever reached via a link from JoinerSessionView,
  // which only renders once a joiner is approved and stored (see
  // joinerStorage.ts) — resolve that same identity here rather than
  // threading it through as route/nav state, so a reload/direct link works.
  useEffect(() => {
    if (!code) return;
    const storedId = getStoredJoinerId(code);
    const storedToken = getStoredJoinerToken(code);
    if (!storedId) {
      setIdentityError(true);
      return;
    }
    setJoinerToken(storedToken);
    let cancelled = false;
    getJoiner(code, storedId)
      .then((j) => {
        if (cancelled) return;
        if (j.status !== 'approved' || !j.personId) {
          setIdentityError(true);
          return;
        }
        setMyPersonId(j.personId);
      })
      .catch(() => {
        if (!cancelled) setIdentityError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  const refreshRef = useRef<() => void>(() => {});
  refreshRef.current = () => {
    if (!code) return;
    getLiveSession(code)
      .then(setSession)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load session'));
  };

  useEffect(() => {
    if (!code || !billId) return;
    markBillVisited(code, billId);
  }, [code, billId]);

  useEffect(() => {
    if (!code) return;
    refreshRef.current();
    const handle = connectLiveSync(code, {
      baseUrl: LIVE_SERVER_URL,
      onStatusChange: () => {},
      onEvent: () => refreshRef.current(),
      onPoll: () => refreshRef.current(),
    });
    return () => handle.disconnect();
  }, [code]);

  if (!code || !billId) return null;

  if (identityError) {
    return (
      <div>
        <p className="text-zinc-600 dark:text-zinc-400 mb-4">You need to join this session first.</p>
        <Link to={`/join/${code}`} className="text-blue-600 dark:text-blue-400 hover:underline">
          Go to join page
        </Link>
      </div>
    );
  }

  if (!session || !myPersonId) {
    return <p className="text-zinc-600 dark:text-zinc-400 transition-colors">Loading…</p>;
  }

  const bill = session.bills.find((b) => b.id === billId);
  if (!bill) {
    return (
      <div>
        <p className="text-zinc-600 dark:text-zinc-400 mb-4">Bill not found.</p>
        <Link to={`/join/${code}`} className="text-blue-600 dark:text-blue-400 hover:underline">
          ← Back
        </Link>
      </div>
    );
  }

  const nameFor = (personId: string) => session.people.find((p) => p.id === personId)?.name ?? 'Someone';
  const readOnly = session.isSettled || session.permissionMode === 'read_only';
  const goToStep = (n: number) => navigate(`/join/${code}/bills/${billId}/step/${n}`);

  const currencyMismatch = bill.currency !== session.currency;
  // Only offer the toggle once a real exchange rate is known — otherwise
  // toSessionCurrency/getEffectiveRate silently falls back to a 1:1 rate,
  // which would look like a conversion happened when it didn't.
  const hasKnownRate = bill.exchangeRate != null;
  const canShowSessionCurrency = currencyMismatch && hasKnownRate;
  const displayCurrency = showSessionCurrency && canShowSessionCurrency ? session.currency : bill.currency;
  const displayAmount = (amount: number) => (showSessionCurrency && canShowSessionCurrency ? toSessionCurrency(amount, bill, session.currency) : amount);

  // Kept in sync with billStore.getDiscountedItemPrice / personTotals.ts's
  // copy of the same formula — duplicated rather than imported since
  // LiveItem's discountType/splitType are plain strings, not the narrower
  // literal unions those helpers are typed against.
  const discountedPrice = (item: (typeof bill.items)[number]) => {
    const price = item.price || 0;
    const discount = item.discount || 0;
    return item.discountType === 'percentage' ? price - (price * discount) / 100 : price - discount;
  };
  const subtotal = bill.items.reduce((sum, item) => sum + discountedPrice(item) * item.quantity, 0);
  const billTotal = subtotal + bill.taxAmount;
  const formatCurrency = (amount: number | null | undefined) => `${displayCurrency} ${displayAmount(amount ?? 0).toFixed(2)}`;

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <Card>
            <h2 className="text-xl font-semibold mb-4 text-zinc-800 dark:text-white transition-colors">What items are you splitting?</h2>
            {bill.items.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">No items yet.</p>
            ) : (
              <ul className="space-y-2 mb-2">
                {bill.items.map((item) => (
                  <JoinerItemListRow
                    key={item.id}
                    code={code}
                    billId={billId}
                    item={item}
                    currency={displayCurrency}
                    unitPrice={displayAmount(discountedPrice(item))}
                    myPersonId={myPersonId}
                    joinerToken={joinerToken}
                    disabled={readOnly}
                    onChanged={refreshRef.current}
                  />
                ))}
              </ul>
            )}
            {bill.items.length > 0 && (
              <BillTotalsSummary subtotal={subtotal} taxAmount={bill.taxAmount} grandTotal={billTotal} formatCurrency={formatCurrency} className="mb-4" />
            )}
            <div className="flex flex-wrap gap-2 items-start">
              <AddItemForm code={code} billId={billId} joinerToken={joinerToken} disabled={readOnly} onAdded={refreshRef.current} />
              <JoinerScanReceiptButton code={code} bill={bill} myPersonId={myPersonId} joinerToken={joinerToken} disabled={readOnly} onScanned={refreshRef.current} />
            </div>
          </Card>
        );
      case 2:
        return (
          <Card>
            <h2 className="text-xl font-semibold mb-4 text-zinc-800 dark:text-white transition-colors">Claim what's yours</h2>
            {bill.items.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">No items to claim yet.</p>
            ) : (
              <ul className="space-y-3">
                {bill.items.map((item) => (
                  <JoinerItemRow
                    key={item.id}
                    code={code}
                    billId={billId}
                    item={{ ...item, price: displayAmount(item.price) }}
                    currency={displayCurrency}
                    myPersonId={myPersonId}
                    joinerToken={joinerToken ?? ''}
                    nameFor={nameFor}
                    disabled={readOnly}
                    onChanged={refreshRef.current}
                  />
                ))}
              </ul>
            )}
          </Card>
        );
      case 3: {
        const claimedCount = bill.items.filter((item) => item.consumedBy.length > 0).length;
        const totalItems = bill.items.length;
        return (
          <Card>
            <h2 className="text-xl font-semibold mb-4 text-zinc-800 dark:text-white transition-colors">Bill Summary</h2>
            {totalItems > 0 && (
              <div className="mb-3">
                <ProgressBar value={(claimedCount / totalItems) * 100} label={`${claimedCount}/${totalItems} claimed`} />
              </div>
            )}
            <p className="text-base text-zinc-500 dark:text-zinc-400 mb-3">
              Paid by {bill.paidByPersonId ? nameFor(bill.paidByPersonId) : 'no one yet'}
              {(() => {
                const payerUpiId = session.people.find((p) => p.id === bill.paidByPersonId)?.upiId;
                return payerUpiId ? (
                  <span className="block text-sm">
                    Pay via UPI: <span className="font-medium text-zinc-800 dark:text-white">{payerUpiId}</span>
                  </span>
                ) : null;
              })()}
            </p>
            <ul className="space-y-3 mb-3">
              {bill.items.map((item) => {
                const unitPrice = displayAmount(discountedPrice(item));
                return (
                  <li
                    key={item.id}
                    className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/40 text-lg font-medium text-zinc-800 dark:text-white transition-colors"
                  >
                    {item.name} — {displayCurrency} {unitPrice.toFixed(2)}
                    {item.quantity > 1 && (
                      <>
                        {' '}
                        × {item.quantity} : {displayCurrency} {(unitPrice * item.quantity).toFixed(2)}
                      </>
                    )}
                    {item.consumedBy.length > 0 && (
                      <span className="block text-sm font-normal text-zinc-600 dark:text-zinc-400">
                        Claimed by {item.consumedBy.map((c) => nameFor(c.personId)).join(', ')}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
            <BillTotalsSummary subtotal={subtotal} taxAmount={bill.taxAmount} grandTotal={billTotal} formatCurrency={formatCurrency} />
          </Card>
        );
      }
      default:
        return null;
    }
  };

  return (
    <div>
      <div className="mb-4 no-print">
        <Button variant="primary" size="sm" onClick={() => navigate(`/join/${code}`)}>
          ← Back to Session
        </Button>
      </div>

      <h1 className="text-lg font-semibold mb-2 text-zinc-800 dark:text-white transition-colors">{bill.title}</h1>

      {canShowSessionCurrency && (
        <div className="mb-3 no-print">
          <Checkbox
            id="show-session-currency"
            checked={showSessionCurrency}
            onChange={(e) => setShowSessionCurrency(e.target.checked)}
            label={`Show in session currency (${session.currency}) instead of ${bill.currency}`}
          />
        </div>
      )}
      {currencyMismatch && !hasKnownRate && (
        <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400 no-print">
          Ask the bill's creator to set an exchange rate in Bill Settings to view this in session currency.
        </p>
      )}

      {readOnly && (
        <Alert type="info" className="mb-4">
          {session.isSettled ? "This session has been settled — items are read-only." : "The host has this session set to view-only."}
        </Alert>
      )}
      {error && <Alert type="error" className="mb-4">{error}</Alert>}

      <div className="mb-8 no-print">
        <div className="flex items-center justify-between">
          {STEPS.map((s) => (
            <div
              key={s.number}
              className="flex flex-col items-center cursor-pointer transition-opacity hover:opacity-80"
              onClick={() => goToStep(s.number)}
              role="button"
              aria-label={`Go to step ${s.number}: ${s.title}`}
              tabIndex={0}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  step >= s.number ? 'bg-blue-600 text-white dark:bg-blue-500' : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400'
                }`}
              >
                {s.number}
              </div>
              <span className="text-xs mt-1 dark:text-zinc-300">{s.title}</span>
            </div>
          ))}
        </div>
      </div>

      {renderStep()}
    </div>
  );
};

export default JoinerBillEditorPage;
