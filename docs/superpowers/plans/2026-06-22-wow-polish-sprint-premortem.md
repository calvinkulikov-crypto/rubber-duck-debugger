# Premortem: Wow-Polish-Sprint Implementation Plan

**Datum:** 2026-06-22
**Plan:** docs/superpowers/plans/2026-06-22-wow-polish-sprint.md
**Verdikt:** REVISE → nach Patch PROCEED

## Top-Risiken (High Severity)

1. **[End-User] Heavy-FX begräbt spielkritische Texte (Bug-`/commands` + Terminal-Prompt)**
   - Wahrscheinlichkeit: medium
   - Impact: total-failure (Kernspielbarkeit/Judge-Eindruck — man muss die Commands lesen können)
   - Mitigation: Playtest-Gate (Task 7-Gate) um expliziten Check erweitern: fallende Bug-Command-Labels
     **und** Terminal-Prompt müssen trotz Scanlines/Vignette/Flow-Glow klar lesbar bleiben, besonders an
     den Rändern (Vignette dort am dunkelsten) und bei grünem Flow-Glow (grün-auf-grün). Wenn nicht:
     `CONFIG.fx.vignette` und `CONFIG.fx.scanlineAlpha` senken; Flow-Glow-Alpha (0.22-Faktor in `drawFlow`)
     reduzieren. Zusätzlich Hinweis in Task 4, dass FX die Bug-Labels nicht überdecken darf.
   - Plan-Sektion betroffen: §Task 4, §Task 6, §Task 7-Gate

## Medium Severity

- **[End-User] Hit-Stop bei Kill-Salven evtl. stotterig** — 0.05s-Freeze pro Kill kann bei schneller
  Combo als Ruckeln statt Wucht wirken. Mitigation: im Gate prüfen; bei Stottern `this.hitstop`-Wert in
  Task 3 senken (0.03) oder nur für Boss/Special. — Plan §Task 3
- **[End-User] Key-Klick pro Buchstabe evtl. ermüdend/laut** — Mitigation: gain niedrig (0.025), im Gate
  prüfen, Mute verfügbar. — Plan §Task 5
- **[Engineer] Render-Kosten pro Frame** — Scanline-Loop + 3 Gradienten + `shadowBlur`. Mitigation:
  Gate prüft flüssige Framerate; falls Drops → Scanlines als `createPattern` cachen. — Plan §Task 4

## Low Severity / Observations

- **[Engineer] Task-Reihenfolge-Abhängigkeit** (`_mult` 5→6, `fx.flowThreshold` 4→6) — durch sequenzielle
  Ausführung gedeckt; im Plan vermerkt.
- **[End-User] Mute-Icon-Discoverability** — Icon ohne Label unten rechts; Sound default an, Mute ist Bonus.
- **[Ops] Live-only-Render-Bug** — durch Browser-Playtest vor Merge abgefangen.

## Persona-Reports (collapsed)

<details>
<summary>Engineer (3 Findings)</summary>

1. **Hit-Stop-Decay** — `this.hitstop -= dt` vor `dt *= 0.1` → decayt mit echter Zeit, kein Stuck-Freeze. OK.
2. **Tokenizer-Scope** — `tokenizeLine` nur für 10 fixe Code-Zeilen relevant; Reconstruct-Test sichert
   Verlustfreiheit. Funktionsname-Heuristik (`/^\s*\(/`) trifft die vorhandenen Zeilen korrekt.
3. **Render-Kosten/Reihenfolge** — siehe Medium/Low.
</details>

<details>
<summary>Security (0 Findings)</summary>

Statischer Client, kein Backend/Netzwerk, kein `eval`/`innerHTML`, keine neue Dependency, nur
`localStorage`-Integer (Best-Score). Keine relevante Angriffsfläche durch diesen Plan.
</details>

<details>
<summary>Ops (2 Findings)</summary>

1. **Rollback-Design sauber** — `wow-polish`-Branch, `main` = Fallback, Merge erst nach Playtest-Gate,
   Push pro Task (Challenge-Push-Verlauf erfüllt).
2. **Deploy-Risiko** — Live rendert evtl. anders als headless; Browser-Playtest vor Merge fängt das ab.
</details>

<details>
<summary>End-User (3 Findings)</summary>

1. **FX-Lesbarkeit** (High) — siehe Top-Risiken.
2. **Hit-Stop-Stottern** (Medium) — siehe Medium.
3. **Key-Klick-Ermüdung** (Medium) — siehe Medium.
</details>

<details>
<summary>PM (2 Findings)</summary>

1. **Priorisierung gut** — höchster Wow zuerst, Stretch gegated, Teil-Merge möglich (jeder Commit grün).
2. **Deadline realistisch** — Muss-Set klein; ~24h-Fenster reicht; Fallback sichert Abgabe selbst bei Abbruch.
</details>

## Empfehlung

PROCEED nach Patch in §Task 4 + §Task 7-Gate: den High-Befund (FX-Lesbarkeit) durch einen expliziten
Gate-Check für Bug-Command-Labels + Terminal-Prompt entschärfen und FX-Werte als tunebaren Deckel
behandeln. Alle übrigen Befunde sind Medium/Low und über das bestehende Playtest-Gate + tunebare
`CONFIG.fx`/Mute abgedeckt. Kein Blocker.
