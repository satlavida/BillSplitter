import useToastStore from '../toastStore';
import { Card } from '../ui/components';

// Short rolling list of recent live-session events (joins, claims — see
// toastStore.ts's recentEvents, populated by LiveSessionPanel.tsx's toast
// triggers) for the desktop/tablet right column and the mobile right-side
// panel. Deliberately NOT the full persisted history ActivityLogPage.tsx
// shows — this is a lightweight, client-side, ephemeral echo of the last
// few toasts, not a fetched/paginated log.
const ActivityFeedMini = () => {
  const recentEvents = useToastStore((s) => s.recentEvents);

  return (
    <Card>
      <h3 className="font-medium mb-2 text-zinc-800 dark:text-white transition-colors">Recent activity</h3>
      {recentEvents.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Nothing yet.</p>
      ) : (
        <ul className="space-y-1" data-testid="right-panel-activity-feed">
          {recentEvents.map((event) => (
            <li key={event.id} className="text-sm text-zinc-700 dark:text-zinc-300">
              {event.message}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
};

export default ActivityFeedMini;
