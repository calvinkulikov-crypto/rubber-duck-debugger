# Projekt: Rubber Duck Debugger 🦆

Minigame für die SKAILE Academy Building Challenge. Vanilla HTML/CSS/JS auf `<canvas>`,
statisches Deploy (Vercel). Eine harte Vorgabe der Challenge: **eine Gummiente muss im Spiel
vorkommen** — hier ist sie die zentrale Spielfigur/Waffe.

Deadline: **Dienstag 18:00**. Abgabe = Repo-Link + Live-Game-Link im Community-Abgabe-Thread.
Bewertet wird: 1) läuft es? 2) Kreativität 3) saubere Umsetzung. Top 3 machen Walkthrough.

## Push-Regeln (strikt — Challenge prüft den Push-Verlauf, nicht das Commit-Datum)

- **Nach jedem abgeschlossenen Arbeitsschritt sofort committen und pushen:**
  `git add -A`, kurze klare Message, `git push`. An den Fortschritt gekoppelt, kein Timer —
  immer wenn wieder ein Stück fertig ist.
- **Nur zu `origin`** (mein eigenes Repo `calvinkulikov-crypto/rubber-duck-debugger`) pushen.
  Push-Ziel niemals ändern.
- "Lokal bauen und am Ende alles in einem Schwung hochladen" ist laut Regeln **verboten**.

## Session-Start

Zu Beginn jeder neuen Session zuerst `git log --oneline -15` und `git status` anschauen,
dann `AUDIT.md` lesen (Stand / nächste Schritte / Blocker), kurz orientieren, dann nahtlos
weiterbauen — weiterhin mit Push nach jedem Schritt.

## Tech-Leitplanken

- **Keine externen Assets** (keine Bild-/Sound-Dateien). Grafik komplett auf Canvas gezeichnet,
  Sound via WebAudio synthetisiert. Grund: kein kaputter Pfad / 404 beim Vercel-Deploy.
- Relative Pfade (`./...`), Dateinamen klein (Vercel/Linux ist case-sensitive).
- Canvas intern 800×600, CSS skaliert responsiv.

## Design / Spec

Vollständiges Design: `docs/superpowers/specs/` (Spec-Datei). Implementierungsplan: `docs/plans/`.
