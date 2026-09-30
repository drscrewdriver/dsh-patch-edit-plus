# Journal des modifications

## [0.3.0] — 2026-09-29

### Modifié

- **Prise en charge de la ligne DSH 0.2.0 (branche `compat/0.2.0`).** Les plages de pairs et `engines.dsh` (les deux manifestes) déclarent désormais `>=0.2.0-rc.1 <0.2.1-0` ; version 0.3.0. Les devDependencies épinglent la vraie baseline de types `0.2.0-rc.1`, et le script de contre-vérification devient `npm run typecheck:0.2.0` (installe les vrais paquets pairs depuis le registry). Les hôtes 0.1.x restent servis par la branche `compat/0.1.7` / le dist-tag `dsh-0.1.7`.
- **Delete/Move migrés vers l'API actuelle de l'exécuteur shell.** `ShellExecutor.run(spec)` a été renommé `execute(spec)` — renvoyant un handle `ShellProcess` avec une projection de premier plan `result()` — entre les lignes d'hôte 0.1.2 et 0.1.7. L'ancien pin de devDependency (`0.1.2-rc.1`) masquait cela : le paquet de la ligne 0.1.7 (0.2.1) passait la vérification de types sur une baseline périmée, et à l'exécution sur de vrais hôtes 0.1.7+ son duck-typing fondé sur `run` ne correspondait jamais, si bien que Delete/Move dégradaient en erreur structurée UNSUPPORTED. Cette ligne appelle `shell.execute(...)` et attend `execution.result()` ; l'exécuteur est détecté via `execute`.

## [0.1.2] — 2026-09-19

### Corrigé

- **La section de paramètres n'a jamais été enregistrée.** L'espace de noms des paramètres `patch_edit_plus` contient un underscore, que le motif d'espace de noms de `dsh-settings` (`^[a-z][a-z0-9-]*$`) rejette ; `register()` levait donc une exception avant toute persistance — aucune entrée de paramètres n'apparaissait dans le panneau ni dans `~/.dsh/settings.yaml`. Renommé en `patch-edit-plus` (aucune migration nécessaire : l'ancienne section n'a jamais pu exister).
- **Les changements de configuration venant de la couche de paramètres n'atteignaient jamais l'outil.** Les hooks `setSource`/`onChange` étaient des no-op et la config résolue était mémorisée une seule fois au chargement. Le plugin consomme désormais la source résolue : chaque changement de paramètres validé (ou watch `register` hérité) résout à nouveau la config et réenregistre l'outil — en disposant d'abord l'ancien enregistrement, car réenregistrer sur un nom déjà vivant le renomme silencieusement. `allowCodexPatch` et tous les autres champs peuvent maintenant être basculés depuis le panneau de paramètres DSH et prennent effet immédiatement, la description de l'outil (la liste des styles de patch acceptés) restant synchronisée ; aucun redémarrage du processus requis. Le détachement du service de paramètres retombe sur l'entrée de composition, et le rejugement est idempotent (c'est toute la config résolue qui est comparée, pas un seul champ).

## [0.1.1] — 2026-09-17

### Corrigé

- **Chaque écriture était refusée sous `workspace-write`.** L'outil ne transmettait pas de `sandboxPolicy` par appel ; le système de fichiers contraignant retombait donc sur `ctx.sandboxPolicy.resolve()` sans portée — la racine d'espace de travail de DÉPLOIEMENT (le répertoire de lancement du serveur) au lieu du cwd de la session. Un chemin pourtant situé dans l'espace de travail de la session échouait donc au test de confinement avec `file access denied under workspace-write mode`, même dans une session `danger-full-access`, où le mode n'était même pas lu. La politique est désormais résolue à chaque appel avec la session appelante en portée (`resolve({ session })`) et apposée sur chaque écriture et chaque requête shell Delete/Move, exactement comme le font les outils natifs `write`/`edit`. Les deux moitiés du mode sont honorées : la surcharge `sandbox/mode` de la session et son cwd comme racine d'espace de travail.
- La résolution des chemins et la clôture partagent désormais une même racine : le plan résout chaque cible par rapport au `workspaceRoot` de la politique (avec repli sur le cwd de la session), si bien que le chemin écrit par le moteur est celui que mesure la clôture.

## Unreleased

### Ajouté

- Unique outil `apply_patch` exposé au modèle, acceptant le diff git/unifié (par défaut) et la syntaxe `apply_patch` de Codex (opt-in via `allowCodexPatch`).
- Détection automatique du format, avec une aide actionnable quand arrive un style reconnu mais désactivé.
- Opérations Add / Update (multi-hunks) / Delete / Move ; Delete et Move passent par le `ctx.shell` conscient de la sandbox, les chemins n'étant transmis que via des variables d'environnement.
- Moteur en deux phases tout-ou-rien : vérification complète en lecture seule (localisation du contexte à trois niveaux de tolérance, confinement de l'espace de travail, rejet des symlinks, détection des chemins dupliqués) avant toute écriture.
- Séquence d'intent en écriture officielle à chaque écriture : cascade `fs/write-intent` → `writeText` gardé → émission `fs/observed`, afin que le verrou lecture-avant-écriture s'applique aux écritures de patch.
- Diagnostics de hunk non correspondant à quatre éléments (fichier + index du hunk, origine de recherche, aperçu attendu avec espaces visibles, extrait réel), plus une indication ciblée.
- Paramètre `dryRun` et config `dryRunByDefault`.
- Sortie groupée à la sémantique Codex (added → modified → deleted), avec diffs par fichier plafonnés par `maxDiffBytes` et `presentationMeta` sûr pour le replay.
- Protection à trois niveaux contre les conflits de noms d'outils (`rename` par défaut / `skip` / `fail`), afin que les collisions avec d'autres fournisseurs d'`apply_patch` ne cassent jamais le démarrage de DSH.
- Compatibilité DSH `0.1.2-rc.1` ~ `0.1.5-rc.2` : chemin de code unique d'écriture d'outils, plus vérification statique `typecheck:0.1.5` contre les paquets pairs 0.1.5-rc.2 ; repli bi-API des paramètres (`installSection` / `register`).
