import { StrictMode, Suspense, lazy, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import Landing from './Landing';

const HostApp = lazy(() => import('./host/HostApp'));
const StageApp = lazy(() => import('./stage/StageApp'));
const AudienceApp = lazy(() => import('./audience/AudienceApp'));

/** Hash routes work on any static host with no server config:
 *  #/            landing
 *  #/host        host dashboard
 *  #/stage/ROOM  projector
 *  #/play/ROOM   audience phones   (also ?room=ROOM)
 */
function parse() {
  const h = window.location.hash.replace(/^#\/?/, '');
  const [route, arg] = h.split('/');
  const q = new URLSearchParams(window.location.search).get('room');
  return { route: route || (q ? 'play' : ''), arg: arg || q || null };
}

function App() {
  const [r, setR] = useState(parse);
  useEffect(() => {
    const on = () => setR(parse());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  useEffect(() => {
    document.title =
      r.route === 'host' ? 'HOST · The Great AI Debate' : r.route === 'stage' ? 'STAGE · The Great AI Debate' : r.route === 'play' ? 'Vote · The Great AI Debate' : 'The Great AI Debate · Live';
  }, [r.route]);
  return (
    <Suspense fallback={<div className="min-h-screen bg-ink" />}>
      {r.route === 'host' ? <HostApp /> : r.route === 'stage' ? <StageApp room={r.arg} /> : r.route === 'play' ? <AudienceApp room={r.arg} /> : <Landing />}
    </Suspense>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
