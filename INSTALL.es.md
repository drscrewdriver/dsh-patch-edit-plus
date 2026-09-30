# Guía de instalación (CLI oficial de DSH)

Esta guía usa únicamente el comando oficial de DSH `dsh plugin`. Ese comando instala la dependencia en un perfil y sincroniza `dsh.profile.bundles`. No lo sustituya por un `npm install` sencillo, un `pnpm add` directo en el perfil o ediciones manuales del manifiesto del perfil.

- [Guía de instalación en inglés](./INSTALL.md)
- [Guía de instalación en chino](./INSTALL.zh.md)
- [Guía de instalación en japonés](./INSTALL.ja.md)
- [Guía de instalación en coreano](./INSTALL.ko.md)
- [Guía de instalación en español](./INSTALL.es.md)
- [Guía de instalación en francés](./INSTALL.fr.md)
- [Guía de instalación en alemán](./INSTALL.de.md)
- [Guía de instalación en italiano](./INSTALL.it.md)
- [Guía de instalación en ruso](./INSTALL.ru.md)
- [README en inglés](./README.md)
- [README en chino](./README.zh.md)
- [README en japonés](./README.ja.md)
- [README en coreano](./README.ko.md)
- [README en español](./README.es.md)
- [README en francés](./README.fr.md)
- [README en alemán](./README.de.md)
- [README en italiano](./README.it.md)
- [README en ruso](./README.ru.md)
- [Registro de cambios](./CHANGELOG.md)
- [Registro de cambios en japonés](./CHANGELOG.ja.md)
- [Registro de cambios en coreano](./CHANGELOG.ko.md)
- [Registro de cambios en español](./CHANGELOG.es.md)
- [Registro de cambios en francés](./CHANGELOG.fr.md)
- [Registro de cambios en alemán](./CHANGELOG.de.md)
- [Registro de cambios en italiano](./CHANGELOG.it.md)
- [Registro de cambios en ruso](./CHANGELOG.ru.md)

Los marcadores de posición de esta guía son:

- `<profile>`: el perfil de DSH que hay que modificar, normalmente `web`;
- `dsh-patch-edit-plus`: el paquete npm, el ID del plugin en tiempo de ejecución y el id de la única fila que inserta el parche del bundle.

> **Rango de DSH admitido: `>=0.2.0-rc.1 <0.2.1-0`.**
>
> Compruebe primero la versión en ejecución con `dsh --version`.
>
> | Versión de DSH | Estado | Notas |
> | --- | --- | --- |
> | `0.2.0-rc.1` | compatible | Línea objetivo de esta rama. Comprobación de tipos contra los paquetes peer reales `0.2.0-rc.1` (`npm run typecheck:0.2.0`); Delete/Move usan la API de primer plano `ShellExecutor.execute()` + `result()`. |
> | `0.1.7-rc.1+` | atendido en otro lugar | Mantenido en la rama `compat/0.1.7` / el dist-tag `dsh-0.1.7` (versión del paquete allí: 0.2.1). |
> | `0.1.2-rc.1` ~ `0.1.5-rc.2` | atendido en otro lugar | Mantenido en la rama anterior a 0.1.7 / el dist-tag `dsh-0.1.5`. |

## 0. Requisitos previos y descubrimiento del perfil

```bash
echo "DSH_HOME=${DSH_HOME:-$HOME/.dsh}"
dsh --version
ls "${DSH_HOME:-$HOME/.dsh}/profiles"
```

Use el perfil que indique su proceso de DSH en ejecución. `web` es habitual, pero el argumento `--profile` activo es lo que manda.

## 1. Instalación oficial

```bash
dsh plugin --profile <profile> add dsh-patch-edit-plus -w
```

(la opción `-w` es obligatoria cuando el perfil es la raíz de un workspace de pnpm, como es el caso de `web`.)

Instalar explícitamente una versión concreta:

```bash
dsh plugin --profile <profile> add dsh-patch-edit-plus@0.1.1 -w
```

La CLI oficial actualiza automáticamente la dependencia del perfil, el lockfile y `dsh.profile.bundles`. No añada una fila YAML manual.

### Período de enfriamiento de la cadena de suministro

El runtime de DSH usa pnpm 11, cuya política `minimumReleaseAge` puede bloquear una versión recién publicada con `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`. Añada la versión a `minimumReleaseAgeExclude` en `~/.dsh/profiles/<profile>/pnpm-workspace.yaml`:

```yaml
minimumReleaseAgeExclude:
  - dsh-patch-edit-plus@0.1.1
```

## 2. Reiniciar el host

Este es un plugin **solo de host**: registra una herramienta y una sección de ajustes en el host, y no incluye ninguna parte de navegador. Reinicie el proceso host de DSH tras instalar o actualizar; recargar la página no es necesario ni suficiente.

## 3. Actualización

```bash
dsh plugin --profile <profile> update dsh-patch-edit-plus -w
```

Reinicie DSH después.

## 4. Registro por ruta local / `link:` (alternativa)

```bash
#    ~/.dsh/profiles/<profile>/package.json dependencies:
#      "dsh-patch-edit-plus": "link:<absolute path to dsh-patch-edit-plus>"
#    ~/.dsh/profiles/<profile>/cordis.patch.yml:
#      - insert:
#          - id: dsh-patch-edit-plus
#            name: dsh-patch-edit-plus
cd ~/.dsh/profiles/<profile> && pnpm install && dsh web
```

O use la CLI oficial con una ruta local (sin necesidad de red):

```bash
dsh plugin --profile <profile> add /absolute/path/to/dsh-patch-edit-plus -w
```

La compilación desde un checkout del código fuente usa estos scripts:

```bash
npm install
npm run build          # tsc -p tsconfig.build.json → lib/ + lib/types/
npm run typecheck      # tsc -p tsconfig.json
npm run verify:source  # source-level assertions
npm run test           # vitest run
npm run smoke          # _smoke/load-smoke.mjs
```

`lib/` no se sube al repositorio, así que un checkout del código fuente debe compilarse antes de poder registrarse por ruta. La publicación lo compila automáticamente mediante el hook `prepublishOnly`, de modo que el tarball publicado siempre contiene la salida compilada.

## 5. Verificar la instalación

```bash
grep -n "dsh-patch-edit-plus" \
  "${DSH_HOME:-$HOME/.dsh}/profiles/<profile>/package.json"
node -p "require('${DSH_HOME:-$HOME/.dsh}/profiles/<profile>/node_modules/dsh-patch-edit-plus/package.json').version"
```

Compruebe la composición oficial:

```bash
dsh --profile <profile> --dump-default-config
```

Debe contener:

```yaml
- id: dsh-patch-edit-plus
  name: dsh-patch-edit-plus
```

## 6. Verificar el plugin

Tras el reinicio, confirme en una sesión:

1. La herramienta `apply_patch` está disponible para el modelo.
2. Un parche en diff unificado se aplica y el contenido del archivo coincide exactamente con el diff.
3. Un parche que no supera la verificación deja el workspace intacto — el motor verifica todo en modo de solo lectura antes de escribir nada.
4. Un parche estilo Codex con `allowCodexPatch` desactivado devuelve una pista accionable que indica al modelo cómo activar el estilo o reintentar en diff unificado, en lugar de un error genérico de análisis.

Si otro plugin ya proporciona una herramienta llamada `apply_patch`, la política de conflictos de tres niveles (`rename` por defecto, o `skip` / `fail`) decide el resultado. Con el `rename` por defecto, el arranque de DSH no se ve afectado y la herramienta se registra con un nombre con sufijo.

## 7. Solución de problemas

| Síntoma | Acción |
| --- | --- |
| `dsh` no se encuentra | Instale o habilite la CLI oficial de DSH. |
| `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` | Añada la versión a `minimumReleaseAgeExclude` en el `pnpm-workspace.yaml` del perfil. |
| `apply_patch` no aparece | Reinicie el proceso host y vuelva a comprobar la fila de la composición. |
| Choque de nombre de herramienta con otro proveedor de `apply_patch` | Fije la política de conflictos en `rename` (por defecto), `skip` o `fail`, según el README. |
| Sintaxis de Codex rechazada | Active `allowCodexPatch: true` o reenvíe el cambio como diff unificado. |
| Hunk que no coincide | Lea el diagnóstico de cuatro elementos (archivo + índice del hunk, origen de la búsqueda, vista previa esperada, extracto real) y reenvíe el hunk con un contexto coincidente. |

## 8. Desinstalación

```bash
dsh plugin --profile <profile> remove dsh-patch-edit-plus
```

Reinicie DSH después.

## Licencia

MIT
