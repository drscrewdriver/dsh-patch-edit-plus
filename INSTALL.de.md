# Installationsanleitung (offizielle DSH-CLI)

Diese Anleitung verwendet ausschließlich den offiziellen DSH-Befehl `dsh plugin`. Dieser Befehl installiert die Abhängigkeit in ein Profil und synchronisiert `dsh.profile.bundles`. Ersetzen Sie ihn nicht durch bloßes `npm install`, ein direktes `pnpm add` im Profil oder manuelle Bearbeitungen des Profil-Manifests.

- [Englische Installationsanleitung](./INSTALL.md)
- [Chinesische Installationsanleitung](./INSTALL.zh.md)
- [Japanische Installationsanleitung](./INSTALL.ja.md)
- [Koreanische Installationsanleitung](./INSTALL.ko.md)
- [Deutsche Installationsanleitung](./INSTALL.de.md)
- [Französische Installationsanleitung](./INSTALL.fr.md)
- [Italienische Installationsanleitung](./INSTALL.it.md)
- [Russische Installationsanleitung](./INSTALL.ru.md)
- [Spanische Installationsanleitung](./INSTALL.es.md)
- [Englisches README](./README.md)
- [Chinesisches README](./README.zh.md)
- [Japanisches README](./README.ja.md)
- [Koreanisches README](./README.ko.md)
- [Deutsches README](./README.de.md)
- [Französisches README](./README.fr.md)
- [Italienisches README](./README.it.md)
- [Russisches README](./README.ru.md)
- [Spanisches README](./README.es.md)
- [Änderungsprotokoll](./CHANGELOG.md)
- [Japanisches Änderungsprotokoll](./CHANGELOG.ja.md)
- [Koreanisches Änderungsprotokoll](./CHANGELOG.ko.md)
- [Deutsches Änderungsprotokoll](./CHANGELOG.de.md)
- [Französisches Änderungsprotokoll](./CHANGELOG.fr.md)
- [Italienisches Änderungsprotokoll](./CHANGELOG.it.md)
- [Russisches Änderungsprotokoll](./CHANGELOG.ru.md)
- [Spanisches Änderungsprotokoll](./CHANGELOG.es.md)

Die Platzhalter in dieser Anleitung sind:

- `<profile>`: das zu ändernde DSH-Profil, üblicherweise `web`;
- `dsh-patch-edit-plus`: das npm-Paket, die Laufzeit-Plugin-ID und die ID der einzigen Zeile, die der Bundle-Patch einfügt.

> **Unterstützter DSH-Bereich: `0.1.0-rc.8` bis `0.2.0-rc.2` (einschließlich Desktop) — eine einzige Version, v0.4.0.**
>
> Prüfen Sie zunächst mit `dsh --version` die laufende Version.
>
> | DSH-Version | Status | Hinweise |
> | --- | --- | --- |
> | `0.2.0-rc.1` ~ `0.2.0-rc.2` (einschließlich Desktop) | unterstützt | Dieselbe v0.4.0. |
> | `0.1.0-rc.8` ~ `0.1.7-rc.2` | unterstützt | Dieselbe v0.4.0 — keine Auswahl von Zweig oder Dist-Tag nötig. |
>
> Installieren Sie auf jeder unterstützten Host-Linie `latest`: eine einzige Version bedient 0.1.x und 0.2.x gleichermaßen. Nach der Veröffentlichung zeigen die Dist-Tags `latest`, `dsh-0.2.0`, `dsh-0.1.7`, `dsh-0.1.5` und `dsh-0.1.2` alle auf 0.4.0.

## 0. Voraussetzungen und Profil-Ermittlung

```bash
echo "DSH_HOME=${DSH_HOME:-$HOME/.dsh}"
dsh --version
ls "${DSH_HOME:-$HOME/.dsh}/profiles"
```

Benutzen Sie das Profil, das Ihr laufender DSH-Prozess nennt. `web` ist üblich, aber das aktive `--profile`-Argument ist maßgeblich.

## 1. Offizielle Installation

```bash
dsh plugin --profile <profile> add dsh-patch-edit-plus -w
```

(Das Flag `-w` ist erforderlich, wenn das Profil eine pnpm-Workspace-Wurzel ist, wie es bei `web` der Fall ist.)

Eine bestimmte Version explizit installieren:

```bash
dsh plugin --profile <profile> add dsh-patch-edit-plus@0.4.0 -w
```

Die offizielle CLI aktualisiert die Profil-Abhängigkeit, die Lockdatei und `dsh.profile.bundles` automatisch. Fügen Sie keine manuelle YAML-Zeile hinzu.

### Abkühlphase der Lieferkette

Die DSH-Laufzeit verwendet pnpm 11, dessen `minimumReleaseAge`-Richtlinie eine frisch veröffentlichte Version mit `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` blockieren kann. Fügen Sie die Version zu `minimumReleaseAgeExclude` in `~/.dsh/profiles/<profile>/pnpm-workspace.yaml` hinzu:

```yaml
minimumReleaseAgeExclude:
  - dsh-patch-edit-plus@0.4.0
```

## 2. Host neu starten

Dies ist ein **reines Host-Plugin**: Es registriert ein Werkzeug und einen Einstellungsabschnitt auf dem Host und bringt keine Browser-Hälfte mit. Starten Sie den DSH-Host-Prozess nach jeder Installation oder Aktualisierung neu; ein Neuladen der Seite ist weder nötig noch ausreichend.

## 3. Upgrade

```bash
dsh plugin --profile <profile> update dsh-patch-edit-plus -w
```

Starten Sie DSH danach neu.

## 4. Registrierung über lokalen Pfad / `link:` (Alternative)

```bash
#    ~/.dsh/profiles/<profile>/package.json dependencies:
#      "dsh-patch-edit-plus": "link:<absolute path to dsh-patch-edit-plus>"
#    ~/.dsh/profiles/<profile>/cordis.patch.yml:
#      - insert:
#          - id: dsh-patch-edit-plus
#            name: dsh-patch-edit-plus
cd ~/.dsh/profiles/<profile> && pnpm install && dsh web
```

Oder verwenden Sie die offizielle CLI mit einem lokalen Pfad (kein Netz nötig):

```bash
dsh plugin --profile <profile> add /absolute/path/to/dsh-patch-edit-plus -w
```

Der Bau aus einem Quell-Checkout verwendet diese Skripte:

```bash
npm install
npm run build          # tsc -p tsconfig.build.json → lib/ + lib/types/
npm run typecheck      # tsc -p tsconfig.json
npm run verify:source  # source-level assertions
npm run test           # vitest run
npm run smoke          # _smoke/load-smoke.mjs
```

`lib/` wird nicht eingecheckt, daher muss ein Quell-Checkout gebaut werden, bevor er per Pfad registriert werden kann. Die Veröffentlichung baut ihn automatisch über den `prepublishOnly`-Hook, sodass ein veröffentlichtes Tarball immer kompilierte Ausgabe enthält.

## 5. Installation überprüfen

```bash
grep -n "dsh-patch-edit-plus" \
  "${DSH_HOME:-$HOME/.dsh}/profiles/<profile>/package.json"
node -p "require('${DSH_HOME:-$HOME/.dsh}/profiles/<profile>/node_modules/dsh-patch-edit-plus/package.json').version"
```

Prüfen Sie die offizielle Komposition:

```bash
dsh --profile <profile> --dump-default-config
```

Sie muss enthalten:

```yaml
- id: dsh-patch-edit-plus
  name: dsh-patch-edit-plus
```

## 6. Das Plugin überprüfen

Bestätigen Sie nach dem Neustart in einer Sitzung:

1. Das Werkzeug `apply_patch` steht dem Modell zur Verfügung.
2. Ein Unified-Diff-Patch wird angewendet, und der Dateiinhalt entspricht exakt dem Diff.
3. Ein Patch, der die Verifikation nicht besteht, lässt den Workspace unangetastet — die Engine prüft alles lesend, bevor sie irgendetwas schreibt.
4. Ein Patch im Codex-Stil liefert, während `allowCodexPatch` aus ist, einen umsetzbaren Hinweis, der dem Modell sagt, wie es den Stil aktiviert oder im Unified-Diff-Format wiederholt, statt eines generischen Parse-Fehlers.

Stellt ein anderes Plugin bereits ein Werkzeug namens `apply_patch` bereit, entscheidet die dreistufige Konfliktrichtlinie (`rename` als Standard, sonst `skip` / `fail`). Beim Standard `rename` ist der DSH-Start unbeeinträchtigt und das Werkzeug wird unter einem Namen mit Suffix registriert.

## 7. Fehlerbehebung

| Symptom | Maßnahme |
| --- | --- |
| `dsh` wird nicht gefunden | Installieren oder aktivieren Sie die offizielle DSH-CLI. |
| `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` | Fügen Sie die Version zu `minimumReleaseAgeExclude` in der `pnpm-workspace.yaml` des Profils hinzu. |
| `apply_patch` erscheint nicht | Starten Sie den Host-Prozess neu und prüfen Sie die Kompositions-Zeile erneut. |
| Werkzeugnamens-Kollision mit einem anderen `apply_patch`-Provider | Stellen Sie die Konfliktrichtlinie auf `rename` (Standard), `skip` oder `fail`, siehe README. |
| Codex-Syntax abgelehnt | Aktivieren Sie `allowCodexPatch: true` oder senden Sie die Änderung erneut als Unified Diff. |
| Hunk-Fehlanpassung | Lesen Sie die vier Elemente der Diagnostik (Datei + Hunk-Index, Suchursprung, erwartete Vorschau, tatsächlicher Auszug) und senden Sie den Hunk mit passendem Kontext erneut. |

## 8. Entfernen

```bash
dsh plugin --profile <profile> remove dsh-patch-edit-plus
```

Starten Sie DSH danach neu.

## Lizenz

MIT
