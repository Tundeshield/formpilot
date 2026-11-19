# FormPilot

**Your information. Every form. Handled.**

FormPilot is a Chrome extension and web app. It reads the form on the page you're on and drafts answers from your personal knowledge profile. You review and approve the answers before anything is filled, and you always submit the form yourself.

```
web/            React + TS dashboard: auth, profile, CV upload & extraction review, usage, extension download
web/public/demo Demo job-application form (realistic, includes traps: password, card, honeypot, prompt injection)
extension/      Chrome MV3 extension (side panel UI)
src/shared/     Types, field classifier, page scanner + filler (injected into pages), design tokens
src/server/     Backend logic: auth, LLM providers, answer engine, CV extraction
netlify/functions/  HTTP API: /api/config, /api/generate, /api/extract, /api/facts, /api/usage
firebase/        Firestore + Storage security rules (firebase.json deploys them)
tests/          Scanner, classifier, answer pipeline and filler tests (run against the demo form)
```

## How it works

1. **Scan.** When you click **Scan page**, the side panel injects `scanPage()` into the active tab. It collects inputs, textareas, selects, radio groups and checkboxes along with their labels, help text and options. Passwords, file inputs, payment and ID fields, captchas and hidden or honeypot fields are never read.
2. **Answer.** `/api/generate` verifies your Firebase ID token and reads your profile from Firestore with *your* token, so the security rules apply even on the server. Then:
   - Simple fields (name, email, phone, location, links, current title or company) are filled **straight from the profile**, without calling the AI.
   - Consent boxes, legal declarations, marketing opt-ins and demographic self-ID questions are always left for **you** to answer.
   - Open questions go to the LLM with **only the relevant profile sections**. The LLM never receives your email, phone or street address. Page text is wrapped as untrusted input, and the model has to answer `needs_info` rather than guess.
   - Every answer is validated. Options must exist on the page, placeholders like `[Company]` are rejected, and dates, numbers and maxLength are enforced.
3. **Review.** Each field shows its answer, a confidence level and its status (High / Review / Low / Needs info). You can **Edit**, **Regenerate** (shorter, more detail, more formal, different angle), **Skip** or **Approve**, or use **Approve all**. If you type an answer to a *needs info* question, you can save it to your profile for next time.
4. **Fill.** `fillFields()` populates only the approved fields. It uses native setters and dispatches input/change events, so React and Vue forms register the values. **It never submits.**

## Setup (about 15 minutes)

### 1. Firebase
1. In the Firebase console, create a project, then add a **Web app**. Copy its config values.
2. Under **Authentication → Sign-in method**, enable **Email/Password**. Under **Settings → Authorized domains**, add your Netlify domain.
3. Create a **Firestore** database and a **Storage** bucket (production mode).
4. Deploy the security rules with `firebase deploy --only firestore:rules,storage`. Or paste `firebase/firestore.rules` and `firebase/storage.rules` into the Rules tabs in the console.

No service-account key is needed. The functions verify ID tokens against Google's public keys and call Firestore as the signed-in user.

### 2. Netlify
Connect the GitHub repo as a new site. The build settings come from `netlify.toml`. Add these environment variables:

| Variable | Value |
|---|---|
| `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_APP_ID` | From the Firebase web app config (public values) |
| `OPENAI_API_KEY` | Your key. Server-only: it is never shipped to the browser or the extension |
| `OPENAI_MODEL` | Optional, default `gpt-4.1-mini` |
| `LLM_PROVIDER` | Optional: `openai` (default) or `anthropic` (then set `ANTHROPIC_API_KEY`) |
| `STRIPE_SECRET_KEY` | Stripe secret key (mark secret). Without it everyone is on Free |
| `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY` | Price IDs of the Pro product in Stripe |
| `VITE_LEGAL_NAME`, `VITE_SUPPORT_EMAIL` | Shown on the landing, Terms and Privacy pages |

Deploy. During the build, the extension is compiled with the site's URL as its backend and zipped into `/formpilot-extension.zip`.

### 3. Extension
In the dashboard, go to **Extension → Download**. Unzip the file, open `chrome://extensions`, turn on Developer mode, click **Load unpacked**, pin FormPilot and sign in.

### Local development
```bash
cp .env.example .env    # fill in values
npm install
npx netlify dev         # web + functions on http://localhost:8888
npm run build:ext       # extension → dist/extension (defaults to localhost:8888)
npm test                # 21 tests
```

## Security model
- AI keys exist only in Netlify Functions.
- The extension holds only the public Firebase web config, which it fetches from `/api/config`, and the user's Firebase session. It uses Firebase's `web-extension` Auth build, which loads no remote scripts, as MV3 requires.
- All data lives under `users/{uid}` in Firestore and Storage, and the rules allow access only when `request.auth.uid == uid`. The API calls Firestore *as the user* via REST, never with admin credentials. Usage counters can only increase.
- The extension never downloads your profile. The server sends the LLM only the sections a given question needs.
- Host access is an *optional* permission. Chrome asks for it the first time you scan, and pages are read only when you click Scan.
- Webpage content is treated as untrusted. Strings are capped, the content is delimited in the prompt, the model is told to ignore any instructions in it, and the output is validated. The demo page includes a prompt-injection line to show this.
- FormPilot never collects passwords or payment data from forms, and never submits a form.

## Known limitations (MVP)
- **Custom widgets** built from divs, such as Google Forms' styled dropdowns, Workday comboboxes or rich-text editors, aren't filled. Standard HTML controls are.
- **Cross-origin iframes** aren't scanned. For example, a Greenhouse form embedded on a company site: open the iframe's URL directly instead.
- **Scanned or image-only PDFs** have no text layer and would need OCR. PDF, DOCX and TXT files with real text all work.
- The extension is installed unpacked. A Chrome Web Store listing needs a store account and review.
- Plans and limits live in `src/shared/plans.ts` (Free: 30 AI answers / 2 imports; Pro $9/mo or $79/yr: 1,000 / 30). Stripe is the source of truth for subscriptions; the user's Stripe customer id is stored HMAC-signed in Firestore, so no webhook or admin credentials are needed. Turn on the Customer Portal in Stripe for "Manage billing".
- Email verification is sent at sign-up but isn't required to use the app.
