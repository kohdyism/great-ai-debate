import { useRef, useState } from 'react';
import type { HostEngine } from '../lib/engine';
import type { Content, PrivateState, RouletteMode, Settings, TeamId } from '../lib/types';
import { uid } from '../lib/util';
import { Card, ConfirmButton, NumInput } from './ui';

type Sub = 'facts' | 'scenarios' | 'devil' | 'roulette' | 'settings';

export default function ContentEditor({ p, e }: { p: PrivateState; e: HostEngine }) {
  const [sub, setSub] = useState<Sub>('facts');
  const c = p.content;
  const set = (fn: (c: Content) => void) => e.setContent((x) => (fn(x), x));
  const fileRef = useRef<HTMLInputElement>(null);
  const usedBadge = (id: string) =>
    p.used[id] ? (
      <button
        className="chip bg-white/10 text-white/60 hover:bg-white/20"
        title="Used this show — click to make available again"
        onClick={() => e.updatePriv((pp) => (pp.used = Object.fromEntries(Object.entries(pp.used).filter(([k]) => k !== id))))}
      >
        used ↺
      </button>
    ) : null;

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(c, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'great-ai-debate-content.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importJson = async (f: File) => {
    try {
      const data = JSON.parse(await f.text()) as Content;
      if (!Array.isArray(data.facts) || !Array.isArray(data.roulette) || !Array.isArray(data.scenarios) || !Array.isArray(data.devil)) throw new Error('bad');
      e.setContent(() => ({ ...data, settings: { ...c.settings, ...(data.settings ?? {}) } }));
      e.toast('Content imported.', 'ok');
    } catch {
      e.toast('That file is not a valid content export.', 'error');
    }
  };

  return (
    <div className="space-y-3 max-w-6xl">
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ['facts', `Fact or Fiction (${c.facts.length})`],
            ['scenarios', `Hot Seat (${c.scenarios.length})`],
            ['devil', `Devil's Advocate (${c.devil.length})`],
            ['roulette', `AI Roulette (${c.roulette.reduce((a, x) => a + x.questions.length, 0)})`],
            ['settings', 'Timings & points'],
          ] as [Sub, string][]
        ).map(([id, label]) => (
          <button key={id} className={`btn-sm ${sub === id ? 'btn-white' : 'btn-ghost'}`} onClick={() => setSub(id)}>
            {label}
          </button>
        ))}
        <div className="flex-1" />
        <button className="btn-ghost btn-sm" onClick={e.resetUsed}>
          ↺ Reset question history
        </button>
        <button className="btn-ghost btn-sm" onClick={exportJson}>
          ⤓ Export JSON
        </button>
        <button className="btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
          ⤒ Import JSON
        </button>
        <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(ev) => ev.target.files?.[0] && void importJson(ev.target.files[0])} />
        <ConfirmButton className="btn-danger btn-sm" msg="Replace ALL questions with the defaults? Your edits will be lost (export first if unsure)." onConfirm={e.restoreDefaultContent}>
          Restore defaults
        </ConfirmButton>
      </div>
      <p className="text-xs text-white/50">Changes save instantly in this browser. Questions marked “used” are skipped by random draws until you reset the history.</p>

      {sub === 'facts' && (
        <Card
          title="Fact or Fiction statements"
          right={
            <button className="btn-gold btn-sm" onClick={() => set((x) => x.facts.push({ id: uid('f'), statement: 'New statement', kind: 'fact', answer: 'FACT', explanation: '', points: 10 }))}>
              + Add statement
            </button>
          }
        >
          <p className="text-xs text-white/50 mb-2">
            <b>Factual</b> items need a defensible FACT/FICTION answer and an explanation. Contested opinions should be <b>Debate statements</b> — the stage labels them as such and teams earn points for the best argument instead.
          </p>
          <div className="space-y-2">
            {c.facts.map((f, i) => (
              <div key={f.id} className="rounded-lg border border-white/10 p-2 grid grid-cols-[1fr_auto] gap-2">
                <div className="space-y-1.5">
                  <textarea className="inp text-sm" rows={2} value={f.statement} onChange={(ev) => set((x) => (x.facts[i].statement = ev.target.value))} aria-label="Statement" />
                  <textarea className="inp text-xs" rows={2} placeholder="Explanation shown after the reveal" value={f.explanation} onChange={(ev) => set((x) => (x.facts[i].explanation = ev.target.value))} aria-label="Explanation" />
                </div>
                <div className="flex flex-col gap-1.5 w-40">
                  <select
                    className="inp !py-1 text-xs"
                    value={f.kind}
                    onChange={(ev) =>
                      set((x) => {
                        x.facts[i].kind = ev.target.value as 'fact' | 'debate';
                        x.facts[i].answer = ev.target.value === 'fact' ? x.facts[i].answer ?? 'FACT' : null;
                      })
                    }
                  >
                    <option value="fact">Factual</option>
                    <option value="debate">Debate statement</option>
                  </select>
                  {f.kind === 'fact' && (
                    <select className="inp !py-1 text-xs" value={f.answer ?? 'FACT'} onChange={(ev) => set((x) => (x.facts[i].answer = ev.target.value as 'FACT' | 'FICTION'))}>
                      <option value="FACT">Answer: FACT</option>
                      <option value="FICTION">Answer: FICTION</option>
                    </select>
                  )}
                  <label className="text-xs flex items-center gap-1">
                    Points <NumInput value={f.points} onChange={(n) => set((x) => (x.facts[i].points = n))} className="!w-16" />
                  </label>
                  <div className="flex gap-1">
                    {usedBadge(f.id)}
                    <button className="btn-danger btn-sm ml-auto" onClick={() => window.confirm('Delete this statement?') && set((x) => x.facts.splice(i, 1))}>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {sub === 'scenarios' && (
        <Card title="Hot Seat scenarios" right={<button className="btn-gold btn-sm" onClick={() => set((x) => x.scenarios.push({ id: uid('s'), text: 'New scenario?', points: 10 }))}>+ Add scenario</button>}>
          <div className="space-y-2">
            {c.scenarios.map((sc, i) => (
              <div key={sc.id} className="flex gap-2 items-start">
                <textarea className="inp text-sm" rows={2} value={sc.text} onChange={(ev) => set((x) => (x.scenarios[i].text = ev.target.value))} aria-label="Scenario" />
                <div className="flex flex-col gap-1 w-32">
                  <label className="text-xs flex items-center gap-1">
                    Pts <NumInput value={sc.points} onChange={(n) => set((x) => (x.scenarios[i].points = n))} className="!w-16" />
                  </label>
                  <div className="flex gap-1">
                    {usedBadge(sc.id)}
                    <button className="btn-danger btn-sm ml-auto" onClick={() => window.confirm('Delete this scenario?') && set((x) => x.scenarios.splice(i, 1))}>
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {sub === 'devil' && (
        <Card title="Devil's Advocate challenges">
          <div className="grid grid-cols-2 gap-3">
            {(['ban', 'embrace'] as TeamId[]).map((t) => (
              <div key={t}>
                <div className="flex items-center justify-between mb-2">
                  <div className={`font-display text-sm ${t === 'embrace' ? 'text-embrace-bright' : 'text-ban-bright'}`}>For Team {t === 'embrace' ? 'Embrace' : 'Ban'}</div>
                  <button className="btn-gold btn-sm" onClick={() => set((x) => x.devil.push({ id: uid('dv'), team: t, text: 'New challenge', points: 15 }))}>
                    + Add
                  </button>
                </div>
                <div className="space-y-2">
                  {c.devil.map((d, i) =>
                    d.team !== t ? null : (
                      <div key={d.id} className="flex gap-1.5 items-start">
                        <textarea className="inp text-sm" rows={2} value={d.text} onChange={(ev) => set((x) => (x.devil[i].text = ev.target.value))} aria-label="Challenge" />
                        <div className="flex flex-col gap-1">
                          {usedBadge(d.id)}
                          <button className="btn-danger btn-sm" onClick={() => window.confirm('Delete this challenge?') && set((x) => x.devil.splice(i, 1))}>
                            ✕
                          </button>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {sub === 'roulette' && (
        <div className="grid grid-cols-2 gap-3">
          {c.roulette.map((cat, ci) => (
            <Card key={cat.id} title={`Segment ${ci + 1}`}>
              <div className="grid grid-cols-[1fr_150px] gap-1.5">
                <input className="inp !py-1 font-display" value={cat.name} onChange={(ev) => set((x) => (x.roulette[ci].name = ev.target.value.toUpperCase()))} aria-label="Category name" />
                <select className="inp !py-1 text-xs" value={cat.mode} onChange={(ev) => set((x) => (x.roulette[ci].mode = ev.target.value as RouletteMode))} aria-label="Special mechanic">
                  <option value="devil">Devil's advocate</option>
                  <option value="hot">Hot take</option>
                  <option value="impossible">Impossible question</option>
                  <option value="switch">Switch sides</option>
                  <option value="ten">10-second timer</option>
                  <option value="wild">Wild card</option>
                  <option value="audience">Audience decides team</option>
                  <option value="double">Double or nothing</option>
                </select>
                <input className="inp !py-1 text-xs col-span-2" value={cat.blurb} onChange={(ev) => set((x) => (x.roulette[ci].blurb = ev.target.value))} aria-label="Tagline" />
              </div>
              <div className="space-y-1 mt-2">
                {cat.questions.map((q, qi) => (
                  <div key={q.id} className="flex gap-1 items-start">
                    <textarea className="inp text-xs" rows={2} value={q.text} onChange={(ev) => set((x) => (x.roulette[ci].questions[qi].text = ev.target.value))} aria-label="Question" />
                    <div className="flex flex-col gap-1">
                      {usedBadge(q.id)}
                      <button className="btn-danger btn-sm" onClick={() => set((x) => x.roulette[ci].questions.splice(qi, 1))} aria-label="Delete question">
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button className="btn-ghost btn-sm mt-2" onClick={() => set((x) => x.roulette[ci].questions.push({ id: uid('rq'), text: 'New challenge' }))}>
                + Add question
              </button>
            </Card>
          ))}
        </div>
      )}

      {sub === 'settings' && <SettingsCard s={c.settings} onChange={(k, v) => set((x) => (x.settings[k] = v))} />}
    </div>
  );
}

function SettingsCard({ s, onChange }: { s: Settings; onChange: (k: keyof Settings, v: number) => void }) {
  const rows: [keyof Settings, string, string][] = [
    ['openingSec', 'Opening statement (Round 1)', 'seconds'],
    ['closingSec', 'Closing statement (Round 5)', 'seconds'],
    ['prepSec', 'Preparation time', 'seconds'],
    ['responseSec', 'Response time', 'seconds'],
    ['challengeSec', 'Challenge / rebuttal time', 'seconds'],
    ['tenSec', '10-second challenge', 'seconds'],
    ['rouletteSpinMs', 'Wheel spin duration', 'ms'],
    ['pollPoints', 'Points for winning an audience vote', 'pts'],
    ['roulettePoints', 'Default AI Roulette points', 'pts'],
    ['doubleStake', 'Double or Nothing default stake', 'pts'],
    ['devilBonus', "Devil's Advocate bonus", 'pts'],
  ];
  return (
    <Card title="Timings & points">
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 max-w-3xl">
        {rows.map(([k, label, unit]) => (
          <label key={k} className="flex items-center justify-between gap-2 text-sm">
            <span>{label}</span>
            <span className="flex items-center gap-1">
              <NumInput value={s[k]} min={0} onChange={(n) => onChange(k, Math.max(0, n))} className="!w-24" />
              <span className="text-xs text-white/40 w-12">{unit}</span>
            </span>
          </label>
        ))}
      </div>
    </Card>
  );
}
