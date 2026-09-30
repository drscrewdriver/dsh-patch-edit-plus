# Guide d'installation (CLI DSH officiel)

Ce guide n'utilise que la commande officielle DSH `dsh plugin`. Cette commande installe la dépendance dans un profil et synchronise `dsh.profile.bundles`. Ne la remplacez pas par un simple `npm install`, un `pnpm add` direct dans le profil, ou des modifications manuelles du manifeste du profil.

- [Guide d'installation en anglais](./INSTALL.md)
- [Guide d'installation en chinois](./INSTALL.zh.md)
- [Guide d'installation en japonais](./INSTALL.ja.md)
- [Guide d'installation en coréen](./INSTALL.ko.md)
- [Guide d'installation en français](./INSTALL.fr.md)
- [Guide d'installation en allemand](./INSTALL.de.md)
- [Guide d'installation en italien](./INSTALL.it.md)
- [Guide d'installation en russe](./INSTALL.ru.md)
- [Guide d'installation en espagnol](./INSTALL.es.md)
- [README en anglais](./README.md)
- [README en chinois](./README.zh.md)
- [README en japonais](./README.ja.md)
- [README en coréen](./README.ko.md)
- [README en français](./README.fr.md)
- [README en allemand](./README.de.md)
- [README en italien](./README.it.md)
- [README en russe](./README.ru.md)
- [README en espagnol](./README.es.md)
- [Changelog](./CHANGELOG.md)
- [Changelog en japonais](./CHANGELOG.ja.md)
- [Changelog en coréen](./CHANGELOG.ko.md)
- [Changelog en français](./CHANGELOG.fr.md)
- [Changelog en allemand](./CHANGELOG.de.md)
- [Changelog en italien](./CHANGELOG.it.md)
- [Changelog en russe](./CHANGELOG.ru.md)
- [Changelog en espagnol](./CHANGELOG.es.md)

Les espaces réservés de ce guide sont :

- `<profile>` : le profil DSH à modifier, généralement `web` ;
- `dsh-patch-edit-plus` : le paquet npm, l'identifiant du plugin à l'exécution, et l'id de l'unique ligne insérée par le patch de bundle.

> **Plage de DSH prise en charge : `>=0.2.0-rc.1 <0.2.1-0`.**
>
> Vérifiez d'abord la version en cours avec `dsh --version`.
>
> | Version de DSH | Statut | Notes |
> | --- | --- | --- |
> | `0.2.0-rc.1` | pris en charge | Ligne cible de cette branche. Vérification de types effectuée contre les vrais paquets pairs `0.2.0-rc.1` (`npm run typecheck:0.2.0`) ; Delete/Move utilisent l'API de premier plan `ShellExecutor.execute()` + `result()`. |
> | `0.1.7-rc.1+` | servi ailleurs | Maintenu par la branche `compat/0.1.7` / le dist-tag `dsh-0.1.7` (version du paquet : 0.2.1 là-bas). |
> | `0.1.2-rc.1` ~ `0.1.5-rc.2` | servi ailleurs | Maintenu par la branche antérieure à 0.1.7 / le dist-tag `dsh-0.1.5`. |

## 0. Prérequis et découverte du profil

```bash
echo "DSH_HOME=${DSH_HOME:-$HOME/.dsh}"
dsh --version
ls "${DSH_HOME:-$HOME/.dsh}/profiles"
```

Utilisez le profil nommé par votre processus DSH en cours d'exécution. `web` est courant, mais c'est l'argument `--profile` actif qui fait foi.

## 1. Installation officielle

```bash
dsh plugin --profile <profile> add dsh-patch-edit-plus -w
```

(le drapeau `-w` est requis quand le profil est une racine d'espace de travail pnpm, comme c'est le cas de `web`.)

Pour installer explicitement une version précise :

```bash
dsh plugin --profile <profile> add dsh-patch-edit-plus@0.1.1 -w
```

La CLI officielle met à jour automatiquement la dépendance du profil, le lockfile et `dsh.profile.bundles`. N'ajoutez pas de ligne YAML manuelle.

### Période de refroidissement de la chaîne d'approvisionnement

Le runtime DSH utilise pnpm 11, dont la politique `minimumReleaseAge` peut bloquer une version tout juste publiée avec `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`. Ajoutez la version à `minimumReleaseAgeExclude` dans `~/.dsh/profiles/<profile>/pnpm-workspace.yaml` :

```yaml
minimumReleaseAgeExclude:
  - dsh-patch-edit-plus@0.1.1
```

## 2. Redémarrer l'hôte

C'est un plugin **réservé à l'hôte** : il enregistre un outil et une section de paramètres sur l'hôte, et n'embarque aucune partie navigateur. Redémarrez le processus hôte DSH après chaque installation ou mise à niveau ; rafraîchir la page n'est ni nécessaire ni suffisant.

## 3. Mise à niveau

```bash
dsh plugin --profile <profile> update dsh-patch-edit-plus -w
```

Redémarrez DSH ensuite.

## 4. Enregistrement par chemin local / `link:` (alternative)

```bash
#    ~/.dsh/profiles/<profile>/package.json dependencies:
#      "dsh-patch-edit-plus": "link:<absolute path to dsh-patch-edit-plus>"
#    ~/.dsh/profiles/<profile>/cordis.patch.yml:
#      - insert:
#          - id: dsh-patch-edit-plus
#            name: dsh-patch-edit-plus
cd ~/.dsh/profiles/<profile> && pnpm install && dsh web
```

Ou utilisez la CLI officielle avec un chemin local (aucun réseau requis) :

```bash
dsh plugin --profile <profile> add /absolute/path/to/dsh-patch-edit-plus -w
```

La construction depuis un checkout des sources utilise ces scripts :

```bash
npm install
npm run build          # tsc -p tsconfig.build.json → lib/ + lib/types/
npm run typecheck      # tsc -p tsconfig.json
npm run verify:source  # source-level assertions
npm run test           # vitest run
npm run smoke          # _smoke/load-smoke.mjs
```

`lib/` n'est pas versionné ; un checkout des sources doit donc être construit avant de pouvoir être enregistré par chemin. La publication le construit automatiquement via le hook `prepublishOnly`, si bien que le tarball publié contient toujours la sortie compilée.

## 5. Vérifier l'installation

```bash
grep -n "dsh-patch-edit-plus" \
  "${DSH_HOME:-$HOME/.dsh}/profiles/<profile>/package.json"
node -p "require('${DSH_HOME:-$HOME/.dsh}/profiles/<profile>/node_modules/dsh-patch-edit-plus/package.json').version"
```

Vérifiez la composition officielle :

```bash
dsh --profile <profile> --dump-default-config
```

Elle doit contenir :

```yaml
- id: dsh-patch-edit-plus
  name: dsh-patch-edit-plus
```

## 6. Vérifier le plugin

Après le redémarrage, confirmez dans une session :

1. L'outil `apply_patch` est disponible pour le modèle.
2. Un patch en diff unifié s'applique, et le contenu du fichier correspond exactement au diff.
3. Un patch qui échoue à la vérification laisse l'espace de travail intact — le moteur vérifie tout en lecture seule avant d'écrire quoi que ce soit.
4. Un patch de style Codex reçu alors que `allowCodexPatch` est désactivé renvoie une aide actionnable indiquant au modèle comment activer ce style ou réessayer en diff unifié, plutôt qu'une erreur d'analyse générique.

Si un autre plugin fournit déjà un outil nommé `apply_patch`, la politique de conflit à trois niveaux (`rename` par défaut, ou `skip` / `fail`) décide de l'issue. Avec le `rename` par défaut, le démarrage de DSH n'est pas affecté et l'outil est enregistré sous un nom suffixé.

## 7. Dépannage

| Symptôme | Action |
| --- | --- |
| `dsh` est introuvable | Installez ou activez la CLI DSH officielle. |
| `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` | Ajoutez la version à `minimumReleaseAgeExclude` dans le `pnpm-workspace.yaml` du profil. |
| `apply_patch` n'apparaît pas | Redémarrez le processus hôte et revérifiez la ligne de composition. |
| Conflit de nom d'outil avec un autre fournisseur d'`apply_patch` | Réglez la politique de conflit sur `rename` (défaut), `skip` ou `fail` selon le README. |
| Syntaxe Codex rejetée | Activez `allowCodexPatch: true`, ou renvoyez la modification sous forme de diff unifié. |
| Hunk non correspondant | Lisez le diagnostic à quatre éléments (fichier + index du hunk, origine de recherche, aperçu attendu, extrait réel) et réémettez le hunk avec un contexte correspondant. |

## 8. Suppression

```bash
dsh plugin --profile <profile> remove dsh-patch-edit-plus
```

Redémarrez DSH ensuite.

## Licence

MIT
