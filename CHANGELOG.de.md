# Änderungsprotokoll

## [0.3.0] — 2026-09-29

### Geändert

- **Unterstützung der DSH-0.2.0-Linie (Zweig `compat/0.2.0`).** Die Peer-Bereiche und `engines.dsh` (beide Manifeste) deklarieren nun `>=0.2.0-rc.1 <0.2.1-0`; Version 0.3.0. Die devDependencies pinnen die echte `0.2.0-rc.1`-Typ-Baseline, und das Gegenprüfungsskript wird zu `npm run typecheck:0.2.0` ausgebaut (installiert die echten Peer-Pakete aus der Registry). 0.1.x-Hosts werden weiterhin vom Zweig `compat/0.1.7` / dem Dist-Tag `dsh-0.1.7` bedient.
- **Delete/Move auf die aktuelle Shell-Executor-API migriert.** Zwischen den Host-Linien 0.1.2 und 0.1.7 wurde `ShellExecutor.run(spec)` in `execute(spec)` umbenannt — mit Rückgabe eines `ShellProcess`-Handles samt `result()`-Foreground-Projektion. Der alte devDependency-Pin (`0.1.2-rc.1`) verschleierte das: Das Paket der 0.1.7-Linie (0.2.1) typecheckte grün gegen eine veraltete Baseline, und zur Laufzeit auf echten 0.1.7+-Hosts griff sein auf `run` basierendes Duck-Typing nie, sodass Delete/Move zum strukturierten UNSUPPORTED-Fehler degradierten. Diese Linie ruft `shell.execute(...)` und erwartet `execution.result()`; der Executor wird über `execute` erkannt.

## [0.1.2] — 2026-09-19

### Behoben

- **Der Einstellungsabschnitt wurde nie registriert.** Der Einstellungs-Namespace `patch_edit_plus` enthält einen Unterstrich, den das Namespace-Muster von `dsh-settings` (`^[a-z][a-z0-9-]*$`) ablehnt; `register()` warf daher einen Fehler, bevor irgendetwas persistiert wurde — kein Einstellungseintrag erschien im Panel oder in `~/.dsh/settings.yaml`. Umbenannt in `patch-edit-plus` (keine Migration nötig: der alte Abschnitt konnte nie existieren).
- **Konfigurationsänderungen aus der Einstellungsschicht erreichten das Werkzeug nie.** Die Hooks `setSource`/`onChange` waren No-ops, und die aufgelöste Konfiguration wurde beim Laden einmalig memoisiert. Das Plugin nutzt nun die aufgelöste Quelle: Jede übernommene Einstellungsänderung (oder der Legacy-`register`-Watch) löst die Konfiguration neu auf und registriert das Werkzeug neu — nachdem die alte Registrierung verworfen wurde, da eine Neuregistrierung über einen bereits lebenden Namen ihn still umbenennt. `allowCodexPatch` und jedes andere Feld lassen sich jetzt über das DSH-Einstellungspanel umschalten und wirken sofort, wobei die Werkzeugbeschreibung (die Liste der akzeptierten Patch-Stile) synchron bleibt; kein Prozessneustart erforderlich. Beim Ablösen des Einstellungsdienstes fällt das Plugin auf den Kompositionseintrag zurück, und die Neubewertung ist idempotent (die gesamte aufgelöste Konfiguration wird verglichen, nicht nur ein Feld).

## [0.1.1] — 2026-09-17

### Behoben

- **Jeder Schreibvorgang wurde unter `workspace-write` verweigert.** Das Werkzeug übergab keine `sandboxPolicy` pro Aufruf, daher fiel das durchsetzende Dateisystem auf `ctx.sandboxPolicy.resolve()` ohne Gültigkeitsbereich zurück — die DEPLOYMENT-Workspace-Wurzel (das Startverzeichnis des Servers) statt des Session-cwd. Ein eindeutig innerhalb des Session-Workspaces liegender Pfad scheiterte daher an der Eingrenzung und lieferte `file access denied under workspace-write mode`, selbst in einer `danger-full-access`-Sitzung, in der der Modus nicht einmal gelesen wurde. Die Richtlinie wird jetzt pro Aufruf mit der aufrufenden Sitzung im Gültigkeitsbereich aufgelöst (`resolve({ session })`) und jedem Schreibvorgang sowie jeder Delete/Move-Shell-Anfrage aufgeprägt — genau wie es die nativen `write`/`edit`-Werkzeuge tun. Beide Hälften des Modus werden nun beachtet: die `sandbox/mode`-Übersteuerung der Sitzung und deren cwd als Workspace-Wurzel.
- Pfadauflösung und Zaun teilen sich nun eine Wurzel: Der Plan löst jedes Ziel gegen die `workspaceRoot` der Richtlinie auf (mit Rückfall auf das Session-cwd), sodass der Pfad, den die Engine schreibt, der Pfad ist, den der Zaun misst.

## Unreleased

### Hinzugefügt

- Einziges dem Modell zugängliches Werkzeug `apply_patch`, das git/unified diff (Standard) und die Codex-`apply_patch`-Syntax (Opt-in über `allowCodexPatch`) akzeptiert.
- Automatische Formaterkennung mit umsetzbarem Hinweis, wenn ein erkannter, aber deaktivierter Stil eintrifft.
- Operationen Add / Update (multi-hunk) / Delete / Move; Delete und Move laufen über den sandbox-bewussten `ctx.shell`, Pfade werden ausschließlich über Umgebungsvariablen übergeben.
- Zweiphasige Alles-oder-Nichts-Engine: vollständige Lese-Verifikation (Kontextlokalisierung mit drei Toleranzstufen, Workspace-Eingrenzung, Symlink-Ablehnung, Erkennung doppelter Pfade) vor jedem Schreibvorgang.
- Offizieller Write-Intent-Ablauf bei jedem Schreibvorgang: `fs/write-intent`-Wasserfall → geschütztes `writeText` → `fs/observed`-Emission, damit die Read-before-Write-Schranke für Patch-Schreibvorgänge gilt.
- Vier Elemente umfassende Diagnostik bei Hunk-Fehlanpassung (Datei + Hunk-Index, Suchursprung, erwartete Vorschau mit sichtbarem Whitespace, tatsächlicher Auszug) plus gezielter Hinweis.
- Parameter `dryRun` und Konfiguration `dryRunByDefault`.
- Gruppierte Ausgabe nach Codex-Semantik (added → modified → deleted) mit je-Datei-Diffs, begrenzt durch `maxDiffBytes`, und replay-sicherem `presentationMeta`.
- Dreistufiger Schutz vor Werkzeugnamens-Konflikten (`rename` Standard / `skip` / `fail`), sodass Namenskollisionen mit anderen `apply_patch`-Providern den DSH-Start nie brechen.
- DSH-`0.1.2-rc.1` ~ `0.1.5-rc.2`-Kompatibilität: einzelner Codepfad zur Werkzeigerstellung plus statische Verifikation `typecheck:0.1.5` gegen die 0.1.5-rc.2-Peer-Pakete; Dual-API-Fallback für Einstellungen (`installSection` / `register`).
