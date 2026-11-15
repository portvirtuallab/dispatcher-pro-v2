# Dispatcher Pro v2

Traffic-dispatch simulator of **Port Virtual Lab (PVL.ONE)**, powered by Escola Europea – Intermodal Transport.

Students act as traffic managers: they read delivery notes, infer each service's requirements from the container ISO code and the cargo, assign qualified drivers within a 9-hour shift and, at the higher levels, choose the customs procedure. Each level has an objective that must be met to complete it.

| Level | Delivery notes | Time | Objective | Target |
|---|---|---|---|---|
| Beginner | 5 | 5 min | Dispatch every container with a qualified driver | 80 % |
| Intermediate | 10 | 8 min | No driver goes over the 9-hour shift | 80 % |
| Advanced | 15 | 12 min | Right driver and right customs procedure | 75 % |
| Expert | 25 | 15 min | Serve every high-priority service | 70 % + all high priority |

## Repository contents

```
index.html            The game (single page, no build step)
config.js             Apps Script Web app URL
apps-script/Code.gs   Results backend for Google Sheets
README.md
```

## 1. Publish the game on GitHub Pages

1. Create a new repository, for example `dispatcher-pro-v2`.
2. Upload `index.html`, `config.js`, `README.md` and the `apps-script` folder (Add file → Upload files → Commit).
3. Go to **Settings → Pages**. Under *Build and deployment* choose **Deploy from a branch**, branch `main`, folder `/ (root)`, and save.
4. After a minute or two the game is live at `https://<user-or-org>.github.io/dispatcher-pro-v2/`.

Without step 2 the game already works, but results are kept only in each student's browser.

## 2. Connect the Google Sheet (class results)

1. Create a new Google Sheet, for example **DispatcherPRO_V2_DATA**, with the Escola Europea account that should own the data.
2. In the Sheet, open **Extensions → Apps Script**. Delete the sample code and paste the whole content of `apps-script/Code.gs`. Save.
3. In the function selector choose **setup** and click **Run**. Accept the permissions. The tabs `RESULTS` and `SETTINGS` are created.
4. Click **Deploy → New deployment**. Type: **Web app**. *Execute as*: **Me**. *Who has access*: **Anyone**. Click **Deploy** and copy the **Web app URL** (it ends in `/exec`).
5. In GitHub, edit `config.js` and paste the URL into `API_URL`. Commit.
6. Test it: open `<Web app URL>?action=ping` in the browser. You should see `{"ok":true,...}`.

When you change `Code.gs` later, use **Deploy → Manage deployments → Edit → Version: New version** so the URL stays the same.

## 3. Set the teacher password

Open the `SETTINGS` tab of the Sheet. The row `TEACHER_PIN` starts as `changeme`: type your own password in the `VALUE` cell, 8 characters or more. Nothing else to do — the Web app reads it on every request, so a change takes effect at once.

That password is the only thing that unlocks the e-mails and the reset. The leaderboard needs no password.

## 4. Use it in class

1. Students open the game, fill in **school, name and e-mail**, and pick a level. There is no class code.
2. Everyone playing on the same date gets the same delivery notes, so the scores are comparable. **New shift** generates a different one.
3. **Leaderboard** is open to everyone: best shifts of the last hour, week or month, or all time, filterable by level. It shows name and school, never an e-mail.
4. **Teacher panel** → type the password → **Open results**: every game with its e-mail, the most frequent mistakes, and a CSV to copy.

## 5. Reset results

In the Teacher panel, under *Reset results*, pick a period (last hour, 24 hours, week, month, or everything) and press **Delete results**. It asks for confirmation, needs the password, and cannot be undone. Students can keep playing straight afterwards.

**Clear this browser** only removes the games stored on that computer; the Sheet is untouched. Deleting rows by hand in `RESULTS` works too, and is the only way to remove a single game.

## Data and privacy

**Each game stores the student's school, name and e-mail.** That makes the `RESULTS` tab a file of personal data, and most players are minors, so before running it with a class make sure your school has a legal basis for the processing, tells students and families what is collected and why, and sets a date to delete it. Deleting is one button: Teacher panel → *Reset results* → *Everything*.

- The public leaderboard shows name and school. E-mails are never returned by that endpoint, only by the password-protected one.
- The teacher password is stored in plain text in the `SETTINGS` tab, which only people with access to the Sheet can read. Use 8 characters or more: it is sent over HTTPS but a short one can be guessed by trying.
- The Web app accepts results from anyone who has its URL, and validates every field. A determined student can therefore post a made-up score; this is a classroom game, not an exam.
- Nothing is stored outside the Google Sheet. The browser also keeps the last 60 games locally so a student sees their own history.

## Simulation rules

Service time = km ÷ 80 + 0.5 h loading/unloading + 0.75 h break if driving exceeds 4.5 h. Services that do not fit in 9 h need an OVERNIGHT driver and take the whole shift. Size comes from the first ISO character (2 = 20 ft, 4 = 40 ft, L = 45 ft); REEFER from group R or a stated temperature; ADR from a UN number; INTL from a destination outside Spain. Customs: NONE, EX-A (goods leaving the EU), IM-A (non-EU goods released for free circulation), T1 (non-EU goods to a customs warehouse).

These are simulation rules for training reasoning. They do not replace Regulation (EC) 561/2006 or the ADR agreement.

## Next steps

- Move levels, drivers and routes to Sheet tabs so they can be edited without touching code.
- Spanish and Catalan interface.
