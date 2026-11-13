import type { HostEngine } from '../lib/engine';
import type { PrivateState, PublicState, TeamId } from '../lib/types';
import { ROUNDS, roundMeta } from '../lib/types';
import { Card, ConfirmButton } from './ui';

export default function HistoryTab({ s, p, e }: { s: PublicState; p: PrivateState; e: HostEngine }) {
  const polls = [...s.pollHistory.filter((x) => x.id !== s.poll?.id), ...(s.poll ? [s.poll] : [])].reverse();
  const teams: TeamId[] = ['embrace', 'ban'];
  return (
    <div className="grid grid-cols-2 gap-3 items-start">
      <Card title="Points by round" right={<ConfirmButton className="btn-danger btn-sm" msg="Reset BOTH teams' scores to zero? This cannot be undone." onConfirm={e.resetScores}>Reset scores</ConfirmButton>}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-white/50 text-xs">
              <th className="text-left font-normal py-1">Round</th>
              <th className="text-right font-normal text-embrace-bright">Embrace</th>
              <th className="text-right font-normal text-ban-bright">Ban</th>
            </tr>
          </thead>
          <tbody>
            {ROUNDS.map((r) => (
              <tr key={r.id} className="border-t border-white/5">
                <td className="py-1">{r.name}</td>
                <td className="text-right tabular-nums">{s.roundScores[r.id]?.embrace ?? 0}</td>
                <td className="text-right tabular-nums">{s.roundScores[r.id]?.ban ?? 0}</td>
              </tr>
            ))}
            <tr className="border-t border-white/5 text-gold">
              <td className="py-1">of which bonus</td>
              <td className="text-right">{s.bonus.embrace}</td>
              <td className="text-right">{s.bonus.ban}</td>
            </tr>
            <tr className="border-t border-white/20 font-bold text-base">
              <td className="py-1">TOTAL</td>
              {teams.map((t) => (
                <td key={t} className="text-right tabular-nums">
                  {s.scores[t]}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </Card>

      <Card title={`Score history (${s.scoreLog.length})`}>
        <div className="max-h-[360px] overflow-auto">
          <table className="w-full text-xs">
            <tbody>
              {[...s.scoreLog].reverse().map((x) => (
                <tr key={x.id} className="border-t border-white/5">
                  <td className="py-1 text-white/40 whitespace-nowrap">{new Date(x.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                  <td className={x.team === 'embrace' ? 'text-embrace-bright' : 'text-ban-bright'}>{x.kind === 'reset' ? '—' : x.team}</td>
                  <td className={`text-right tabular-nums font-semibold ${x.delta < 0 ? 'text-ban-bright' : 'text-gold'}`}>
                    {x.kind === 'reset' ? '' : `${x.delta > 0 ? '+' : ''}${x.delta}`}
                  </td>
                  <td className="pl-2">
                    {x.reason}
                    {x.bonus && <span className="chip bg-gold/20 text-gold ml-1">bonus</span>}
                  </td>
                  <td className="text-white/40">{roundMeta(x.round).short}</td>
                  <td>
                    {x.kind === 'award' && (
                      <button className="text-white/50 hover:text-white underline" onClick={() => e.undoScore(x.id)}>
                        undo
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!s.scoreLog.length && (
                <tr>
                  <td className="text-white/40 py-2">No points awarded yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title={`Polls (${polls.length})`} className="col-span-2">
        <div className="grid grid-cols-2 gap-2">
          {polls.map((poll) => {
            const r = e.computeResults(poll.id, poll.options, p);
            return (
              <div key={poll.id} className="rounded-lg border border-white/10 p-2 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold flex-1">{poll.question}</span>
                  {poll.id === s.baselinePollId && <span className="chip bg-white/10">BASELINE</span>}
                  {poll.id === s.finalPollId && <span className="chip bg-gold text-black">FINAL</span>}
                  <span className={`chip ${poll.status === 'open' ? 'bg-ban' : 'bg-white/10'}`}>{poll.status}</span>
                  <span className="chip bg-white/10">{poll.revealed ? 'revealed' : 'hidden'}</span>
                </div>
                <div className="mt-1 space-y-0.5">
                  {poll.options.map((o) => (
                    <div key={o.id} className="flex justify-between">
                      <span>{o.label}</span>
                      <span className="tabular-nums">
                        {r.counts[o.id] ?? 0} ({r.total ? Math.round(((r.counts[o.id] ?? 0) / r.total) * 100) : 0}%)
                        <span className="text-white/40">
                          {' '}
                          real {r.real[o.id] ?? 0}
                          {r.simulated[o.id] ? ` · sim ${r.simulated[o.id]}` : ''}
                          {r.manual[o.id] ? ` · hands ${r.manual[o.id]}` : ''}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
                <div className="text-white/40 mt-1">{r.total} votes total</div>
              </div>
            );
          })}
          {!polls.length && <div className="text-white/40 text-sm">No polls yet.</div>}
        </div>
      </Card>

      <Card title="Opinion shift" className="col-span-2">
        {s.shift ? (
          <div className="text-sm grid grid-cols-3 gap-3">
            <div>
              <div className="text-white/50 text-xs">Initial (n={s.shift.initial.n})</div>
              Ban {Math.round(s.shift.initial.banPct)}% · Embrace {Math.round(s.shift.initial.embracePct)}%
            </div>
            <div>
              <div className="text-white/50 text-xs">Final (n={s.shift.final.n})</div>
              Ban {Math.round(s.shift.final.banPct)}% · Embrace {Math.round(s.shift.final.embracePct)}%
            </div>
            <div>
              <div className="text-white/50 text-xs">Change</div>
              Ban support {s.shift.banDeltaPts >= 0 ? '+' : ''}
              {s.shift.banDeltaPts.toFixed(1)} pts · headline: <b>{s.shift.headline}</b>
              <div className="text-xs text-white/60 mt-1">
                {s.shift.individuals
                  ? `${s.shift.individuals.changed} of ${s.shift.individuals.both} people who voted twice changed their vote (→Ban ${s.shift.individuals.toBan}, →Embrace ${s.shift.individuals.toEmbrace}).`
                  : 'No participant-level comparison available.'}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-white/50">Run “Show shift” in Round 5 to compare the opening poll and the final vote.</div>
        )}
      </Card>
    </div>
  );
}
