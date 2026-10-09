# Registro delle modifiche

## [0.4.0] — 2026-10-09

### Aggiunto

- **Una singola versione per tutte le linee di host.** Una sola versione (0.4.0) serve tutti gli host DSH da `0.1.0-rc.8` a `0.2.0-rc.2` — tutti i 15 rc più desktop; gli intervalli dei peer enumerano tutti i 15 rc e `engines.dsh` dichiara `>=0.1.0-rc.8`. I rami compat ritirati (`compat/0.1.2`, `compat/0.1.5`, `compat/0.1.7`) e lo schema di biforcazione `main` sono rimossi; dopo la pubblicazione, i dist-tag npm `latest`, `dsh-0.2.0`, `dsh-0.1.7`, `dsh-0.1.5` e `dsh-0.1.2` convergono tutti su 0.4.0.
- **Tre generazioni di impostazioni in un'unica codebase**: `.volatile()` dichiarativo più ri-registrazione via `loader/volatile-update` su 0.1.7+ (e desktop); `settings.installSection`/`register` di istanza su 0.1.2/0.1.5; `installSettingsSection` a livello di modulo da `@deepseek-ai/dsh-settings` su 0.1.0/0.1.1. La scheda di configurazione nella pagina del plugin (metà client) ha un posto solo su 0.1.7+/desktop ed è assente con eleganza sulle linee precedenti.
- Percorso di authoring `defineTool` con degradazione morbida del fs: sulle linee il cui `fs` è privo di write-intent, le scritture degradano a scrittura diretta con un solo `console.warn` invece di fallire.
- Matrice di typecheck su sei linee, più un gate di smoke che copre gli scenari di assenza elegante.

### Modificato

- **Rottura: `allowCodexPatch` ora è `false` per impostazione predefinita** (opt-in, allineato alla linea 0.2.0; il vecchio predefinito della linea 0.1.7 era `true`). Gli utenti esistenti della linea 0.1.7 devono attivarlo manualmente dopo l'aggiornamento a 0.4.0.

## [0.3.0] — 2026-09-29

### Modificato

- **Supporto della linea DSH 0.2.0 (ramo `compat/0.2.0`).** Gli intervalli dei peer e `engines.dsh` (entrambi i manifest) ora dichiarano `>=0.2.0-rc.1 <0.2.1-0`; versione 0.3.0. Le devDependencies fissano la vera baseline di tipi `0.2.0-rc.1`, e lo script di controverifica diventa `npm run typecheck:0.2.0` (installa i veri pacchetti peer dal registry). Gli host 0.1.x restano serviti dal ramo `compat/0.1.7` / dal dist-tag `dsh-0.1.7`.
- **Delete/Move migrati all'API attuale dell'esecutore shell.** Tra le linee host 0.1.2 e 0.1.7 `ShellExecutor.run(spec)` è stato rinominato `execute(spec)` — con restituzione di un handle `ShellProcess` e una proiezione in primo piano `result()`. Il vecchio pin della devDependency (`0.1.2-rc.1`) mascherava la cosa: il pacchetto della linea 0.1.7 (0.2.1) superava il typecheck contro una baseline superata, e a runtime sui veri host 0.1.7+ il suo duck-typing basato su `run` non corrispondeva mai, così Delete/Move degradavano all'errore strutturato UNSUPPORTED. Questa linea chiama `shell.execute(...)` e attende `execution.result()`; l'esecutore viene rilevato tramite `execute`.

## [0.1.2] — 2026-09-19

### Corretto

- **La sezione delle impostazioni non è mai stata registrata.** Il namespace delle impostazioni `patch_edit_plus` contiene un underscore, che il pattern dei namespace di `dsh-settings` (`^[a-z][a-z0-9-]*$`) rifiuta; quindi `register()` lanciava un'eccezione prima che qualsiasi cosa venisse persistita — nessuna voce delle impostazioni compariva nel pannello né in `~/.dsh/settings.yaml`. Rinominato in `patch-edit-plus` (nessuna migrazione necessaria: la vecchia sezione non poté mai esistere).
- **Le modifiche di configurazione provenienti dal livello delle impostazioni non raggiungevano mai lo strumento.** Gli hook `setSource`/`onChange` erano no-op e la configurazione risolta veniva memoizzata una sola volta al caricamento. Il plugin ora consuma la sorgente risolta: ogni modifica alle impostazioni confermata (o il watch `register` legacy) risolve nuovamente la configurazione e registra di nuovo lo strumento — eliminando prima la registrazione precedente, poiché registrarsi di nuovo su un nome già attivo lo rinomina silenziosamente. `allowCodexPatch` e ogni altro campo ora possono essere commutati dal pannello delle impostazioni DSH e hanno effetto immediato, con la descrizione dello strumento (l'elenco degli stili di patch accettati) che resta sincronizzata; nessun riavvio del processo richiesto. Lo scollegamento del servizio delle impostazioni ricade sulla voce di composizione, e il nuovo giudizio è idempotente (viene confrontata l'intera configurazione risolta, non un solo campo).

## [0.1.1] — 2026-09-17

### Corretto

- **Ogni scrittura veniva negata sotto `workspace-write`.** Lo strumento non passava alcuna `sandboxPolicy` per chiamata, quindi il filesystem di applicazione ricadeva su `ctx.sandboxPolicy.resolve()` senza ambito — la radice del workspace di DEPLOYMENT (la directory di avvio del server) invece del cwd della sessione. Un percorso chiaramente interno al workspace della sessione falliva quindi il test di contenimento con `file access denied under workspace-write mode`, persino in una sessione `danger-full-access`, dove la modalità non veniva nemmeno letta. La politica ora viene risolta a ogni chiamata con la sessione chiamante nell'ambito (`resolve({ session })`) e applicata a ogni scrittura e a ogni richiesta shell Delete/Move, esattamente come fanno gli strumenti nativi `write`/`edit`. Ora sono onorate entrambe le metà della modalità: l'override `sandbox/mode` della sessione e il suo cwd come radice del workspace.
- La risoluzione dei percorsi e la recinzione ora condividono una sola radice: il piano risolve ogni bersaglio rispetto al `workspaceRoot` della politica (ricadendo sul cwd della sessione), così il percorso che il motore scrive è il percorso che la recinzione misura.

## Unreleased

### Aggiunto

- Unico strumento `apply_patch` esposto al modello, che accetta diff git/unificati (predefinito) e la sintassi `apply_patch` di Codex (opt-in tramite `allowCodexPatch`).
- Rilevamento automatico del formato con un suggerimento azionabile quando arriva uno stile riconosciuto ma disabilitato.
- Operazioni Add / Update (multi-hunk) / Delete / Move; Delete e Move passano attraverso `ctx.shell`, consapevole della sandbox, con i percorsi passati solo tramite variabili d'ambiente.
- Motore a due fasi tutto-o-nulla: verifica completa in sola lettura (localizzazione del contesto con tre livelli di tolleranza, contenimento del workspace, rifiuto dei symlink, rilevamento dei percorsi duplicati) prima di qualsiasi scrittura.
- Sequenza ufficiale di write-intent su ogni scrittura: cascata `fs/write-intent` → `writeText` protetto → emissione `fs/observed`, così che il cancello leggi-prima-di-scrivere si applichi alle scritture delle patch.
- Diagnostica a quattro elementi per gli hunk non corrispondenti (file + indice dell'hunk, origine della ricerca, anteprima attesa con spazi visibili, estratto reale) più un suggerimento mirato.
- Parametro `dryRun` e configurazione `dryRunByDefault`.
- Uscita raggruppata con semantica Codex (added → modified → deleted), con diff per file limitati da `maxDiffBytes` e `presentationMeta` replay-safe.
- Protezione a tre livelli dai conflitti di nomi degli strumenti (`rename` predefinito / `skip` / `fail`), così che le collisioni con altri provider di `apply_patch` non rompano mai l'avvio di DSH.
- Compatibilità DSH `0.1.2-rc.1` ~ `0.1.5-rc.2`: singolo percorso di codice per la creazione degli strumenti più verifica statica `typecheck:0.1.5` contro i pacchetti peer 0.1.5-rc.2; fallback dual-API delle impostazioni (`installSection` / `register`).
