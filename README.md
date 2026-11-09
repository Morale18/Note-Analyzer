# Note-Analyzer

A guitar fretboard trainer. It shows a note to play on a specific string ("F♯ on the A string"), listens through your phone's microphone, grades what you played, and tracks your accuracy over time. A wrong note keeps the prompt on screen until you play it correctly or tap **Skip**.

It runs on your computer. You use it from your phone on the same Wi-Fi.

## Install

You need Node 22 or newer.

```sh
npm install
```

## Run

```sh
npm run dev
```

This starts the API and the web app together, and prints the address to open on your phone:

```
🎸 Open this on your phone (same Wi-Fi):
  https://192.168.1.20:5173/
```

The database is created and migrated automatically on first start, at `apps/server/data/fretboard.db`.

## Open it on your phone

Phones only allow microphone access over HTTPS, so the dev server uses a self-signed certificate. Your phone will warn about it once; that's expected for this app on your own network.

**iPhone (Safari)**

1. Open the printed `https://` address.
2. On "This Connection Is Not Private", tap **Show Details**, then **visit this website**, then **Visit Website**.
3. Tap **Start** and allow the microphone.

**Android (Chrome)**

1. Open the printed `https://` address.
2. On the warning page, tap **Advanced**, then **Proceed to … (unsafe)**.
3. Tap **Start** and allow the microphone.

The certificate is regenerated about once a month, so you may need to accept the warning again.

If the phone can't load the page, check that it's on the same Wi-Fi as the computer and that your computer's firewall allows incoming connections for Node. The address can also change when your computer gets a new IP, so use the one from the latest `npm run dev`.

## Add to Home Screen

This opens the app full-screen with no browser bars.

- **iPhone:** in Safari, tap the Share button, then **Add to Home Screen**.
- **Android:** in Chrome, open the ⋮ menu, then **Add to Home screen**.

The app has to be accepted over the self-signed certificate first. Some phones don't carry that acceptance over to the Home Screen version. If it won't load or can't use the microphone from there, keep using it in a browser tab, which works the same way.

## Ear training

The **Ear** tab plays a note and gives you three names to choose from. Right or wrong, it moves on to the next note after showing the answer; tap **Play again** to hear the note again before answering.

It has its own Strings, Notes, and Fret range in the **Ear training** part of **Settings**, separate from Practice. The notes you hear are ones that setup can play. If fewer than three notes are selected, the extra choices come from the other notes. Ear training scores last for the current run and aren't added to **Stats**.

On iPhone, the silent switch mutes the notes.

## Tuner

The **Tuner** tab walks you through the strings from lowest to highest. Pick a tuning, tap **Start**, and pluck the highlighted string. The gauge and the message under it show whether to tighten or loosen the string and how far off you are. Once the string holds within 5 cents for half a second, it's checked off and the tuner moves to the next one, until all six are in tune.

Tap any string to jump to it or retune it. Turn **Auto** off to stay on one string after it's in tune and choose the next yourself. The back arrow stops the tuner. The tunings are Standard, Drop D, Half step down, Drop C♯, Whole step down, Drop C, DADGAD, and Open G, D, A, E and C. The app remembers the last one you used on that device. It uses the same microphone sensitivity as Practice.

## Tune detection sensitivity

The sensitivity slider in **Settings** sets the noise gate: how loud a sound must be before it counts as a note.

The thin bar under the tuning meter on the **Practice** screen shows your input level, and the amber tick marks the gate.

1. Tap **Start**, stay quiet, and look at the bar. It should sit left of the tick.
2. Play a note at normal strength. It should go well past the tick.

| What you see | What to do |
| --- | --- |
| Notes aren't picked up, bar stays left of the tick | Raise sensitivity |
| Room noise or talking triggers results | Lower sensitivity |
| A ringing note gets graded against the next prompt | Mute the string before playing the next note |

Other tips: keep the phone within about 50 cm of the guitar, with the microphone facing the sound hole. Tune up first, since a note more than 50 cents off reads as its neighbor. Mute other strings, because the detector expects one note at a time. Changes apply the next time you tap **Start**.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the web app and API |
| `npm test` | Runs all tests |
| `npm run typecheck` | Typechecks every workspace |
| `npm run build` | Builds the web app |
| `npm run db:generate` | Generates a migration after editing `apps/server/src/db/schema.ts` |

## Project layout

```
apps/web        Vite + React app (audio, quiz, components, pages, api)
apps/server     Fastify API with SQLite and Drizzle
packages/dsp    Pitch detection in pure TypeScript, no DOM dependencies
packages/shared Note math, fretboard logic, Zod schemas and types
```

Pitch detection runs in an AudioWorklet (`apps/web/src/audio/pitchProcessor.ts`). It depends only on the `PitchDetector` interface in `packages/dsp/src/detector.ts`, so a WASM detector can replace the McLeod Pitch Method one by implementing that interface.

If the API is unreachable, practice keeps working. Attempts are stored on the phone and sync when the server is back.

`npm run dev` makes the app reachable by anyone on your network, with no login, so only run it on a network you trust. The API itself listens on localhost only and is reached through the HTTPS proxy.
