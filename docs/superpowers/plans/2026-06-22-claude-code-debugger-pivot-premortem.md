# Premortem: Claude-Code Debugger (Command-Typing Pivot) Implementation Plan

**Datum:** 2026-06-22
**Plan:** ./2026-06-22-claude-code-debugger-pivot.md
**Verdikt:** REVISE

## Top-Risiken (High Severity)
1. **[Ops] Push-nach-jedem-Task auf `main` hinterlässt unspielbaren HEAD mitten in der Pivot-Sequenz**
   - Wahrscheinlichkeit: high (folgt direkt aus Plan-Struktur + CLAUDE.md-Push-Regel)
   - Impact: total-failure (deploybarer Stand kaputt, wenn Deadline mitten in Task 3–5 fällt)
   - Mitigation: Pivot auf Branch `pivot-typing` bauen, nach jedem Task **den Branch** zu `origin` pushen (erfüllt Push-Regel). `main`-HEAD bleibt das fertige statische T1–T12-Game = jederzeit deploybares Fallback. Merge nach `main` erst nach Task 6 + bestandenem Playtest. Deploy (Task 7) aus `main`. Patch: neue Task 0 + Global-Constraints-Zeile.
   - Plan-Sektion betroffen: §Global Constraints, §Task 1–7 (Push-Ziel), §Task 7

## Medium Severity
- **[Engineer] `handleChar` filtert Eingabe nicht: Space/Großschreibung lösen Syntax-Error aus** — Space (`e.key === " "`) und CapsLock-Großbuchstaben matchen keinen Lowercase-Command → Combo bricht ohne Tippfehler. — Plan §Task 3
- **[End-User] Tippfehler droppt den ganzen Buffer + Lock** — ein Fehlanschlag auf `/refactor` setzt allen Fortschritt zurück (zu hart vs. ZType, das nur das Falsch-Zeichen ignoriert). — Plan §Task 3
- **[End-User] Mental-Model-Shift Shooter→Typing** — Judges, die die alte Version kannten, erwarten Schießen; nur via Titel/Intro signalisiert. — Plan §Task 4, §Task 6
- **[End-User] Always-nearest Auto-Lock nimmt Ziel-Wahl** — bei zwei Bugs gleichen Präfixes kann der Spieler den tieferen nicht überspringen. — Plan §Task 1, §Task 3
- **[PM] Timeline: 7 Tasks am Vortag der 18:00-Deadline, Browser-Verifikation nicht automatisierbar (kein Playwright)** — Playtest ist load-bearing und hängt an Calvin. Durch Branch-Fallback entschärft. — Plan §Task 7

## Low Severity / Observations
- **[Engineer] `fireCd` ist nach Umbau vestigial** — wird gesetzt, gatet aber nichts mehr. Harmlos, kann später raus. — §Task 3
- **[Security] `preventDefault` auf allen 1-Zeichen-Keys** — Modifier-Kombis sind ausgenommen, F-Keys haben `key.length>1`; kein realer Konflikt. — §Task 5
- **[Security] Kein XSS/Secret-Vektor** — Text wird auf Canvas gezeichnet (kein DOM), keine Secrets, localStorage bereits try/catch. — §Task 6
- **[PM] Boss-Command-Sequenz ist das komplexeste Stück für marginalen Mehrwert** — bei Zeitnot erste Schnittlinie: Boss auf Einzel-Command zurückstufen. — §Task 2/3

## Persona-Reports (collapsed)
<details>
<summary>Engineer (4 Findings)</summary>

1. **Space/Case-Eingabe = ungewollter Syntax-Error** — `handleChar(e.key)` bekommt `" "` (Space) und ggf. Großbuchstaben (CapsLock). Beides matcht keinen Lowercase-Command → `syntaxError`. Mitigation: in `handleChar` `ch = ch.toLowerCase(); if (ch === " ") return;`. Likelihood medium, Impact wrong-result/UX. §Task 3.
2. **Buffer-Drop bei Tippfehler verliert Fortschritt** — siehe End-User; technisch: `syntaxError` ruft `releaseTarget`. Likelihood high, Impact UX. §Task 3.
3. **`fireCd` vestigial** — kein Gate mehr. Likelihood high, Impact none. §Task 3.
4. **Boss-`command`-Getter undefined nach letzter Sequenz** — nur erreichbar bei totem Boss, der gefiltert wird; `pickTarget` skippt `!b.command`. Kein Crash. Likelihood low, Impact none. §Task 2.
</details>

<details>
<summary>Security (3 Findings)</summary>

1. **Keine Secrets/Backend** — rein statisch, kein Auth, keine API. Likelihood low, Impact none.
2. **Kein XSS** — Canvas-Text, kein innerHTML. Likelihood low, Impact none.
3. **`preventDefault`-Umfang** — Modifier ausgenommen; harmlos. Likelihood low, Impact none.
</details>

<details>
<summary>Ops / Reliability (3 Findings)</summary>

1. **Unspielbarer `main`-HEAD mitten in der Sequenz** — High, siehe oben. Mitigation: Branch. §Global/Task 7.
2. **Vercel-Deploy interaktiver Login** — manuell, dokumentiert (Task 7). Likelihood low, Impact none.
3. **Kein Monitoring** — statisches Game, N/A. Likelihood low, Impact none.
</details>

<details>
<summary>End-User (4 Findings)</summary>

1. **Tippfehler zu hart bestraft** — ganzer Command-Fortschritt weg. Mitigation: Combo brechen, aber Lock+Buffer behalten. Likelihood high, Impact UX. §Task 3.
2. **Mental-Model-Shift** — Shooter→Typing. Via Intro+Titel signalisiert. Likelihood medium, Impact adoption. §Task 4/6.
3. **Always-nearest-Lock** — keine Ziel-Wahl. Intendiert (anfängerfreundlich), aber verifizieren. Likelihood medium, Impact UX. §Task 1/3.
4. **Erfolgs-Feedback ok** — Pop + FloatingText(command). Likelihood low, Impact none.
</details>

<details>
<summary>PM / Business (3 Findings)</summary>

1. **Timeline-Druck** — 7 Tasks, Vortag, Playtest manuell. Durch Branch-Fallback entschärft. Likelihood medium, Impact schedule. §Task 7.
2. **Playtest single-point (Calvin/Browser)** — nicht automatisierbar hier. Dokumentiert. Likelihood medium, Impact schedule. §Task 7.
3. **Boss-Sequenz = Gold-Plating-Risiko** — erste Schnittlinie bei Zeitnot. Likelihood low, Impact none. §Task 2/3.
</details>

## Empfehlung
REVISE mit drei konkreten Patches, dann PROCEED: (1) **Branch-Strategie** — Pivot auf `pivot-typing`, `main` bleibt deploybares statisches Fallback, Merge erst nach Playtest (löst das einzige High). (2) **`handleChar`-Normalisierung** — Space ignorieren, `toLowerCase` (§Task 3). (3) **Weicherer Tippfehler** — Combo brechen, aber Lock+Buffer behalten statt droppen (§Task 3). Patches sind klein und additiv; danach ist das Risikoprofil nur noch Medium/Low → Ausführung freigegeben.
