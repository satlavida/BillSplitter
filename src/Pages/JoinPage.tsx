import { useParams, Link } from 'react-router-dom';

/**
 * Placeholder for the live-session join flow (wired but not functional
 * until the Go backend + live collaboration phase lands).
 */
const JoinPage = () => {
  const { code } = useParams<{ code: string }>();

  return (
    <div className="text-center py-8">
      <h2 className="text-xl font-semibold mb-2 text-zinc-800 dark:text-white transition-colors">Join Session {code}</h2>
      <p className="text-zinc-600 dark:text-zinc-400 mb-4 transition-colors">Live, shared sessions are coming in a future update.</p>
      <Link to="/" className="text-blue-600 dark:text-blue-400 hover:underline">
        Go home
      </Link>
    </div>
  );
};

export default JoinPage;
