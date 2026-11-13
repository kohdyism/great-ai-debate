import { useMemo, useState } from 'react';
import { aiStatements, getApiKey, randomTemplate, setApiKey } from '../lib/generate';
import { DEFAULT_TOPICS, buildSchedule, makeTeams } from '../lib/content';
import type { HostEngine } from '../lib/engine';
import type { PracticeSettings, PublicState, Settings, Team, Topic } from '../lib/types';
import { clone, uid } from '../lib/util';
import { Card } from './ui';

export default function Setup({ s, e, onDone }: { s: PublicState; e: HostEngine; onDone: () => void }) {
  const [teams, setTeams] = useState<Team[]>(() => clone(s.teams));
  const [topics, setTopics] = useState<Topic[]>(() => clone(s.topics));
  const [settings, setSettings] = useState<Settings>(() => ({ ...s.settings }));
  const [practice, setPractice] = useState<PracticeSettings>(() => clone(s.practice));
  const preview = useMemo(() => buildSchedule(teams, topics, practice), [teams, topics, practice]);
  const [pBusy, setPBusy] = useState(false);
  const generatePractice = async () => {
    const t = practice.topic;
    if (!t.title.trim()) return e.toast('Type a warm-up topic first.', 'warn');
    setPBusy(true);
    const r = await aiStatements(t.title, 6, t.questions.map((q) => q.text).filter(Boolean));
    setPBusy(false);
    setPractice((p) => ({ ...p, topic: { ...p.topic, questions: r.statements.map((text) => ({ id: uid('q'), text })) } }));
    if (r.error) e.toast('AI unavailable — used the built-in generator.', 'warn');
  };
  const editPracticeQ = (qi: number, text: string) =>
    setPractice((p) => ({ ...p, topic: { ...p.topic, questions: p.topic.questions.map((q, j) => (j === qi ? { ...q, text } : q)) } }));
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [key, setKey] = useState(getApiKey);
  const [showKey, setShowKey] = useState(false);

  const generate = async (i: number) => {
    const t = topics[i];
    if (!t.title.trim()) return e.toast('Type a topic first, then press Generate.', 'warn');
    const filled = t.questions.filter((q) => q.text.trim());
    if (filled.length && !window.confirm(`Replace the ${filled.length} statement(s) in “${t.title}” with new ones?`)) return;
    setBusy((b) => ({ ...b, [t.id]: true }));
    const r = await aiStatements(t.title, 6, filled.map((q) => q.text));
    setBusy((b) => ({ ...b, [t.id]: false }));
    setTopics((cur) => cur.map((x) => (x.id === t.id ? { ...x, questions: r.statements.map((text) => ({ id: uid('q'), text })) } : x)));
    if (r.error) e.toast(`AI unavailable (${r.error.slice(0, 80)}) — used the built-in generator instead.`, 'warn');
    else e.toast(r.source === 'ai' ? `Claude wrote 6 statements for “${t.title}”.` : `6 statements generated for “${t.title}”. Edit any you like.`, 'ok');
  };
  const reroll = (i: number, qi: number) =>
    editTopic(i, (x) => void (x.questions[qi].text = randomTemplate(x.title, x.questions.map((q) => q.text))));
  const nameOf = (id: string) => teams.find((t) => t.id === id)?.name || '—';
  const started = s.scoreLog.length > 0 || s.schedule.some((r) => r.debates.some((d) => d.question));
  const shapeChanges =
    teams.length !== s.teams.length || topics.length !== s.topics.length || topics.some((t, i) => t.id !== s.topics[i]?.id) || practice.enabled !== s.practice.enabled || practice.debates !== s.practice.debates;

  const setCount = (n: number) => setTeams((cur) => makeTeams(Math.max(2, Math.min(8, n)), cur));
  const editTopic = (i: number, fn: (t: Topic) => void) =>
    setTopics((cur) => {
      const next = clone(cur);
      fn(next[i]);
      return next;
    });

  const save = () => {
    const cleanTopics = topics.map((t, i) => ({ ...t, title: t.title.trim() || `Topic ${i + 1}`, questions: t.questions.filter((q) => q.text.trim()) }));
    if (cleanTopics.some((t) => t.questions.length === 0)) return window.alert('Every topic needs at least one question.');
    const cleanTeams = teams.map((t, i) => ({ ...t, name: t.name.trim() || `Team ${i + 1}` }));
    if (started && shapeChanges && !window.confirm('You changed the number of teams or rounds. This makes a new schedule and resets all scores. Continue?')) return;
    const cleanPractice = {
      ...practice,
      debates: Math.max(1, Math.min(practice.debates, cleanTeams.length)),
      topic: { ...practice.topic, title: practice.topic.title.trim() || 'Warm-up', questions: practice.topic.questions.filter((q) => q.text.trim()) },
    };
    if (cleanPractice.enabled && !cleanPractice.topic.questions.length) return window.alert('The practice round needs at least one statement (or switch it off).');
    e.applySetup(cleanTeams, cleanTopics, settings, cleanPractice);
    onDone();
  };

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4 pb-32">
      <div>
        <h1 className="font-display text-3xl">Set up your show</h1>
        <p className="text-white/60 text-sm mt-1">Three steps. Everything saves in this browser. You can come back and edit any time.</p>
      </div>

      {/* 1. Teams */}
      <Card title="① How many teams?">
        <div className="flex items-center gap-3">
          <button className="btn-ghost btn-lg w-14" onClick={() => setCount(teams.length - 1)} aria-label="Fewer teams">
            −
          </button>
          <div className="font-condensed text-6xl w-20 text-center tabular-nums">{teams.length}</div>
          <button className="btn-ghost btn-lg w-14" onClick={() => setCount(teams.length + 1)} aria-label="More teams">
            +
          </button>
          <div className="text-sm text-white/60 ml-3">
            = <b className="text-white">{teams.length} debates per round</b>, {teams.length * topics.length} debates in total.
            <br />
            Every team argues FOR once and AGAINST once in each round.
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
          {teams.map((t, i) => (
            <label key={t.id} className="text-xs text-white/50">
              Team {i + 1} name
              <input
                className="inp mt-1 font-semibold"
                value={t.name}
                onChange={(ev) => setTeams((cur) => cur.map((x, j) => (j === i ? { ...x, name: ev.target.value } : x)))}
              />
            </label>
          ))}
        </div>
      </Card>

      {/* Practice */}
      <Card
        title="Practice round (warm-up, no points)"
        right={
          <button className={`btn-sm ${practice.enabled ? 'btn-gold' : 'btn-ghost'}`} onClick={() => setPractice((p) => ({ ...p, enabled: !p.enabled }))}>
            {practice.enabled ? '✓ Included' : 'Off — click to include'}
          </button>
        }
      >
        {practice.enabled ? (
          <>
            <p className="text-xs text-white/55 mb-3">
              Runs before Round 1 with the full format (spin → openings → counters → summaries → vote) so teams learn the flow and the audience tries voting. Results don’t count.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm">Practice debates:</span>
              {Array.from({ length: Math.min(teams.length, 4) }, (_, i) => i + 1).map((n) => (
                <button key={n} className={`btn-sm ${practice.debates === n ? 'btn-white' : 'btn-ghost'}`} onClick={() => setPractice((p) => ({ ...p, debates: n }))}>
                  {n}
                </button>
              ))}
              <span className="text-xs text-white/40">(1 is usually enough)</span>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <input
                className="inp font-display !py-1.5"
                value={practice.topic.title}
                placeholder="Warm-up topic, e.g. Just for fun"
                onChange={(ev) => setPractice((p) => ({ ...p, topic: { ...p.topic, title: ev.target.value } }))}
                aria-label="Practice topic"
              />
              <button className="btn-gold btn-sm whitespace-nowrap" disabled={pBusy} onClick={() => void generatePractice()}>
                {pBusy ? 'Generating…' : '✨ Generate statements'}
              </button>
            </div>
            <div className="mt-2 grid md:grid-cols-2 gap-1.5">
              {practice.topic.questions.map((q, qi) => (
                <div key={q.id} className="flex items-center gap-2">
                  <span className="w-5 text-right font-condensed text-white/50">{qi + 1}</span>
                  <input className="inp !py-1.5" value={q.text} onChange={(ev) => editPracticeQ(qi, ev.target.value)} aria-label={`Practice statement ${qi + 1}`} />
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-xs text-white/50">No practice round — the show starts straight with Round 1.</p>
        )}
      </Card>

      {/* 2. Topics */}
      <Card
        title={`② Your ${topics.length} rounds — one topic each, with questions for the wheel`}
        right={
          <>
            <button className="btn-ghost btn-sm" onClick={() => window.confirm('Replace all topics with the example questions?') && setTopics(clone(DEFAULT_TOPICS))}>
              Use examples
            </button>
            <button
              className="btn-ghost btn-sm"
              onClick={() =>
                window.confirm('Clear all topics so you can type your own?') &&
                setTopics(topics.map((t) => ({ ...t, title: '', questions: Array.from({ length: 6 }, () => ({ id: uid('q'), text: '' })) })))
              }
            >
              Start blank
            </button>
          </>
        }
      >
        <div className="rounded-lg bg-gold/5 border border-gold/25 p-3 mb-3 text-sm">
          <b className="text-gold">✨ Quick way:</b> type any topic (e.g. “Social media”, “Space travel”, “Fast fashion”) and press <b>Generate</b>. You get 6 statements you can edit.
          <div className="mt-2 text-xs text-white/60">
            {key ? (
              <>
                Using <b className="text-emerald-300">Claude AI</b> for smarter, topic-specific statements.{' '}
                <button className="underline" onClick={() => setShowKey(!showKey)}>
                  Change key
                </button>
              </>
            ) : (
              <>
                Built-in generator active (works offline).{' '}
                <button className="underline text-gold" onClick={() => setShowKey(!showKey)}>
                  Want Claude to write smarter statements? Add an API key
                </button>
              </>
            )}
          </div>
          {showKey && (
            <div className="mt-2 flex gap-2 items-center">
              <input
                type="password"
                className="inp !py-1.5"
                placeholder="sk-ant-… (Anthropic API key from console.anthropic.com)"
                value={key}
                onChange={(ev) => setKey(ev.target.value)}
                aria-label="Anthropic API key"
              />
              <button
                className="btn-white btn-sm whitespace-nowrap"
                onClick={() => {
                  setApiKey(key);
                  setShowKey(false);
                  e.toast(key.trim() ? 'API key saved on this computer only.' : 'API key removed.', 'ok');
                }}
              >
                Save key
              </button>
            </div>
          )}
          {showKey && <p className="text-[11px] text-white/40 mt-1">Stored only in this browser on this laptop. Never sent to the projector, phones or GitHub.</p>}
        </div>
        <p className="text-xs text-white/50 mb-3">
          Write each question as a statement teams can argue <b className="text-embrace-bright">FOR</b> or <b className="text-ban-bright">AGAINST</b>. The wheel only lands on
          questions not yet used in that round — so aim for at least {teams.length} (one per debate); 6 is ideal.
        </p>
        <div className="space-y-4">
          {topics.map((t, i) => {
            const filled = t.questions.filter((q) => q.text.trim()).length;
            return (
              <div key={t.id} className="rounded-xl border border-white/10 p-3 bg-black/20">
                <div className="flex items-center gap-2">
                  <span className="chip bg-gold text-black whitespace-nowrap">ROUND {i + 1}</span>
                  <input
                    className="inp font-display text-lg !py-1.5"
                    value={t.title}
                    placeholder="Type a topic, e.g. Social media"
                    onChange={(ev) => editTopic(i, (x) => void (x.title = ev.target.value))}
                    onKeyDown={(ev) => ev.key === 'Enter' && void generate(i)}
                    aria-label={`Round ${i + 1} topic`}
                  />
                  <button className="btn-gold btn-sm whitespace-nowrap" disabled={busy[t.id]} onClick={() => void generate(i)}>
                    {busy[t.id] ? 'Generating…' : '✨ Generate statements'}
                  </button>
                  {topics.length > 1 && (
                    <button className="btn-danger btn-sm whitespace-nowrap" onClick={() => window.confirm(`Remove Round ${i + 1}?`) && setTopics((cur) => cur.filter((_, j) => j !== i))}>
                      Remove round
                    </button>
                  )}
                </div>
                <div className="mt-2 space-y-1.5">
                  {t.questions.map((q, qi) => (
                    <div key={q.id} className="flex items-center gap-2">
                      <span className="w-6 text-right font-condensed text-lg text-white/50">{qi + 1}</span>
                      <input
                        className="inp !py-1.5"
                        value={q.text}
                        placeholder="e.g. Students should be allowed to use AI in exams."
                        onChange={(ev) => editTopic(i, (x) => void (x.questions[qi].text = ev.target.value))}
                        aria-label={`Round ${i + 1} question ${qi + 1}`}
                      />
                      <button className="btn-ghost btn-sm" title="Swap for another statement" onClick={() => reroll(i, qi)} aria-label="New statement">
                        🎲
                      </button>
                      <button className="btn-ghost btn-sm" onClick={() => editTopic(i, (x) => void x.questions.splice(qi, 1))} aria-label="Delete question">
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <button className="btn-ghost btn-sm" disabled={t.questions.length >= 10} onClick={() => editTopic(i, (x) => void x.questions.push({ id: uid('q'), text: '' }))}>
                    + Add question
                  </button>
                  <span className={`text-xs ${filled < teams.length ? 'text-gold' : 'text-white/40'}`}>
                    {filled} question{filled === 1 ? '' : 's'}
                    {filled < teams.length && ` — fewer than ${teams.length} debates, so some will repeat`}
                  </span>
                </div>
              </div>
            );
          })}
          {topics.length < 5 && (
            <button
              className="btn-ghost w-full"
              onClick={() => setTopics((cur) => [...cur, { id: uid('t'), title: '', questions: Array.from({ length: 6 }, () => ({ id: uid('q'), text: '' })) }])}
            >
              + Add another round
            </button>
          )}
        </div>
      </Card>

      {/* 3. Timings */}
      <Card title="③ Timings & points">
        <p className="text-xs text-white/50 mb-3">
          Each debate runs like a proper debate: <b className="text-embrace-bright">FOR opening</b> → <b className="text-ban-bright">AGAINST opening</b> →{' '}
          <b className="text-embrace-bright">FOR counter</b> → <b className="text-ban-bright">AGAINST counter</b> → <b className="text-ban-bright">AGAINST summary</b> →{' '}
          <b className="text-embrace-bright">FOR summary</b> (the side that opened gets the last word).
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {(
            [
              ['prepSec', 'Preparation (sec)'],
              ['speechSec', 'Opening speech (sec)'],
              ['rebuttalSec', 'Counter-argument (sec, 0 = skip)'],
              ['summarySec', 'Closing summary (sec, 0 = skip)'],
              ['winPoints', 'Points for a win'],
              ['drawPoints', 'Points each for a draw'],
            ] as [keyof Settings, string][]
          ).map(([k, label]) => (
            <label key={k} className="text-xs text-white/50">
              {label}
              <input
                type="number"
                min={0}
                className="inp mt-1 tabular-nums"
                value={settings[k]}
                onChange={(ev) => setSettings({ ...settings, [k]: Math.max(0, Number(ev.target.value) || 0) })}
              />
            </label>
          ))}
        </div>
      </Card>

      {/* Preview */}
      <Card title="Your schedule (made automatically)">
        <div className="grid md:grid-cols-4 gap-3">
          {preview.map((r, ri) => (
            <div key={ri} className="rounded-lg border border-white/10 p-2">
              <div className="font-display text-sm text-gold">
                {r.practice ? `Practice: ${practice.topic.title}` : `Round ${ri + (preview[0]?.practice ? 0 : 1)}: ${topics.find((t) => t.id === r.topicId)?.title ?? ''}`}
              </div>
              <ol className="mt-1 space-y-0.5 text-xs">
                {r.debates.map((d, di) => (
                  <li key={di}>
                    <span className="text-white/40">{di + 1}.</span> <b className="text-embrace-bright">{nameOf(d.forTeam)}</b> <span className="text-white/40">for ·</span>{' '}
                    <b className="text-ban-bright">{nameOf(d.againstTeam)}</b> <span className="text-white/40">against</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </Card>

      <div className="fixed bottom-0 left-0 right-0 bg-[#070910]/95 border-t border-white/10 p-3 flex justify-center gap-3 z-40">
        <button className="btn-gold btn-lg min-w-[320px]" onClick={save}>
          ✓ Save & go to the show
        </button>
      </div>
    </div>
  );
}
