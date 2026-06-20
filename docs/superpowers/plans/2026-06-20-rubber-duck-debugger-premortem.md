# Premortem: Rubber Duck Debugger — Implementation Plan

**Datum:** 2026-06-20
**Plan:** docs/superpowers/plans/2026-06-20-rubber-duck-debugger.md
**Verdikt:** PROCEED

## Top-Risiken (High Severity)

Keine High-Severity-Findings. Reines Frontend-Spiel, kein Backend, keine Secrets, keine
User-Daten außer `localStorage`-Highscore. Größte reale Risiken liegen auf Medium (siehe unten)
und sind billig vorab abzufedern.

## Medium Severity
- **[End-User] Maus-only → auf Smartphone unspielbar** — Falls ein Judge das Spiel am Handy öffnet, ist es ohne Maus/Tastatur tot. Submission verlangt spielbaren Link. — Plan §Task 1/11. Mitigation: auf Touch-Geräten Hinweis "am Desktop spielen" einblenden, optional minimaler Touch-Fallback (Finger zieht Ente, Tap = feuern) als Stretch.
- **[Ops] Vercel könnte `package.json` als Build-Projekt fehl-deuten** — Deploy als statische Seite könnte stattdessen einen Build erwarten. Kein Live-Link = ungültige Abgabe. — Plan §Task 13. Mitigation: `package.json` hat bewusst keinen `build`-Script → Vercel behandelt es als "Other/static". Zusätzlich: **früher Wegwerf-Deploy nach Task 3/7**, um die Pipeline vor dem Deadline-Crunch zu verifizieren; notfalls Framework-Preset "Other" / Output-Dir = Root setzen.
- **[Security/Ops] `.vercel` (+ evtl. `node_modules`) nicht in `.gitignore`** — `npx vercel` legt `.vercel/` mit Projekt-Linkage an; versehentlich committed = Müll/Leak im public Repo. — Plan §Task 1/13. Mitigation: `.gitignore` um `.vercel` und `node_modules` ergänzen (Task 1).
- **[Engineer] Screen-Shake ist zeit-kontinuierlich → wirkt wie sanftes Driften statt Shake** — `(this.time*911)%2-1` ist über die Zeit glatt, nicht jittrig. Kosmetisch, aber genau der Juice-Effekt der zählen soll. — Plan §Task 9. Mitigation: pro Frame echten Jitter via `Math.random()` nutzen (Browser-Kontext, erlaubt): `(Math.random()*2-1)*s`.
- **[PM] Scope vs. Zeit (13 Tasks, viel Juice)** — Calvin in Ausbildung, Fenster = WE + Mo + Di. Risiko: Politur frisst Zeit, nichts Abgebbares. — Plan §gesamt. Mitigation: Task-Reihenfolge so, dass **nach Task 7 ein vollständig spielbares Game** existiert (Core-Loop + Score + Leben + GameOver), Task 8 = Boss, 9–12 = Politur. Klarer "minimum shippable"-Checkpoint nach T7/T8; ab da jederzeit abgabefähig.

## Low Severity / Observations
- **[Engineer] Tunneling bei sehr schnellen kleinen Bugs bei niedriger Framerate** — Beam bewegt sich bei dt=1/30 ~30px/Frame; Segment-Test (len 26 + Radius) deckt das i.d.R. ab. Nur theoretisch. Beobachten im Playtest.
- **[Engineer] Pseudo-Zufall (Spawn-x/Typ/Label) aus `this.time`** — kann bei eng aufeinanderfolgenden Spawns clustern. Varianz akzeptabel; bei Bedarf `Math.random()` im Browser nutzen.
- **[Engineer] `setupHiDPI` nicht bei Resize erneut anwenden** — bei Fenster-Resize bleibt Backing-Store fix. CSS skaliert trotzdem korrekt → nur Schärfe, kein Crash. Low.
- **[Security] Keine Injection-Fläche** — alle Texte (Code-Zeilen, Bug-Labels) sind statisch aus `config.js`/Code; `localStorage` speichert nur eine geparste Integer. Kein XSS, keine Secrets. Sauber.
- **[End-User] Gleichzeitig Maus bewegen + Leertaste feuern** ist das ergonomischste Schema (Klick-halten + Trackpad-Move ist hakelig). Beides funktioniert parallel — in der Anleitung klar so kommunizieren.
- **[PM] Gummiente muss klar als Gummiente lesbar sein** (Pflichtvorgabe + Wiedererkennung). Vektor-Ente gelb + Schnabel + 🦆 im Titel → erfüllt; im Playtest gegenchecken.

## Persona-Reports (collapsed)
<details>
<summary>Engineer (5 Findings)</summary>

1. **Screen-Shake zeit-kontinuierlich** — `(this.time*911)%2-1` ist glatt über die Zeit → Drift statt Shake. Likelihood: high. Impact: wrong-result (kosmetisch). Mitigation: `Math.random()`-Jitter. §Task 9.
2. **Tunneling schnelle Bugs/niedrige FPS** — Beam 920px/s, dt-clamp 1/30 → ~30px/Frame vs Fast-Bug-Durchmesser 24; Segment-Test mildert. Likelihood: low. Impact: wrong-result. Mitigation: im Playtest prüfen, ggf. Beam-Subschritte. §Task 5/7.
3. **Pseudo-Zufall aus `this.time` clustert** — eng getaktete Spawns → ähnliche x/Typ. Likelihood: low. Impact: other (Varianz). Mitigation: `Math.random()` im Browser. §Task 6.
4. **`setupHiDPI` ignoriert Resize** — Backing-Store fix nach Init. Likelihood: medium. Impact: other (Schärfe). Mitigation: optional resize-Listener; kein Blocker. §Task 12.
5. **Boss-Wellen-Softlock zwischen T6 und T8** — T6 setzt `bossPending=true` ohne Spawn → Wave-vorbei-Check blockiert auf Welle 5. Likelihood: medium (nur im Zwischenstand). Impact: crash-äquiv. (Hänger). Mitigation: nicht zwischen T6 und T8 "fertig" testen/abgeben; T8 löst es (Boss wird gespawnt, `bossPending=false`). §Task 6/8.
</details>

<details>
<summary>Security (3 Findings)</summary>

1. **`.vercel`/`node_modules` evtl. nicht ignoriert** — Deploy-Metadaten/Müll im public Repo. Likelihood: medium. Impact: other (Hygiene/Leak-Metadaten). Mitigation: `.gitignore` ergänzen. §Task 1.
2. **Keine Injection-Fläche** — statische Texte, `localStorage` nur Integer. Likelihood: low. Impact: none. Mitigation: keine nötig.
3. **Keine Secrets im Repo** — kein Backend, keine Keys; git-Identität nutzt noreply-Mail. Likelihood: low. Impact: none. Mitigation: beim Deploy keinen Token committen (`.vercel` ignorieren deckt es).
</details>

<details>
<summary>Ops / Reliability (3 Findings)</summary>

1. **Vercel-Build-Fehldeutung wegen `package.json`** — könnte Build statt Static erwarten. Likelihood: low. Impact: total-failure (kein Live-Link). Mitigation: kein build-script (schon so), früher Wegwerf-Deploy zur Verifikation, ggf. Preset "Other". §Task 13.
2. **Lokaler Testserver setzt python3 voraus** — ES-Module brauchen http (nicht file://). Likelihood: low. Impact: other. Mitigation: Fallback `npx serve` dokumentieren. §Task 1/3.
3. **Blast-Radius** — reines Client-Spiel, nur der einzelne Spieler betroffen, kein Multi-Tenant. Likelihood: n/a. Impact: low. Mitigation: keine.
</details>

<details>
<summary>End-User (4 Findings)</summary>

1. **Maus-only → mobil unspielbar** — Judge am Handy = toter Link. Likelihood: low-medium. Impact: total-failure (auf dieser Plattform). Mitigation: Touch-Hinweis "Desktop", optional Touch-Fallback. §Task 1/11.
2. **Steuerungs-Ergonomie** — Klick-halten + Trackpad-Move hakelig; Leertaste+Maus parallel ist besser. Likelihood: medium. Impact: friction. Mitigation: in Anleitung klar; beide Eingaben parallel unterstützen (tut der Plan). §Task 11.
3. **Erfolgs-Feedback sichtbar?** — Pops/Combo/Sound liefern Feedback. Likelihood: low. Impact: low. Mitigation: vorhanden (Task 9).
4. **Farbsehschwäche** — Bug-Farben + rote Korruption; durch Form/Label zusätzlich unterscheidbar. Likelihood: low. Impact: low. Mitigation: Labels/Formen bleiben (vorhanden).
</details>

<details>
<summary>PM / Business (3 Findings)</summary>

1. **Scope vs. Zeit** — 13 Tasks, viel Juice, begrenztes Fenster. Likelihood: medium. Impact: other (evtl. unfertig). Mitigation: Task-Reihenfolge → spielbar ab T7, Boss T8, Politur danach; "minimum shippable"-Checkpoint. §gesamt.
2. **Deploy am Ende = Deadline-Risiko** — Pipeline erst spät getestet. Likelihood: low-medium. Impact: total-failure. Mitigation: früher Wegwerf-Deploy (nach T3/T7). §Task 13.
3. **Gold-Plating (Heisenbug-Teleport, IDE-Glitch)** — technisch reizvoll, optional. Likelihood: low. Impact: low (Zeit). Mitigation: gedeckelt; weglassbar wenn Zeit knapp.
</details>

## Empfehlung

**PROCEED.** Keine High-Severity-Blocker — reines statisches Frontend ohne Backend/Secrets/PII.
Vor bzw. während der Ausführung folgende billige Medium-Mitigationen einbauen: (1) `.gitignore` um
`.vercel`/`node_modules` ergänzen (Task 1), (2) Screen-Shake auf `Math.random()`-Jitter (Task 9),
(3) Touch-Hinweis "am Desktop spielen" (Task 11), (4) **früher Wegwerf-Deploy nach Task 3 oder 7**,
um die Vercel-Pipeline vor dem Deadline-Crunch zu de-risken, (5) bewusst NICHT zwischen Task 6 und 8
"fertig" testen (Boss-Wellen-Hänger). Minimum-shippable-Checkpoint nach Task 7/8.
