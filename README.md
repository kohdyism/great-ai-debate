# THE GREAT AI DEBATE — Live

A TV-style debate gameshow for Goodenough College:
- choose how many teams are playing;
- 3 rounds, one topic per round;
- each debate spins a roulette wheel to pick that round's question;
- each team argues **FOR** once and **AGAINST** once in every round.

| Screen | URL | Runs on |
|---|---|---|
| **Host** | `#/host` | Your laptop: set up and run the show |
| **Projector** | `#/stage/ROOMCODE` | Projector, full screen |
| **Audience** | `#/play/ROOMCODE` (QR code) | Phones: vote on who won |

## Running it (host)
1. Open `…/#/host`. The **✎ Setup** page opens first.
   - **① Number of teams** (2–8): use − / +, then type the team names.
   - **② Rounds:** for each one, type a topic title and its questions. Write each question as a statement teams can argue FOR or AGAINST. Aim for about 6 per topic; you need at least one per team.
   - **③ Timings and points.**
   - Check the schedule preview at the bottom, then click **Save & go to the show**.
2. Click **⧉ Open projector screen**, drag it onto the projector, click it once for sound and press **F** for full screen.
3. Keep pressing the big **NEXT ▶** button. Its label always tells you what happens next:

   *Join QR → Round title → SPIN the wheel → question revealed → prep timer → FOR team speaks → AGAINST team speaks → Who won? → Result → next debate…*

   After the last debate: **Leaderboard → Champion**.
4. At **Who won?**, either click a winner (or Draw) yourself, or click **Open audience vote** and then **Close vote & reveal**. Points are added automatically. You can still change the winner afterwards and the points update.
5. If something goes wrong:
   - click any debate on the left to jump to it;
   - use the step buttons to redo a step;
   - use **±1** next to a team to fix scores;
   - press **Space** to pause or resume the timer.

## The fair schedule
With N teams there are N debates per round. In debate *i*, team *i* argues FOR and team *i+k* argues AGAINST, where *k* changes each round. So every team argues FOR exactly once and AGAINST exactly once in each round, against different opponents where possible. Within a round, the wheel won't land on a question that's already been used.

## Live phone voting (optional)
1. Create a free Supabase project and run `supabase/schema.sql` in its SQL Editor.
2. Put the Project URL and the publishable/anon key into `public/config.js`.
3. Commit the change. GitHub Pages redeploys in about a minute.

Without keys the app runs in **demo mode**: host and projector still sync on one computer, and you can pick winners yourself or type show-of-hands counts.

## Develop
```bash
npm install
npm run dev
npm run build          # dist/
npm run build:offline  # dist-offline/index.html (single file, no server needed)
```
