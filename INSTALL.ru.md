# Руководство по установке (официальный DSH CLI)

В этом руководстве используется только официальная команда DSH `dsh plugin`. Она устанавливает зависимость в профиль и синхронизирует `dsh.profile.bundles`. Не заменяйте её простым `npm install`, прямым `pnpm add` в профиле или ручными правками манифеста профиля.

- [Руководство по установке на английском](./INSTALL.md)
- [Руководство по установке на китайском](./INSTALL.zh.md)
- [Руководство по установке на японском](./INSTALL.ja.md)
- [Руководство по установке на корейском](./INSTALL.ko.md)
- [Руководство по установке на русском](./INSTALL.ru.md)
- [Руководство по установке на французском](./INSTALL.fr.md)
- [Руководство по установке на немецком](./INSTALL.de.md)
- [Руководство по установке на итальянском](./INSTALL.it.md)
- [Руководство по установке на испанском](./INSTALL.es.md)
- [README на английском](./README.md)
- [README на китайском](./README.zh.md)
- [README на японском](./README.ja.md)
- [README на корейском](./README.ko.md)
- [README на русском](./README.ru.md)
- [README на французском](./README.fr.md)
- [README на немецком](./README.de.md)
- [README на итальянском](./README.it.md)
- [README на испанском](./README.es.md)
- [История изменений](./CHANGELOG.md)
- [История изменений на японском](./CHANGELOG.ja.md)
- [История изменений на корейском](./CHANGELOG.ko.md)
- [История изменений на русском](./CHANGELOG.ru.md)
- [История изменений на французском](./CHANGELOG.fr.md)
- [История изменений на немецком](./CHANGELOG.de.md)
- [История изменений на итальянском](./CHANGELOG.it.md)
- [История изменений на испанском](./CHANGELOG.es.md)

Заполнители в этом руководстве:

- `<profile>`: изменяемый профиль DSH, обычно `web`;
- `dsh-patch-edit-plus`: npm-пакет, ID плагина во время выполнения и id единственной строки, которую вставляет патч бандла.

> **Поддерживаемый диапазон DSH: `>=0.2.0-rc.1 <0.2.1-0`.**
>
> Сначала проверьте запущенную версию командой `dsh --version`.
>
> | Версия DSH | Статус | Примечания |
> | --- | --- | --- |
> | `0.2.0-rc.1` | поддерживается | Целевая линия этой ветки. Тайпчек выполнен против реальных peer-пакетов `0.2.0-rc.1` (`npm run typecheck:0.2.0`); Delete/Move используют foreground-API `ShellExecutor.execute()` + `result()`. |
> | `0.1.7-rc.1+` | обслуживается в другом месте | Поддерживается веткой `compat/0.1.7` / dist-tag `dsh-0.1.7` (версия пакета там: 0.2.1). |
> | `0.1.2-rc.1` ~ `0.1.5-rc.2` | обслуживается в другом месте | Поддерживается веткой до 0.1.7 / dist-tag `dsh-0.1.5`. |

## 0. Предварительные требования и обнаружение профиля

```bash
echo "DSH_HOME=${DSH_HOME:-$HOME/.dsh}"
dsh --version
ls "${DSH_HOME:-$HOME/.dsh}/profiles"
```

Используйте профиль, названный вашим запущенным процессом DSH. `web` — распространённое имя, но определяющим является активный аргумент `--profile`.

## 1. Официальная установка

```bash
dsh plugin --profile <profile> add dsh-patch-edit-plus -w
```

(флаг `-w` обязателен, когда профиль является корнем pnpm-workspace, как в случае с `web`.)

Явная установка конкретной версии:

```bash
dsh plugin --profile <profile> add dsh-patch-edit-plus@0.1.1 -w
```

Официальная CLI автоматически обновляет зависимость профиля, lock-файл и `dsh.profile.bundles`. Не добавляйте строку YAML вручную.

### Период охлаждения цепочки поставок

Среда выполнения DSH использует pnpm 11, политика которого `minimumReleaseAge` может заблокировать только что опубликованную версию с ошибкой `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`. Добавьте версию в `minimumReleaseAgeExclude` в `~/.dsh/profiles/<profile>/pnpm-workspace.yaml`:

```yaml
minimumReleaseAgeExclude:
  - dsh-patch-edit-plus@0.1.1
```

## 2. Перезапустите хост

Это плагин **только для хоста**: он регистрирует инструмент и секцию настроек на хосте и не содержит браузерной части. После установки или обновления перезапустите процесс хоста DSH; обновление страницы не требуется и не помогает.

## 3. Обновление

```bash
dsh plugin --profile <profile> update dsh-patch-edit-plus -w
```

После этого перезапустите DSH.

## 4. Регистрация по локальному пути / `link:` (альтернатива)

```bash
#    ~/.dsh/profiles/<profile>/package.json dependencies:
#      "dsh-patch-edit-plus": "link:<absolute path to dsh-patch-edit-plus>"
#    ~/.dsh/profiles/<profile>/cordis.patch.yml:
#      - insert:
#          - id: dsh-patch-edit-plus
#            name: dsh-patch-edit-plus
cd ~/.dsh/profiles/<profile> && pnpm install && dsh web
```

Либо используйте официальную CLI с локальным путём (сеть не нужна):

```bash
dsh plugin --profile <profile> add /absolute/path/to/dsh-patch-edit-plus -w
```

Сборка из исходного чекаута использует эти скрипты:

```bash
npm install
npm run build          # tsc -p tsconfig.build.json → lib/ + lib/types/
npm run typecheck      # tsc -p tsconfig.json
npm run verify:source  # source-level assertions
npm run test           # vitest run
npm run smoke          # _smoke/load-smoke.mjs
```

`lib/` не коммитится, поэтому исходный чекаут нужно собрать, прежде чем регистрировать его по пути. При публикации сборка выполняется автоматически хуком `prepublishOnly`, так что опубликованный tarball всегда содержит скомпилированный вывод.

## 5. Проверка установки

```bash
grep -n "dsh-patch-edit-plus" \
  "${DSH_HOME:-$HOME/.dsh}/profiles/<profile>/package.json"
node -p "require('${DSH_HOME:-$HOME/.dsh}/profiles/<profile>/node_modules/dsh-patch-edit-plus/package.json').version"
```

Проверьте официальную композицию:

```bash
dsh --profile <profile> --dump-default-config
```

Она должна содержать:

```yaml
- id: dsh-patch-edit-plus
  name: dsh-patch-edit-plus
```

## 6. Проверка плагина

После перезапуска подтвердите в сессии:

1. Инструмент `apply_patch` доступен модели.
2. Патч в виде unified diff применяется, и содержимое файла в точности совпадает с диффом.
3. Патч, не прошедший проверку, оставляет рабочую область нетронутой — движок проверяет всё в режиме только чтение, прежде чем что-либо записывать.
4. Патч в стиле Codex при выключенном `allowCodexPatch` возвращает действенную подсказку, объясняющую модели, как включить этот стиль или повторить попытку в unified diff, а не общую ошибку разбора.

Если другой плагин уже предоставляет инструмент с именем `apply_patch`, исход определяет трёхуровневая политика конфликтов (`rename` по умолчанию, либо `skip` / `fail`). При значении по умолчанию `rename` запуск DSH не страдает, а инструмент регистрируется под именем с суффиксом.

## 7. Устранение неполадок

| Симптом | Действие |
| --- | --- |
| `dsh` не найден | Установите или включите официальную CLI DSH. |
| `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` | Добавьте версию в `minimumReleaseAgeExclude` в `pnpm-workspace.yaml` профиля. |
| `apply_patch` не появляется | Перезапустите процесс хоста и снова проверьте строку композиции. |
| Конфликт имени инструмента с другим провайдером `apply_patch` | Установите политику конфликтов в `rename` (по умолчанию), `skip` или `fail`, см. README. |
| Синтаксис Codex отклонён | Включите `allowCodexPatch: true` или отправьте изменение заново в виде unified diff. |
| Несовпадение хунка | Прочтите четырёхэлементную диагностику (файл + индекс хунка, начало поиска, ожидаемое превью, фактический фрагмент) и заново отправьте хунк с совпадающим контекстом. |

## 8. Удаление

```bash
dsh plugin --profile <profile> remove dsh-patch-edit-plus
```

После этого перезапустите DSH.

## Лицензия

MIT
