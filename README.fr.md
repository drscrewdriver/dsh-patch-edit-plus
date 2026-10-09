# dsh-patch-edit-plus

Français | [English](./README.md) | [简体中文](./README.zh.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md) | [Deutsch](./README.de.md) | [Italiano](./README.it.md) | [Русский](./README.ru.md) | [Español](./README.es.md)

Édition de fichiers en mode patch pour [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness) : un outil unique `apply_patch` exposé au modèle, qui accepte les **diffs git/unifiés** (par défaut) et la **syntaxe `apply_patch` de Codex** (opt-in), applique chaque changement selon le principe du **tout-ou-rien** et reste totalement hors du chemin de DSH.

## Compatibilité des versions de DSH

**La v0.4.0 est une version unique couvrant toute la ligne d'hôtes** : une seule version sert tous les DSH de `0.1.0-rc.8` à `0.2.0-rc.2` (les 15 rc plus desktop). Les quatre anciennes lignes (`compat/0.1.2`, `compat/0.1.5`, `compat/0.1.7` et le schéma de scission `main`) sont retirées ; après publication, les dist-tags npm `latest`, `dsh-0.2.0`, `dsh-0.1.7`, `dsh-0.1.5` et `dsh-0.1.2` pointeront tous vers 0.4.0.

| Version de DSH | Statut | Notes |
|---|---|---|
| `0.2.0-rc.1+` | ✅ pris en charge (même v0.4.0) | Paramètres déclaratifs : les champs marqués `.volatile()` constituent le formulaire de paramètres, et `loader/volatile-update` réenregistre l'outil sans remontage (remount). La carte de configuration de la page du plugin (moitié client) a sa place sur cette ligne. |
| `0.1.0-rc.8` ~ `0.1.7-rc.2` | ✅ pris en charge (même v0.4.0) | Paramètres par génération : `settings.installSection`/`register` d'instance (0.1.2/0.1.5) ou `installSettingsSection` au niveau module de `@deepseek-ai/dsh-settings` (0.1.0/0.1.1). La carte de configuration de la page du plugin est absente avec élégance ici. |

**Changement de comportement :** `allowCodexPatch` est désormais `false` par défaut (opt-in, aligné sur la ligne 0.2.0). Si vous mettez à niveau depuis l'ancienne ligne 0.1.7 (où la valeur par défaut était `true`), activez l'interrupteur manuellement après la mise à niveau.

Les paramètres couvrent trois générations d'hôtes, toutes servies par cette version unique : sur 0.1.7+ (et desktop), la configuration est déclarative — les champs marqués `.volatile()` dans `Config` sont le formulaire de paramètres et le plugin s'abonne à `loader/volatile-update` ; sur 0.1.2/0.1.5, il utilise les API d'instance `settings.installSection`/`register` ; sur 0.1.0/0.1.1, le `installSettingsSection` au niveau module de `@deepseek-ai/dsh-settings`. La carte de configuration de la page du plugin (moitié client) n'a sa place que sur 0.1.7+/desktop et est absente avec élégance sur les anciennes lignes.

Les capacités de l'outil sont identiques sur chaque ligne : un seul outil `apply_patch`, diff git/unifié par défaut plus Codex en opt-in, application tout-ou-rien, la danse d'intention lecture-avant-écriture (sur les lignes dont le `fs` n'a pas write-intent, les écritures dégradent en écriture directe avec un seul `console.warn`), et delete/move conscient du bac à sable.

## Pourquoi faire des patchs ? (guide de routage des outils)

La description de l'outil oriente explicitement le modèle :

- **Petite modification unique dans un fichier déjà lu** → privilégiez l'outil natif `edit` (un patch coûte plus de tokens qu'une édition littérale).
- **Petite modification au sein d'un fichier VOLUMINEUX** → `apply_patch` (inutile de renvoyer l'intégralité du fichier).
- **Modifications groupées sur DE NOMBREUX fichiers** → `apply_patch` (un seul appel, vérifié atomiquement).
- **Nouveau fichier au contenu substantiel / suppression / renommage** → `apply_patch`.

## Installation

```bash
dsh plugin --profile web add <path-to-dsh-patch-edit-plus>
dsh web --dump-config   # verify the plugin row appears
# restart DSH
```

## Utilisation

### Diff unifié (par défaut, activé)

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

### Syntaxe apply_patch de Codex (opt-in)

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

Activez avec `allowCodexPatch: true`. Quand un patch Codex arrive alors que l'option est désactivée, l'outil renvoie une **aide actionnable** (comment l'activer ou comment réessayer en diff unifié) au lieu d'une erreur d'analyse générique — la syntaxe Codex est un prior fort pour les modèles de la famille GPT, et un échec silencieux les enferme dans des boucles de réessai.

### Opérations

| Opération | Diff unifié | Codex | Chemin d'exécution |
|---|---|---|---|
| Ajout | `new file mode` + `/dev/null` | `*** Add File:` | `ctx.fs.writeText` (séquence d'intent officielle) |
| Mise à jour (multi-hunks) | `@@` hunks | `@@` hunks | `ctx.fs.writeText` |
| Suppression | `deleted file mode` + `/dev/null` | `*** Delete File:` | `ctx.shell` (conscient de la sandbox, chemin passé par env) |
| Déplacement / renommage | `rename from/to` | `*** Move to:` | `ctx.shell` |

## Garanties

- **Tout-ou-rien** : l'ensemble du patch est d'abord vérifié par rapport au contenu actuel des fichiers (localisation du contexte, confinement de l'espace de travail, politique des symlinks, chemins dupliqués) ; tout échec avorte sans écrire le moindre octet.
- **Respect du verrou lecture-avant-écriture** : chaque écriture reproduit la séquence d'intent de l'outil `write` officiel — cascade `fs/write-intent` → `writeText` gardé → émission `fs/observed`. Un `writeText` brut contournerait silencieusement ce verrou, car les providers DSH n'émettent jamais eux-mêmes les événements `fs/*`.
- **Diagnostics d'échec précis** : en cas de hunk non correspondant, l'erreur embarque fichier + index du hunk, ligne d'origine de la recherche, aperçu de la ligne attendue (espaces rendus visibles), extrait réel du fichier, ainsi qu'une indication ciblée.
- **Fidélité des fins de ligne** : les fichiers CRLF sont réécrits en CRLF ; les fins sans nouvelle ligne finale sont préservées, sauf si le patch modifie la fin.
- **Pure addition** : le plugin enregistre exactement un outil, n'appelle jamais `tools.restrict()`, ne surcharge jamais un outil natif, n'enregistre aucun service global et supprime tout au déchargement. Les conflits de noms avec d'autres fournisseurs d'`apply_patch` (`bainianlaoyao/dsh-codex-mode`, `shuind/dsh-codex-harness`, …) sont résolus par évitement de renommage (`apply_patch_1`, `…_2`, …), afin que DSH ne tombe jamais en échec au démarrage.

## Configuration

| Option | Par défaut | Description |
|---|---|---|
| `toolName` | `apply_patch` | Nom de l'outil exposé au modèle. |
| `conflictPolicy` | `rename` | `rename` / `skip` / `fail` quand le nom de l'outil est déjà pris. |
| `renameSuffix` | `_1` | Suffixe utilisé par l'évitement de renommage. |
| `allowUnifiedDiff` | `true` | Accepte les diffs git/unifiés. |
| `allowCodexPatch` | `false` | Accepte la syntaxe `apply_patch` de Codex. Également modifiable dans le panneau de paramètres DSH ; les changements prennent effet immédiatement, sans redémarrage. |
| `deleteBackend` | `shell` | `shell` ou `none` (Delete/Move renvoient une erreur structurée). |
| `shellDialect` | `auto` | `auto` (pwsh sous win32) / `posix` / `pwsh`. |
| `deleteCommand` / `moveCommand` | built-in | Modèles de commandes personnalisés. Les chemins n'arrivent toujours **que via les variables d'environnement** (`DSH_PATCH_TARGET` / `DSH_PATCH_SOURCE`) ; ne les interpolez jamais dans la chaîne de commande. |
| `dryRunByDefault` | `false` | Traiter les appels comme des essais à vide (dry run) sauf si `dryRun: false`. |
| `followSymlinks` | `false` | Autoriser les chemins de patch à traverser les symlinks. |
| `maxFiles` | `50` | Nombre maximal de sections de fichiers par patch. |
| `maxPatchBytes` | `524288` | Taille maximale du texte de patch, en octets. |
| `maxDiffBytes` | `16384` | Taille maximale du diff par fichier conservé dans les métadonnées du résultat (les diffs plus grands sont vidés et marqués `truncated`). |

## Limitations (divulguées)

- **Delete/Move passent par `ctx.shell`.** La force de la sandbox est celle que l'exécuteur shell chargé fait respecter (`bash-sandbox` cloisonne ; `bash-local` non) — la même posture de risque que l'outil bash natif. Chaque requête porte un `sandboxPolicy` et rapporte les faits relatifs à la sandbox, de sorte qu'un « refus de politique » soit distinguable d'un « échec de commande ».
- **Chaque écriture et chaque Delete/Move porte la politique à la portée de la session.** `apply_patch` résout `ctx.sandboxPolicy.resolve({ session })` à chaque appel — la surcharge de mode de la session plus son cwd comme racine de l'espace de travail — exactement comme les outils natifs `write`/`edit`, et résout les chemins du plan par rapport à cette même racine. Sans cela, le système de fichiers contraignant retombe sur la racine de déploiement, ce qui fait échouer les écritures intra-espace de travail comme refus `workspace-write`, même dans une session `danger-full-access`. Un refus `workspace-write` se manifeste par une `PatchError` dont le message contient le texte du backend (le marqueur structuré `[sandbox: …]` et les champs d'escalade du même tour ne sont pas implémentés ; utilisez les outils natifs `write`/`edit` si vous devez escalader).
- **Add ne crée pas les répertoires parents.** Cela correspond à l'outil natif `write` (`ctx.fs` n'a pas de mkdir) ; l'erreur nomme le répertoire manquant.
- Pas de correspondance floue/avec décalage : la localisation des hunks est exacte → `trimEnd` → `trim`, volontairement (la correspondance floue n'est pas sûre pour les opérations destructrices ; elle figure sur la feuille de route).
- Les patchs binaires sont rejetés avec une erreur claire.

## Développement

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

La vérification manuelle sur un DSH en fonctionnement (`dsh plugin --profile web add` → redémarrage → appel de l'outil dans une session) est volontairement laissée à l'opérateur.

## Licence

MIT
