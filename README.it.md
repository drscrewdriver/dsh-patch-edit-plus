# dsh-patch-edit-plus

Italiano | [English](./README.md) | [简体中文](./README.zh.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md) | [Français](./README.fr.md) | [Deutsch](./README.de.md) | [Русский](./README.ru.md) | [Español](./README.es.md)

Modifica di file in stile patch per [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness): un unico strumento `apply_patch` esposto al modello, che accetta i **diff git/unificati** (predefinito) e la **sintassi `apply_patch` di Codex** (opt-in), applica ogni modifica secondo il principio del **tutto-o-nulla** e resta completamente fuori dai piedi di DSH.

## Compatibilità delle versioni DSH

**La v0.4.0 è una singola versione che copre l'intera linea di host**: una sola versione serve tutti i DSH da `0.1.0-rc.8` a `0.2.0-rc.2` (tutti i 15 rc più desktop). Le quattro linee dismesse (`compat/0.1.2`, `compat/0.1.5`, `compat/0.1.7` e lo schema di biforcazione `main`) sono ritirate; dopo la pubblicazione, i dist-tag npm `latest`, `dsh-0.2.0`, `dsh-0.1.7`, `dsh-0.1.5` e `dsh-0.1.2` punteranno tutti a 0.4.0.

| Versione DSH | Stato | Note |
|---|---|---|
| `0.2.0-rc.1+` | ✅ supportato (stessa v0.4.0) | Impostazioni dichiarative: i campi contrassegnati con `.volatile()` diventano il modulo delle impostazioni, e `loader/volatile-update` registra nuovamente lo strumento senza remount. La scheda di configurazione nella pagina del plugin (metà client) ha un posto su questa linea. |
| `0.1.0-rc.8` ~ `0.1.7-rc.2` | ✅ supportato (stessa v0.4.0) | Impostazioni per generazione: `settings.installSection`/`register` di istanza (0.1.2/0.1.5) oppure `installSettingsSection` a livello di modulo di `@deepseek-ai/dsh-settings` (0.1.0/0.1.1). La scheda di configurazione nella pagina del plugin è assente con eleganza qui. |

**Cambio di comportamento:** `allowCodexPatch` ora è `false` per impostazione predefinita (opt-in, allineato alla linea 0.2.0). Chi esegue l'aggiornamento dalla vecchia linea 0.1.7 (dove il predefinito era `true`) deve attivare l'interruttore manualmente dopo l'aggiornamento.

Le impostazioni attraversano tre generazioni di host, tutte servite da questa singola versione: su 0.1.7+ (e desktop) la configurazione è dichiarativa — i campi contrassegnati con `.volatile()` in `Config` sono il modulo delle impostazioni e il plugin si iscrive a `loader/volatile-update`; su 0.1.2/0.1.5 usa le API di istanza `settings.installSection`/`register`; su 0.1.0/0.1.1 usa `installSettingsSection` a livello di modulo di `@deepseek-ai/dsh-settings`. La scheda di configurazione nella pagina del plugin (metà client) ha un posto solo su 0.1.7+/desktop ed è assente con eleganza sulle linee precedenti.

Le capacità dello strumento sono identiche su ogni linea: un unico strumento `apply_patch`, diff git/unificato per impostazione predefinita più Codex come opt-in, applicazione tutto-o-nulla, la danza d'intento read-before-write (sulle linee il cui `fs` è privo di write-intent le scritture degradano a scrittura diretta con un solo `console.warn`) e delete/move consapevole della sandbox.

## Perché proprio le patch? (guida al routing degli strumenti)

La descrizione dello strumento indirizza esplicitamente il modello:

- **Singola piccola modifica in un file già letto** → preferisci lo strumento nativo `edit` (una patch costa più token di una modifica letterale).
- **Piccola modifica all'interno di un file GRANDE** → `apply_patch` (non serve rinviare l'intero file).
- **Modifiche raggruppate su MOLTI file** → `apply_patch` (una sola chiamata, verificata atomicamente).
- **Nuovo file con contenuto sostanzioso / cancellazione / rinomina** → `apply_patch`.

## Installazione

```bash
dsh plugin --profile web add <path-to-dsh-patch-edit-plus>
dsh web --dump-config   # verify the plugin row appears
# restart DSH
```

## Utilizzo

### Diff unificato (predefinito, attivo)

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

### Sintassi apply_patch di Codex (opt-in)

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

Si abilita con `allowCodexPatch: true`. Quando arriva una patch Codex mentre l'opzione è disattivata, lo strumento restituisce un **suggerimento azionabile** (come abilitarla o come riprovare in diff unificato) invece di un generico errore di parsing — la sintassi Codex è un forte prior per i modelli della famiglia GPT, e un fallimento silenzioso li intrappola in cicli di tentativi.

### Operazioni

| Operazione | Diff unificato | Codex | Percorso di esecuzione |
|---|---|---|---|
| Aggiunta | `new file mode` + `/dev/null` | `*** Add File:` | `ctx.fs.writeText` (sequenza di intent ufficiale) |
| Aggiornamento (multi-hunk) | `@@` hunks | `@@` hunks | `ctx.fs.writeText` |
| Cancellazione | `deleted file mode` + `/dev/null` | `*** Delete File:` | `ctx.shell` (consapevole della sandbox, percorso passato via env) |
| Spostamento / rinomina | `rename from/to` | `*** Move to:` | `ctx.shell` |

## Garanzie

- **Tutto-o-nulla**: l'intera patch viene prima verificata rispetto al contenuto attuale dei file (localizzazione del contesto, contenimento del workspace, politica dei symlink, percorsi duplicati); qualsiasi fallimento interrompe l'operazione senza scrivere un solo byte.
- **Rispetto del cancello leggi-prima-di-scrivere**: ogni scrittura replica la sequenza di intent dello strumento `write` ufficiale — cascata `fs/write-intent` → `writeText` protetto → emissione `fs/observed`. Un `writeText` nudo bypasserebbe silenziosamente il cancello, perché i provider DSH non dispatchano mai da soli gli eventi `fs/*`.
- **Diagnostica dei guasti precisa**: in caso di hunk non corrispondente, l'errore riporta file + indice dell'hunk, riga di origine della ricerca, anteprima della riga attesa (con spazi resi visibili), l'estratto reale del file e un suggerimento mirato.
- **Fedeltà dei fine riga**: i file CRLF vengono riscritti come CRLF; le code senza newline finale sono preservate, a meno che la patch non modifichi la coda.
- **Pura aggiunta**: il plugin registra esattamente uno strumento, non chiama mai `tools.restrict()`, non sovrascrive mai uno strumento nativo, non registra servizi globali e rimuove tutto allo scaricamento. I conflitti di nome con altri provider di `apply_patch` (`bainianlaoyao/dsh-codex-mode`, `shuind/dsh-codex-harness`, …) sono risolti evitando la rinomina (`apply_patch_1`, `…_2`, …), così che DSH non fallisca mai l'avvio.

## Configurazione

| Opzione | Predefinito | Descrizione |
|---|---|---|
| `toolName` | `apply_patch` | Nome dello strumento esposto al modello. |
| `conflictPolicy` | `rename` | `rename` / `skip` / `fail` quando il nome dello strumento è già occupato. |
| `renameSuffix` | `_1` | Suffisso usato dall'evitamento della rinomina. |
| `allowUnifiedDiff` | `true` | Accetta i diff git/unificati. |
| `allowCodexPatch` | `false` | Accetta la sintassi `apply_patch` di Codex. Modificabile anche nel pannello delle impostazioni DSH; le modifiche hanno effetto immediato, senza riavvio. |
| `deleteBackend` | `shell` | `shell` oppure `none` (Delete/Move restituiscono un errore strutturato). |
| `shellDialect` | `auto` | `auto` (pwsh su win32) / `posix` / `pwsh`. |
| `deleteCommand` / `moveCommand` | built-in | Modelli di comando personalizzati. I percorsi arrivano comunque **solo tramite le variabili d'ambiente** (`DSH_PATCH_TARGET` / `DSH_PATCH_SOURCE`); non interpolarli mai nella stringa di comando. |
| `dryRunByDefault` | `false` | Tratta le chiamate come prove a vuoto (dry run) salvo `dryRun: false`. |
| `followSymlinks` | `false` | Consente ai percorsi delle patch di attraversare i symlink. |
| `maxFiles` | `50` | Numero massimo di sezioni file per patch. |
| `maxPatchBytes` | `524288` | Dimensione massima del testo della patch in byte. |
| `maxDiffBytes` | `16384` | Dimensione massima del diff per file conservato nei metadati del risultato (i diff più grandi vengono svuotati e marcati `truncated`). |

## Limitazioni (dichiarate)

- **Delete/Move passano attraverso `ctx.shell`.** La robustezza della sandbox è quella che l'esecutore shell caricato fa rispettare (`bash-sandbox` isola; `bash-local` no) — la stessa postura di rischio dello strumento bash nativo. Ogni richiesta porta una `sandboxPolicy` e riporta i fatti della sandbox, così che un «rifiuto della politica» sia distinguibile da un «fallimento del comando».
- **Ogni scrittura e ogni Delete/Move porta la politica nell'ambito della sessione.** `apply_patch` risolve `ctx.sandboxPolicy.resolve({ session })` a ogni chiamata — l'override di modalità della sessione più il suo cwd come radice del workspace — esattamente come gli strumenti nativi `write`/`edit`, e risolve i percorsi del piano rispetto alla stessa radice. Senza di essa, il filesystem di applicazione ricade sulla radice di deployment, il che fa fallire le scritture nel workspace come rifiuti `workspace-write`, persino in una sessione `danger-full-access`. Un rifiuto `workspace-write` emerge come `PatchError` il cui messaggio contiene il testo del backend (il marcatore strutturato `[sandbox: …]` e i campi di escalation nello stesso turno non sono implementati; usate gli strumenti nativi `write`/`edit` quando dovete escalare).
- **Add non crea le directory madri.** Questo rispecchia lo strumento nativo `write` (`ctx.fs` non ha mkdir); l'errore nomina la directory mancante.
- Nessuna corrispondenza fuzzy/per offset: la localizzazione degli hunk è esatta → `trimEnd` → `trim`, deliberatamente (il matching fuzzy non è sicuro per le operazioni distruttive; è nella roadmap).
- Le patch binarie vengono rifiutate con un errore chiaro.

## Sviluppo

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

La verifica manuale su un DSH in esecuzione (`dsh plugin --profile web add` → riavvio → chiamata dello strumento in una sessione) è lasciata deliberatamente all'operatore.

## Licenza

MIT
