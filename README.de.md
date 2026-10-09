# dsh-patch-edit-plus

Deutsch | [English](./README.md) | [简体中文](./README.zh.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md) | [Français](./README.fr.md) | [Italiano](./README.it.md) | [Русский](./README.ru.md) | [Español](./README.es.md)

Patch-basierte Dateibearbeitung für [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness): ein einzelnes, dem Modell zugängliches `apply_patch`-Werkzeug, das **git/unified diff** (Standard) und die **Codex-`apply_patch`-Syntax** (Opt-in) akzeptiert, jede Änderung nach dem **Alles-oder-Nichts**-Prinzip anwendet und DSH dabei vollständig aus dem Weg geht.

## DSH-Versionskompatibilität

**v0.4.0 ist eine einzelne Version, die die gesamte Host-Linie abdeckt**: eine Version bedient alle DSH von `0.1.0-rc.8` bis `0.2.0-rc.2` (alle 15 RCs plus Desktop). Die vier eingestellten Linien (`compat/0.1.2`, `compat/0.1.5`, `compat/0.1.7` und das `main`-Aufteilungsschema) sind retired; nach der Veröffentlichung zeigen die npm-Dist-Tags `latest`, `dsh-0.2.0`, `dsh-0.1.7`, `dsh-0.1.5` und `dsh-0.1.2` alle auf 0.4.0.

| DSH-Version | Status | Hinweise |
|---|---|---|
| `0.2.0-rc.1+` | ✅ unterstützt (dieselbe v0.4.0) | Deklarative Einstellungen: mit `.volatile()` markierte Felder werden zum Einstellungsformular, und `loader/volatile-update` registriert das Werkzeug ohne Remount neu. Die Konfigurationskarte auf der Plugin-Seite (Client-Hälfte) hat auf dieser Linie einen Platz. |
| `0.1.0-rc.8` ~ `0.1.7-rc.2` | ✅ unterstützt (dieselbe v0.4.0) | Einstellungen je Generation: Instanz-`settings.installSection`/`register` (0.1.2/0.1.5) oder das modulweite `installSettingsSection` von `@deepseek-ai/dsh-settings` (0.1.0/0.1.1). Die Konfigurationskarte auf der Plugin-Seite fehlt hier elegant. |

**Verhaltensänderung:** `allowCodexPatch` hat nun den Standardwert `false` (Opt-in, an der 0.2.0-Linie ausgerichtet). Wer von der alten 0.1.7-Linie (dort Standard `true`) aufrüstet, muss den Schalter nach dem Upgrade manuell aktivieren.

Die Einstellungen umfassen drei Host-Generationen, alle von dieser einen Version bedient: auf 0.1.7+ (und Desktop) ist die Konfiguration deklarativ — mit `.volatile()` markierte Felder in `Config` sind das Einstellungsformular, und das Plugin abonniert `loader/volatile-update`; auf 0.1.2/0.1.5 nutzt es die Instanz-APIs `settings.installSection`/`register`; auf 0.1.0/0.1.1 das modulweite `installSettingsSection` von `@deepseek-ai/dsh-settings`. Die Konfigurationskarte auf der Plugin-Seite (Client-Hälfte) hat nur auf 0.1.7+/Desktop einen Platz und fehlt auf älteren Linien elegant.

Die Werkzeugfähigkeiten sind auf jeder Linie identisch: ein einziges `apply_patch`-Werkzeug, git/unified diff als Standard plus Codex als Opt-in, Alles-oder-Nichts-Anwendung, der Read-before-Write-Intent-Tanz (auf Linien ohne write-intent im `fs` degradieren Schreibvorgänge zu direkten Schreibzugriffen mit genau einem `console.warn`) und sandbox-bewusstes Delete/Move.

## Warum überhaupt Patches? (Tool-Routing-Leitfaden)

Die Werkzeugbeschreibung leitet das Modell ausdrücklich:

- **Einzelne kleine Änderung in einer bereits gelesenen Datei** → bevorzugen Sie das native `edit`-Werkzeug (ein Patch kostet mehr Tokens als eine wörtliche Bearbeitung).
- **Kleine Änderung in einer GROSSEN Datei** → `apply_patch` (die ganze Datei muss nicht zurückgeschickt werden).
- **Gebündelte Änderungen über VIELE Dateien** → `apply_patch` (ein Aufruf, atomar verifiziert).
- **Neue Datei mit substanziellem Inhalt / Löschen / Umbenennen** → `apply_patch`.

## Installation

```bash
dsh plugin --profile web add <path-to-dsh-patch-edit-plus>
dsh web --dump-config   # verify the plugin row appears
# restart DSH
```

## Verwendung

### Unified Diff (Standard, aktiviert)

```text
--- a/src/app.ts
+++ b/src/app.ts
@@ -10,4 +10,4 @@ export function main() {
   init()
-  start(oldPort)
+  start(newPort)
   await shutdown()
 }
```

### Codex apply_patch-Syntax (Opt-in)

```text
*** Begin Patch
*** Update File: src/app.ts
@@
   init()
-  start(oldPort)
+  start(newPort)
*** Add File: docs/notes.md
+# Notes
*** Delete File: tmp/junk.txt
*** Move to: src/app.ts   (via `*** Move to:` after *** Update File:)
*** End Patch
```

Aktivieren mit `allowCodexPatch: true`. Trifft ein Codex-Patch ein, während die Option deaktiviert ist, liefert das Werkzeug einen **umsetzbaren Hinweis** (wie man sie aktiviert oder wie man im Unified-Diff-Format wiederholt) statt eines generischen Parse-Fehlers — die Codex-Syntax ist ein starker Prior für Modelle der GPT-Familie, und ein stilles Scheitern fängt sie in Wiederholungsschleifen.

### Operationen

| Operation | Unified Diff | Codex | Ausführungspfad |
|---|---|---|---|
| Hinzufügen | `new file mode` + `/dev/null` | `*** Add File:` | `ctx.fs.writeText` (offizieller Intent-Ablauf) |
| Aktualisieren (multi-hunk) | `@@` hunks | `@@` hunks | `ctx.fs.writeText` |
| Löschen | `deleted file mode` + `/dev/null` | `*** Delete File:` | `ctx.shell` (sandbox-bewusst, Pfad per env übergeben) |
| Verschieben / Umbenennen | `rename from/to` | `*** Move to:` | `ctx.shell` |

## Garantien

- **Alles-oder-Nichts**: Der gesamte Patch wird zuerst gegen den aktuellen Dateiinhalt verifiziert (Kontextlokalisierung, Workspace-Eingrenzung, Symlink-Richtlinie, doppelte Pfade); jeder Fehler bricht ab, ohne dass ein einziges Byte geschrieben wurde.
- **Einhaltung der Read-before-Write-Schranke**: Jeder Schreibvorgang reproduziert den Intent-Ablauf des offiziellen `write`-Werkzeugs — `fs/write-intent`-Wasserfall → geschütztes `writeText` → `fs/observed`-Emission. Ein nacktes `writeText` würde die Schranke still umgehen, da DSH-Provider `fs/*`-Ereignisse nie selbst dispatchen.
- **Präzise Fehlerdiagnostik**: Bei einer Hunk-Fehlanpassung trägt der Fehler Datei + Hunk-Index, Ursprungszeile der Suche, Vorschau der erwarteten Zeile (Whitespace sichtbar gemacht), den tatsächlichen Dateiauszug sowie einen gezielten Hinweis.
- **Zeilenende-Treue**: CRLF-Dateien werden als CRLF zurückgeschrieben; Enden ohne abschließenden Zeilenumbruch bleiben erhalten, sofern der Patch das Ende nicht ändert.
- **Reine Ergänzung**: Das Plugin registriert genau ein Werkzeug, ruft nie `tools.restrict()` auf, überschreibt nie ein natives Werkzeug, registriert keine globalen Dienste und entfernt beim Entladen alles. Namenskonflikte mit anderen `apply_patch`-Providern (`bainianlaoyao/dsh-codex-mode`, `shuind/dsh-codex-harness`, …) werden durch Umbenennungs-Vermeidung gelöst (`apply_patch_1`, `…_2`, …), sodass DSH beim Start nie scheitert.

## Konfiguration

| Option | Standard | Beschreibung |
|---|---|---|
| `toolName` | `apply_patch` | Name des dem Modell zugänglichen Werkzeugs. |
| `conflictPolicy` | `rename` | `rename` / `skip` / `fail`, wenn der Werkzeugname bereits vergeben ist. |
| `renameSuffix` | `_1` | Suffix, das von der Umbenennungs-Vermeidung verwendet wird. |
| `allowUnifiedDiff` | `true` | Akzeptiert git/unified diffs. |
| `allowCodexPatch` | `false` | Akzeptiert die Codex-`apply_patch`-Syntax. Auch im DSH-Einstellungspanel änderbar; Änderungen wirken sofort, kein Neustart nötig. |
| `deleteBackend` | `shell` | `shell` oder `none` (Delete/Move liefern einen strukturierten Fehler). |
| `shellDialect` | `auto` | `auto` (pwsh unter win32) / `posix` / `pwsh`. |
| `deleteCommand` / `moveCommand` | built-in | Eigene Befehlsvorlagen. Pfade kommen weiterhin **ausschließlich per env** an (`DSH_PATCH_TARGET` / `DSH_PATCH_SOURCE`); interpolieren Sie sie nie in den Befehlsstring. |
| `dryRunByDefault` | `false` | Aufrufe als Probelauf (Dry Run) behandeln, außer bei `dryRun: false`. |
| `followSymlinks` | `false` | Erlauben, dass Patch-Pfade Symlinks folgen. |
| `maxFiles` | `50` | Maximale Anzahl Dateiabschnitte pro Patch. |
| `maxPatchBytes` | `524288` | Maximale Größe des Patch-Texts in Bytes. |
| `maxDiffBytes` | `16384` | Maximale Größe des je Datei in den Ergebnis-Metadaten behaltenen Diffs (größere Diffs werden geleert und mit `truncated` markiert). |

## Einschränkungen (offengelegt)

- **Delete/Move laufen über `ctx.shell`.** Die Sandbox-Stärke ist genau die, die der geladene Shell-Executor durchsetzt (`bash-sandbox` grenzt ab; `bash-local` nicht) — dieselbe Risikoposition wie beim nativen bash-Werkzeug. Jede Anfrage trägt eine `sandboxPolicy` und berichtet Sandbox-Fakten, damit „Richtlinie verweigert“ von „Befehl fehlgeschlagen“ unterscheidbar ist.
- **Jeder Schreibvorgang und jeder Delete/Move trägt die Sitzungsbezogene Richtlinie.** `apply_patch` löst `ctx.sandboxPolicy.resolve({ session })` pro Aufruf auf — die Modus-Übersteuerung der Sitzung plus deren cwd als Workspace-Wurzel — genau wie die nativen `write`/`edit`-Werkzeuge, und löst die Planknotenpfade gegen dieselbe Wurzel auf. Ohne sie fällt das durchsetzende Dateisystem auf die Deployment-Wurzel zurück, wodurch Schreibvorgänge im Workspace als `workspace-write`-Verweigerungen fehlschlagen, selbst in einer `danger-full-access`-Sitzung. Eine `workspace-write`-Verweigerung tritt als `PatchError` auf, deren Nachricht den Backend-Text trägt (der strukturierte `[sandbox: …]`-Marker und die Same-Turn-Escalation-Felder sind nicht implementiert; benutzen Sie die nativen `write`/`edit`-Werkzeuge, wenn Sie eskalieren müssen).
- **Add erzeugt keine übergeordneten Verzeichnisse.** Das entspricht dem nativen `write`-Werkzeug (`ctx.fs` hat kein mkdir); der Fehler nennt das fehlende Verzeichnis.
- Kein unscharfes/Offset-basiertes Matching: Die Hunk-Lokalisierung ist exakt → `trimEnd` → `trim`, und das absichtlich (unscharfes Matching ist bei destruktiven Operationen unsicher; es steht auf der Roadmap).
- Binär-Patches werden mit einer klaren Fehlermeldung abgelehnt.

## Entwicklung

```bash
npm install
npm run typecheck        # against 0.2.0-rc.1 peers (devDependencies)
npm run typecheck:0.2.0  # against real 0.2.0-rc.1 peer packages installed from the registry (dual-baseline proof)
npm test                 # vitest, 92 tests
npm run lint
npm run build            # lib/
npm run verify:source    # static safety assertions (intent dance, no node:fs, …)
npm run smoke            # load-level smoke against a stub host
```

Die manuelle Verifikation auf einem laufenden DSH (`dsh plugin --profile web add` → Neustart → Aufruf des Werkzeugs in einer Sitzung) ist bewusst dem Betreiber überlassen.

## Lizenz

MIT
