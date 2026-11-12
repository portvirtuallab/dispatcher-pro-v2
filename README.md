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
3. In the function selector choose **setup** and click **Run**. Accept the permissions. The tabs `CLASSES` and `RESULTS` are created.
4. Click **Deploy → New deployment**. Type: **Web app**. *Execute as*: **Me**. *Who has access*: **Anyone**. Click **Deploy** and copy the **Web app URL** (it ends in `/exec`).
5. In GitHub, edit `config.js` and paste the URL into `API_URL`. Commit.
6. Test it: open `<Web app URL>?action=ping` in the browser. You should see `{"ok":true,...}`.

When you change `Code.gs` later, use **Deploy → Manage deployments → Edit → Version: New version** so the URL stays the same.

## 3. Use it in class

1. Teacher: open the game → **Teacher panel** → *Create a new class* (school, teacher, 4–8 digit PIN). You get a class code such as `PVL-7K3Q`.
2. Students: open the game, type the class code and a nickname, and play. No email is requested.
3. Teacher: in the Teacher panel, enter the class code and PIN → **Open results**. You see each game, whether the objective was met, the most frequent mistakes, and can copy the results as CSV.

Everyone using the same class code gets the same shifts, so results are comparable. **New shift** generates a different one.

## Data and privacy

- Results store a nickname, never an email.
- Teacher PINs are stored as a SHA-256 hash in the `CLASSES` tab.
- To close a class, set its `Active` cell in `CLASSES` to `FALSE`; new results for that class are rejected.
- The Web app accepts results from anyone who has its URL. It only accepts known class codes and validates every field.

## Simulation rules

Service time = km ÷ 80 + 0.5 h loading/unloading + 0.75 h break if driving exceeds 4.5 h. Services that do not fit in 9 h need an OVERNIGHT driver and take the whole shift. Size comes from the first ISO character (2 = 20 ft, 4 = 40 ft, L = 45 ft); REEFER from group R or a stated temperature; ADR from a UN number; INTL from a destination outside Spain. Customs: NONE, EX-A (goods leaving the EU), IM-A (non-EU goods released for free circulation), T1 (non-EU goods to a customs warehouse).

These are simulation rules for training reasoning. They do not replace Regulation (EC) 561/2006 or the ADR agreement.

## Next steps

- Move levels, drivers and routes to Sheet tabs so they can be edited without touching code.
- Spanish and Catalan interface.
