# dsh-patch-edit-plus

Español | [English](./README.md) | [简体中文](./README.zh.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md) | [Français](./README.fr.md) | [Deutsch](./README.de.md) | [Italiano](./README.it.md) | [Русский](./README.ru.md)

Edición de archivos estilo parche para [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness): una única herramienta `apply_patch` expuesta al modelo, que acepta **diff git/unificado** (por defecto) y la **sintaxis `apply_patch` de Codex** (opcional), aplica cada cambio bajo el principio de **todo-o-nada** y no estorba en absoluto a DSH.

## Compatibilidad de versiones de DSH

| Versión de DSH | Estado | Notas |
|---|---|---|
| `0.2.0-rc.1+` | ✅ compatible (esta línea, v0.3.0+) | Ajustes declarativos: `allowCodexPatch` está marcado con `.volatile()` — el formulario de ajustes se genera automáticamente y `loader/volatile-update` vuelve a registrar la herramienta sin remontaje. Sin llamada de registro. Delete/Move migrados a la API de primer plano `ShellExecutor.execute()` + `result()`. |
| `0.1.7-rc.1+` | ↗ línea de mantenimiento | Atendida por la rama `compat/0.1.7` / el dist-tag `dsh-0.1.7` (v0.2.1 allí). El ejecutor de shell de 0.2.0 renombró `run` → `execute` (cambio introducido entre 0.1.2 y 0.1.7), así que una sola base de código no puede atender ambas líneas de forma type-safe. |
| `0.1.2-rc.1` ~ `0.1.5-rc.2` | ↗ línea de mantenimiento | Atendida por la rama anterior a 0.1.7 / el dist-tag `dsh-0.1.5`. La 0.1.7 eliminó las API imperativas de ajustes de las que dependía el fallback de doble API. |

En esta línea los ajustes son declarativos: los campos marcados con `.volatile()` en `Config` se convierten en el formulario de ajustes; el plugin se suscribe a `loader/volatile-update` en lugar de recibir hooks de registro.

## ¿Por qué usar parches? (guía de enrutamiento de herramientas)

La descripción de la herramienta dirige explícitamente al modelo:

- **Un único cambio pequeño en un archivo ya leído** → prefiere la herramienta nativa `edit` (un parche cuesta más tokens que una edición literal).
- **Cambio pequeño dentro de un archivo GRANDE** → `apply_patch` (no hace falta reenviar el archivo entero).
- **Cambios por lotes en MUCHOS archivos** → `apply_patch` (una sola llamada, verificada atómicamente).
- **Archivo nuevo con contenido sustancial / borrado / renombrado** → `apply_patch`.

## Instalación

```bash
dsh plugin --profile web add <path-to-dsh-patch-edit-plus>
dsh web --dump-config   # verify the plugin row appears
# restart DSH
```

## Uso

### Diff unificado (por defecto, activado)

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

### Sintaxis apply_patch de Codex (opcional)

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

Se activa con `allowCodexPatch: true`. Cuando llega un parche de Codex con la opción desactivada, la herramienta devuelve una **pista accionable** (cómo activarla o cómo reintentar en diff unificado) en lugar de un error genérico de análisis — la sintaxis de Codex es un prior fuerte para los modelos de la familia GPT, y un fallo silencioso los atrapa en bucles de reintentos.

### Operaciones

| Operación | Diff unificado | Codex | Ruta de ejecución |
|---|---|---|---|
| Añadir | `new file mode` + `/dev/null` | `*** Add File:` | `ctx.fs.writeText` (secuencia de intent oficial) |
| Actualizar (multi-hunk) | `@@` hunks | `@@` hunks | `ctx.fs.writeText` |
| Eliminar | `deleted file mode` + `/dev/null` | `*** Delete File:` | `ctx.shell` (consciente de la sandbox, ruta pasada por env) |
| Mover / renombrar | `rename from/to` | `*** Move to:` | `ctx.shell` |

## Garantías

- **Todo-o-nada**: el parche completo se verifica primero contra el contenido actual de los archivos (localización del contexto, contención del workspace, política de symlinks, rutas duplicadas); cualquier fallo aborta sin escribir un solo byte.
- **Se respeta la barrera de leer-antes-de-escribir**: cada escritura replica la secuencia de intent de la herramienta oficial `write` — cascada `fs/write-intent` → `writeText` protegido → emisión `fs/observed`. Un `writeText` a secas sortearía silenciosamente la barrera, porque los providers de DSH nunca despachan ellos mismos los eventos `fs/*`.
- **Diagnóstico preciso de fallos**: ante un hunk que no coincide, el error incluye archivo + índice del hunk, línea de origen de la búsqueda, vista previa de la línea esperada (con los espacios hechos visibles), el extracto real del archivo y una pista concreta.
- **Fidelidad de los finales de línea**: los archivos CRLF se reescriben como CRLF; los finales sin salto de línea final se preservan, salvo que el parche cambie el final.
- **Adición pura**: el plugin registra exactamente una herramienta, nunca llama a `tools.restrict()`, nunca sobrescribe una herramienta nativa, no registra servicios globales y lo elimina todo al descargarse. Los conflictos de nombre con otros proveedores de `apply_patch` (`bainianlaoyao/dsh-codex-mode`, `shuind/dsh-codex-harness`, …) se resuelven evitando el renombrado (`apply_patch_1`, `…_2`, …), de modo que DSH nunca falle al arrancar.

## Configuración

| Opción | Predeterminado | Descripción |
|---|---|---|
| `toolName` | `apply_patch` | Nombre de la herramienta expuesta al modelo. |
| `conflictPolicy` | `rename` | `rename` / `skip` / `fail` cuando el nombre de la herramienta ya está ocupado. |
| `renameSuffix` | `_1` | Sufijo usado por la evitación del renombrado. |
| `allowUnifiedDiff` | `true` | Aceptar diffs git/unificados. |
| `allowCodexPatch` | `false` | Aceptar la sintaxis `apply_patch` de Codex. También editable en el panel de ajustes de DSH; los cambios surten efecto de inmediato, sin reinicio. |
| `deleteBackend` | `shell` | `shell` o `none` (Delete/Move devuelven un error estructurado). |
| `shellDialect` | `auto` | `auto` (pwsh en win32) / `posix` / `pwsh`. |
| `deleteCommand` / `moveCommand` | built-in | Plantillas de comando personalizadas. Las rutas siguen llegando **solo por variables de entorno** (`DSH_PATCH_TARGET` / `DSH_PATCH_SOURCE`); nunca las interpole en la cadena de comando. |
| `dryRunByDefault` | `false` | Tratar las llamadas como ensayos en seco (dry run) salvo `dryRun: false`. |
| `followSymlinks` | `false` | Permitir que las rutas del parche atraviesen symlinks. |
| `maxFiles` | `50` | Número máximo de secciones de archivo por parche. |
| `maxPatchBytes` | `524288` | Tamaño máximo del texto del parche en bytes. |
| `maxDiffBytes` | `16384` | Tamaño máximo del diff por archivo conservado en los metadatos del resultado (los diffs mayores se vacían y se marcan como `truncated`). |

## Limitaciones (declaradas)

- **Delete/Move se ejecutan a través de `ctx.shell`.** La fortaleza de la sandbox es la que haga cumplir el ejecutor de shell cargado (`bash-sandbox` aisla; `bash-local` no) — la misma postura de riesgo que la herramienta bash nativa. Cada petición lleva una `sandboxPolicy` e informa de los hechos de la sandbox, de modo que «política denegada» sea distinguible de «comando fallido».
- **Cada escritura y cada Delete/Move llevan la política con alcance de sesión.** `apply_patch` resuelve `ctx.sandboxPolicy.resolve({ session })` en cada llamada — la anulación de modo de la sesión más su cwd como raíz del workspace — exactamente igual que las herramientas nativas `write`/`edit`, y resuelve las rutas del plan contra esa misma raíz. Sin ello, el sistema de archivos que hace cumplir la política retrocede a la raíz de despliegue, lo que hace que las escrituras dentro del workspace fallen como denegaciones `workspace-write` incluso en una sesión `danger-full-access`. Una denegación `workspace-write` se manifiesta como una `PatchError` cuyo mensaje incluye el texto del backend (el marcador estructurado `[sandbox: …]` y los campos de escalada del mismo turno no están implementados; use las herramientas nativas `write`/`edit` si necesita escalar).
- **Add no crea los directorios padre.** Esto coincide con la herramienta nativa `write` (`ctx.fs` no tiene mkdir); el error nombra el directorio que falta.
- Sin coincidencia difusa/por desplazamiento: la localización de los hunks es exacta → `trimEnd` → `trim`, deliberadamente (la coincidencia difusa no es segura para operaciones destructivas; está en la hoja de ruta).
- Los parches binarios se rechazan con un error claro.

## Desarrollo

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

La verificación manual sobre un DSH en vivo (`dsh plugin --profile web add` → reinicio → llamada a la herramienta en una sesión) se deja deliberadamente al operador.

## Licencia

MIT
