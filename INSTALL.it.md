# Guida all'installazione (CLI DSH ufficiale)

Questa guida utilizza solo il comando DSH ufficiale `dsh plugin`. Quel comando installa la dipendenza in un profilo e sincronizza `dsh.profile.bundles`. Non sostituitelo con un semplice `npm install`, un `pnpm add` diretto nel profilo o modifiche manuali al manifest del profilo.

- [Guida all'installazione in inglese](./INSTALL.md)
- [Guida all'installazione in cinese](./INSTALL.zh.md)
- [Guida all'installazione in giapponese](./INSTALL.ja.md)
- [Guida all'installazione in coreano](./INSTALL.ko.md)
- [Guida all'installazione in italiano](./INSTALL.it.md)
- [Guida all'installazione in francese](./INSTALL.fr.md)
- [Guida all'installazione in tedesco](./INSTALL.de.md)
- [Guida all'installazione in russo](./INSTALL.ru.md)
- [Guida all'installazione in spagnolo](./INSTALL.es.md)
- [README in inglese](./README.md)
- [README in cinese](./README.zh.md)
- [README in giapponese](./README.ja.md)
- [README in coreano](./README.ko.md)
- [README in italiano](./README.it.md)
- [README in francese](./README.fr.md)
- [README in tedesco](./README.de.md)
- [README in russo](./README.ru.md)
- [README in spagnolo](./README.es.md)
- [Registro delle modifiche](./CHANGELOG.md)
- [Registro delle modifiche in giapponese](./CHANGELOG.ja.md)
- [Registro delle modifiche in coreano](./CHANGELOG.ko.md)
- [Registro delle modifiche in italiano](./CHANGELOG.it.md)
- [Registro delle modifiche in francese](./CHANGELOG.fr.md)
- [Registro delle modifiche in tedesco](./CHANGELOG.de.md)
- [Registro delle modifiche in russo](./CHANGELOG.ru.md)
- [Registro delle modifiche in spagnolo](./CHANGELOG.es.md)

I segnaposto di questa guida sono:

- `<profile>`: il profilo DSH da modificare, di solito `web`;
- `dsh-patch-edit-plus`: il pacchetto npm, l'ID del plugin a runtime e l'id dell'unica riga inserita dalla patch del bundle.

> **Intervallo DSH supportato: da `0.1.0-rc.8` a `0.2.0-rc.2` (desktop incluso) — una singola versione, la v0.4.0.**
>
> Verificate prima la versione in esecuzione con `dsh --version`.
>
> | Versione DSH | Stato | Note |
> | --- | --- | --- |
> | `0.2.0-rc.1` ~ `0.2.0-rc.2` (desktop incluso) | supportato | Stessa v0.4.0. |
> | `0.1.0-rc.8` ~ `0.1.7-rc.2` | supportato | Stessa v0.4.0 — nessuna scelta di ramo o dist-tag necessaria. |
>
> Su qualsiasi linea di host supportata installate `latest`: una singola versione serve sia i 0.1.x sia i 0.2.x. Dopo la pubblicazione, i dist-tag `latest`, `dsh-0.2.0`, `dsh-0.1.7`, `dsh-0.1.5` e `dsh-0.1.2` punteranno tutti a 0.4.0.

## 0. Prerequisiti e individuazione del profilo

```bash
echo "DSH_HOME=${DSH_HOME:-$HOME/.dsh}"
dsh --version
ls "${DSH_HOME:-$HOME/.dsh}/profiles"
```

Usate il profilo indicato dal vostro processo DSH in esecuzione. `web` è comune, ma è l'argomento `--profile` attivo a fare autorità.

## 1. Installazione ufficiale

```bash
dsh plugin --profile <profile> add dsh-patch-edit-plus -w
```

(il flag `-w` è richiesto quando il profilo è la radice di un workspace pnpm, come nel caso di `web`.)

Installare esplicitamente una versione specifica:

```bash
dsh plugin --profile <profile> add dsh-patch-edit-plus@0.4.0 -w
```

La CLI ufficiale aggiorna automaticamente la dipendenza del profilo, il lockfile e `dsh.profile.bundles`. Non aggiungete una riga YAML manuale.

### Periodo di raffreddamento della supply chain

Il runtime DSH usa pnpm 11, la cui politica `minimumReleaseAge` può bloccare una versione appena pubblicata con `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`. Aggiungete la versione a `minimumReleaseAgeExclude` in `~/.dsh/profiles/<profile>/pnpm-workspace.yaml`:

```yaml
minimumReleaseAgeExclude:
  - dsh-patch-edit-plus@0.4.0
```

## 2. Riavviare l'host

Questo è un plugin **solo host**: registra uno strumento e una sezione di impostazioni sull'host e non include alcuna parte per il browser. Riavviate il processo host DSH dopo l'installazione o l'aggiornamento; ricaricare la pagina non è né necessario né sufficiente.

## 3. Aggiornamento

```bash
dsh plugin --profile <profile> update dsh-patch-edit-plus -w
```

Riavviate DSH in seguito.

## 4. Registrazione tramite percorso locale / `link:` (alternativa)

```bash
#    ~/.dsh/profiles/<profile>/package.json dependencies:
#      "dsh-patch-edit-plus": "link:<absolute path to dsh-patch-edit-plus>"
#    ~/.dsh/profiles/<profile>/cordis.patch.yml:
#      - insert:
#          - id: dsh-patch-edit-plus
#            name: dsh-patch-edit-plus
cd ~/.dsh/profiles/<profile> && pnpm install && dsh web
```

Oppure usate la CLI ufficiale con un percorso locale (nessuna rete necessaria):

```bash
dsh plugin --profile <profile> add /absolute/path/to/dsh-patch-edit-plus -w
```

La compilazione da un checkout dei sorgenti usa questi script:

```bash
npm install
npm run build          # tsc -p tsconfig.build.json → lib/ + lib/types/
npm run typecheck      # tsc -p tsconfig.json
npm run verify:source  # source-level assertions
npm run test           # vitest run
npm run smoke          # _smoke/load-smoke.mjs
```

`lib/` non è versionato, quindi un checkout dei sorgenti deve essere compilato prima di poter essere registrato tramite percorso. La pubblicazione lo compila automaticamente tramite l'hook `prepublishOnly`, così il tarball pubblicato contiene sempre l'output compilato.

## 5. Verificare l'installazione

```bash
grep -n "dsh-patch-edit-plus" \
  "${DSH_HOME:-$HOME/.dsh}/profiles/<profile>/package.json"
node -p "require('${DSH_HOME:-$HOME/.dsh}/profiles/<profile>/node_modules/dsh-patch-edit-plus/package.json').version"
```

Controllate la composizione ufficiale:

```bash
dsh --profile <profile> --dump-default-config
```

Deve contenere:

```yaml
- id: dsh-patch-edit-plus
  name: dsh-patch-edit-plus
```

## 6. Verificare il plugin

Dopo il riavvio, confermate in una sessione:

1. Lo strumento `apply_patch` è disponibile per il modello.
2. Una patch in diff unificato viene applicata e il contenuto del file corrisponde esattamente al diff.
3. Una patch che non supera la verifica lascia il workspace intatto — il motore verifica tutto in sola lettura prima di scrivere qualsiasi cosa.
4. Una patch in stile Codex, con `allowCodexPatch` disattivato, restituisce un suggerimento azionabile che dice al modello come abilitare lo stile o riprovare in diff unificato, invece di un generico errore di parsing.

Se un altro plugin fornisce già uno strumento chiamato `apply_patch`, la politica di conflitto a tre livelli (`rename` per impostazione predefinita, oppure `skip` / `fail`) decide l'esito. Con il `rename` predefinito, l'avvio di DSH non è influenzato e lo strumento viene registrato con un nome con suffisso.

## 7. Risoluzione dei problemi

| Sintomo | Azione |
| --- | --- |
| `dsh` non trovato | Installare o abilitare la CLI DSH ufficiale. |
| `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` | Aggiungere la versione a `minimumReleaseAgeExclude` nel `pnpm-workspace.yaml` del profilo. |
| `apply_patch` non compare | Riavviare il processo host e ricontrollare la riga della composizione. |
| Conflitto di nome con un altro provider di `apply_patch` | Impostare la politica di conflitto su `rename` (predefinito), `skip` o `fail`, come da README. |
| Sintassi Codex rifiutata | Abilitare `allowCodexPatch: true` o rinviare la modifica come diff unificato. |
| Hunk non corrispondente | Leggere la diagnostica a quattro elementi (file + indice dell'hunk, origine della ricerca, anteprima attesa, estratto reale) e rinviare l'hunk con un contesto corrispondente. |

## 8. Rimozione

```bash
dsh plugin --profile <profile> remove dsh-patch-edit-plus
```

Riavviate DSH in seguito.

## Licenza

MIT
