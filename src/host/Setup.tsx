import { useMemo, useState } from 'react';
import { DEFAULT_TOPICS, buildSchedule, makeTeams } from '../lib/content';
import type { HostEngine } from '../lib/engine';
import type { PublicState, Settings, Team, Topic } from '../lib/types';
import { clone, uid } from '../lib/util';
import { Card } from './ui';

export default function Setup({ s, e, onDone }: { s: PublicState; e: HostEngine; onDone: () => void }) {
  const [teams, setTeams] = useState<Team[]>(() => clone(s.teams));
  const [topics, setTopics] = useState<Topic[]>(() => clone(s.topics));
  const [settings, setSettings] = useState<Settings>(() => ({ ...s.settings }));
  const preview = useMemo(() => buildSchedule(teams, topics), [teams, topics]);
  const nameOf = (id: string) => teams.find((t) => t.id === id)?.name || '—';
  const started = s.scoreLog.length > 0 || s.schedule.some((r) => r.debates.some((d) => d.question));
  const shapeChanges =
    teams.length !== s.teams.length || topics.length !== s.topics.length || topics.some((t, i) => t.id !== s.topics[i]?.id);

  const setCount = (n: number) => setTeams((cur) => makeTeams(Math.max(2, Math.min(8, n)), cur));
  const editTopic = (i: number, fn: (t: Topic) => void) =>
    setTopics((cur) => {
      const next = clone(cur);
      fn(next[i]);
      return next;
    });

  const save = () => {
    const cleanTopics = topics.map((t) => ({ ...t, title: t.title.trim() || 'UNTITLED TOPIC', questions: t.questions.filter((q) => q.text.trim()) }));
    if (cleanTopics.some((t) => t.questions.length === 0)) return window.alert('Every topic needs at least one question.');
    const cleanTeams = teams.map((t, i) => ({ ...t, name: t.name.trim() || `Team ${i + 1}` }));
    if (started && shapeChanges && !window.confirm('You changed the number of teams or rounds. This makes a new schedule and resets all scores. Continue?')) return;
    e.applySetup(cleanTeams, cleanTopics, settings);
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
                setTopics(topics.map((t, i) => ({ ...t, title: `TOPIC ${i + 1}`, questions: Array.from({ length: 6 }, () => ({ id: uid('q'), text: '' })) })))
              }
            >
              Start blank
            </button>
          </>
        }
      >
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
                    placeholder="Topic title"
                    onChange={(ev) => editTopic(i, (x) => void (x.title = ev.target.value.toUpperCase()))}
                    aria-label={`Round ${i + 1} topic`}
                  />
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
              onClick={() => setTopics((cur) => [...cur, { id: uid('t'), title: `TOPIC ${cur.length + 1}`, questions: Array.from({ length: 6 }, () => ({ id: uid('q'), text: '' })) }])}
            >
              + Add another round
            </button>
          )}
        </div>
      </Card>

      {/* 3. Timings */}
      <Card title="③ Timings & points">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(
            [
              ['prepSec', 'Preparation (sec)'],
              ['speechSec', 'Each speech (sec)'],
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
        <div className="grid md:grid-cols-3 gap-3">
          {preview.map((r, ri) => (
            <div key={ri} className="rounded-lg border border-white/10 p-2">
              <div className="font-display text-sm text-gold">
                Round {ri + 1}: {topics[ri]?.title}
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
