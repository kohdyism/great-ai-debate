# THE GREAT AI DEBATE — Live

**AI should be banned from universities.** This is a live TV-style gameshow app for the debate at Goodenough College.

It has three synchronised interfaces:

| Mode | URL | Runs on |
|---|---|---|
| **Host** | `#/host` | Your laptop screen: runs the entire show |
| **Stage** | `#/stage/ROOMCODE` | Projector, full screen 16:9 |
| **Audience** | `#/play/ROOMCODE` (QR code) | Phones: no sign-up |

Built with React, TypeScript, Tailwind CSS and Supabase (Postgres, Realtime and server-side vote validation).

---

## Three ways to run it tonight

### A. Offline backup on one laptop (zero setup)
Open **`GreatAIDebate-offline.html`** in Chrome. Click **Host Mode**, then click **⧉ Open Stage** and drag that window onto the projector. Click it once to enable sound, then press **F** for full screen.

Everything works on this one computer: all five rounds, the roulette, timers, scores, the verdict and the opinion shift. Phones **cannot** connect in this mode. To get audience input you can:

- simulate votes. The projector always labels them as simulated.
- count a **show of hands** and type the numbers in. In the poll panel this is the *Show-of-hands fallback*.

### B. Live mode with real phone voting (about 10 minutes)
1. **Supabase:** create a free project at supabase.com. Open **SQL Editor → New query**, paste all of `supabase/schema.sql` and click **Run**.
2. In **Project Settings → API**, copy the **Project URL** and the **anon / publishable** key. Never use the `service_role` / secret key.
3. Open `dist/config.js` and paste the two values in:
   ```js
   window.GAD_CONFIG = { supabaseUrl: 'https://xxxx.supabase.co', supabaseAnonKey: 'eyJ…' };
   ```
4. **Deploy:** go to <https://app.netlify.com/drop> and drag the whole `dist` folder onto the page. You'll get an `https://….netlify.app` link. Vercel, GitHub Pages or any static host also works. Routing is hash-based, so no server config is needed.
5. Open `https://your-site/#/host` **from the deployed URL**, because the QR code points at whatever address the host page uses. The header should show **LIVE · synced**.

### C. Develop locally
```bash
npm install
npm run dev            # http://localhost:5173
npm run build          # → dist/ (deployable)
npm run build:offline  # → dist-offline/index.html (single file)
```
Credentials can also come from `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` at build time.

---

## Event-night setup
1. Laptop is connected to the projector as an **extended display**.
2. Open **Host** on the laptop. Click **⧉ Open Stage**, move that window to the projector, click it once (sound) and press **F**.
3. The Stage window shows the opening title. The **START THE SHOW** button works from either window.
4. Follow **Run of show** on the left of the Host screen. Each round panel lists its steps in order with **Load** / **▶ Go** buttons. The right-hand column keeps the **Timer**, **Poll** and **Scores** visible at all times.
5. **Space** on the host starts and pauses the timer.

### Suggested running order
| | What happens | Host controls |
|---|---|---|
| Pre-show | Title → Join screen with QR → **baseline poll** (keep results hidden) | Pre-show panel |
| R1 Opening Gambit | Spotlight each team → 60s each → audience vote → award winner | R1 panel |
| R2 Fact or Fiction | Draw a factual statement → lock in team answers → reveal (auto-awards correct teams). The audience can play along. Debate statements are labelled as such | R2 panel |
| R3 Hot Seat | Random scenario → prep 30s → 60s each + 30s challenges → vote → award | R3 panel |
| 🎡 AI Roulette | SPIN → reveal challenge → team picked at random (or the audience decides) → timers → award/deduct, Double or Nothing | Roulette panel |
| R4 Devil's Advocate | Assign opposite-side challenges → timers → vote → **bonus** points | R4 panel |
| R5 Final Verdict | Proposition → 90s closings → final vote → **10s countdown** → audience verdict → **opinion shift** → **champion** | R5 panel |

There are **two separate winners**, and they are never mixed:
- the **champion** (most points)
- the **audience verdict** (final vote)

---

## Features
- **Poster-matched design.** Near-black stage, blue spotlight on the left and red on the right, an LED panel with a red neon frame and pixel texture, Archivo Black and Anton type, and a blue → red floor rim with audience silhouettes. All fonts are bundled, so it works offline. **Team Embrace is always on the LEFT and Team Ban always on the RIGHT.** Teams are always labelled by name, not only by colour.
- **Scoreboard** is persistent on stage, with animated numbers, "+10" bursts and a ★ LEADING badge. The host can add, deduct, give bonus points, override, undo, see a per-round breakdown and full history, and reset (with confirmation).
- **Timers** are calculated from timestamps (`startedAt` + remaining time), not a countdown loop. They survive refreshes and reconnections, and in live mode they correct for clock offsets between devices.
- **AI Roulette** has 8 illuminated segments and 45 editable challenges. The spin speeds up, then slows to a long dramatic stop, with tick sounds. While the wheel spins, a second spin can't start. The host can re-spin, skip, spin to a chosen category or set one directly, pick questions, override the team, open an audience vote for *Audience Decides*, and set the *Double or Nothing* stake.
- **People's Verdict.** Any poll can be hidden, shown live, or revealed automatically when it closes. Hidden results are **never** sent to the stage or to phones; only the host sees them. The **opinion shift tracker** compares the overall split *and* how many individual participants changed their vote (counting only people who voted in both polls). The message "THE ROOM HAS CHANGED ITS MIND!" appears only if the majority actually flipped.
- **Content manager.** You can add, edit or delete statements, scenarios, challenges and roulette questions. Fact-or-Fiction items are either *Factual* (with a defensible answer and explanation) or *Debate statement*. Random draws skip questions already used, and you can reset that history. Timings and points are editable, and everything can be exported or imported as JSON.
- **Reliability.**
  - State is saved after every action, and a refresh resumes exactly where you were. That includes a spin in progress and the verdict countdown.
  - Stage and phones show a connection indicator and reconnect automatically.
  - Destructive actions ask for confirmation.
  - There's a message/fallback screen, a pause overlay, a sound mute and full-screen.
  - The host key lets another computer take over a live room.

## Voting integrity and security (live mode)
- The browser only ever holds the public anon key. Row Level Security is on for every table, and nothing can write to tables directly.
- All writes go through `SECURITY DEFINER` Postgres functions:
  - host actions require the host key, which is stored only as a SHA-256 hash;
  - `cast_vote` checks that the participant has joined, that this is the currently open poll and a valid option, and allows **one vote per participant per poll** (enforced by the primary key). A vote that arrives during a close is locked out with `FOR SHARE`.
- Votes and participant records cannot be read by the public. Participants are anonymous random IDs: no names, emails or accounts.
- Known limitation (no-account voting): someone who clears their browser data, or switches to another browser, gets a new anonymous ID. Stopping that completely would need sign-ins, which the brief ruled out.

## Testing done
- **Full demo-mode run in automated Chrome (Playwright):** start → join via QR route → baseline poll → R1 → Fact or Fiction → Hot Seat → Roulette → Devil's Advocate → scoreboard → final vote → countdown → verdict → opinion shift → champion.
- **Duplicate vote:** after wiping the phone's local record, the second vote was rejected and the phone showed its original vote.
- **Late vote:** a vote after the poll closed was rejected.
- **Spin:** the spin button stays disabled while the wheel is spinning.
- **Refreshes:**
  - after a stage refresh, the timer continued correctly;
  - after a host refresh mid-timer, the timer continued (0:55 after 5 s);
  - after a host refresh mid-spin, the wheel still landed;
  - after a host refresh, scores and round were restored.
- **`schema.sql` checks:** run in Postgres with `pgcrypto`, covering
  - joining and the one-vote rule;
  - wrong poll, invalid option and voting after close;
  - a wrong host key being rejected;
  - tallies, opinion shift and reset;
  - anonymous users being blocked from reading or writing `votes`, `participants` and `event_secrets`.
- **Not yet tested here:** the Supabase client calls against a real hosted project. Do one rehearsal on your deployed URL with two phones before doors open.
