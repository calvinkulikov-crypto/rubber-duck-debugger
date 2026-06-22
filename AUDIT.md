# AUDIT — Rubber Duck Debugger

**Letztes Update:** 2026-06-22 22:45 | Branch `wow-polish` | HEAD `8f38675`

## AKTUELLER STAND

Alle Features gebaut, verifiziert (24/24 Tests, node --check, headless smoke), gepusht.

### Submission-Polish (fertig)
1. **Share-Button** Game-Over → „⧉ Ergebnis kopieren" → Clipboard (Wave/Score/URL)
2. **Intro** 4 Zeilen, Gummiente-Pointe zuletzt
3. **Start-Button** „▶ $ npm run debug"
4. **Welle 1 dichter** — `baseBudget` 3→4, `spawnIntervalBase` 1.4→1.2
5. **README** 3-Satz-Pitch + Konzept + Technik

### Wow-Picks (alle 7 fertig)
1. Quack beim Bug-Kill
2. Autocomplete-Ghost (Lock-Vorschau)
3. /ultrathink Superpower (Skill-Meter, Enter, Screen-Clear + Slow-Mo)
4. Kill-Partikel = fallende Code-Zeichen (CodeBit)
5. Boss-Arena-Alarm (Dunkel + Rot-Rand + INCIDENT-Banner)
6. Boss-Tension-Drone (55Hz, Tremolo, idempotent)
7. Intro-Cohesion (Cursor folgt Tipp-Caret, keyClick pro Zeichen)

### Session-Ende-Fix
- **Intro wartet auf Input** — kein Auto-Sprung mehr. Nach fertigem Tippen blinkt „› Enter / Klick = weiter"
- **Shake-Reset** in `enterTitle()` — kein Jitter nach Death
- **Background-Musik** — Lookahead-Sequencer, Pentatonik-Arpeggio während PLAYING

## NÄCHSTE SCHRITTE (Calvin)

1. **Playtest** — `python3 -m http.server 8000` → Cmd+Shift+R → testen:
   - Intro wartet, Blinkprompt erscheint
   - Title-Animationen (Typewriter, Duck, Ambient-Bugs, Musik)
   - Kein Menü-Jitter nach Death
   - Share-Button auf Game-Over-Screen
   - Audio-Delay? (welcher Browser? erst ab 1. Taste oder später? mit Mute?)

2. **Merge + Deploy**
   ```
   git checkout main
   git merge --no-ff wow-polish
   git push origin main
   ! npx vercel
   ```

3. **Abgabe** — Repo-Link + Live-Link in SKAILE-Abgabe-Thread. Deadline: Di 2026-06-23 18:00.

## Offen / Optional
- Leaderboard (Upstash Redis + Vercel Serverless) — NUR bei ≥4h Restzeit, CORS/Deploy-Risiko.
- Audio-Delay-Diagnose: falls nach Playtest noch vorhanden → Browser + Timing-Infos von Calvin.

## Branch-Klarstellung
`wow-polish` = SUPERSET (Typing-Pivot + alle Politur-Commits). `main` = Fallback (Typing-Pivot ohne Politur).
Ship-Kandidat = `wow-polish`.
