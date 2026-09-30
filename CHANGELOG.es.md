# Registro de cambios

## [0.3.0] — 2026-09-29

### Cambiado

- **Soporte de la línea DSH 0.2.0 (rama `compat/0.2.0`).** Los rangos de peers y `engines.dsh` (ambos manifiestos) ahora declaran `>=0.2.0-rc.1 <0.2.1-0`; versión 0.3.0. Las devDependencies fijan la línea base de tipos real `0.2.0-rc.1`, y el script de verificación cruzada pasa a ser `npm run typecheck:0.2.0` (instala los paquetes peer reales desde el registry). Los hosts 0.1.x siguen siendo atendidos por la rama `compat/0.1.7` / el dist-tag `dsh-0.1.7`.
- **Delete/Move migrados a la API actual del ejecutor de shell.** Entre las líneas de host 0.1.2 y 0.1.7, `ShellExecutor.run(spec)` fue renombrado a `execute(spec)` — devolviendo un manejador `ShellProcess` con una proyección de primer plano `result()`. El pin antiguo de devDependency (`0.1.2-rc.1`) lo enmascaraba: el paquete de la línea 0.1.7 (0.2.1) pasaba la comprobación de tipos contra una línea base obsoleta, y en ejecución sobre hosts 0.1.7+ reales su duck-typing basado en `run` nunca coincidía, de modo que Delete/Move se degradaban al error estructurado UNSUPPORTED. Esta línea llama a `shell.execute(...)` y espera `execution.result()`; el ejecutor se detecta mediante `execute`.

## [0.1.2] — 2026-09-19

### Corregido

- **La sección de ajustes nunca llegó a registrarse.** El espacio de nombres de ajustes `patch_edit_plus` contiene un guion bajo, que el patrón de espacios de nombres de `dsh-settings` (`^[a-z][a-z0-9-]*$`) rechaza, así que `register()` lanzaba una excepción antes de que nada se persistiera — no aparecía ninguna entrada de ajustes en el panel ni en `~/.dsh/settings.yaml`. Renombrado a `patch-edit-plus` (sin migración necesaria: la sección antigua nunca pudo existir).
- **Los cambios de configuración de la capa de ajustes nunca llegaban a la herramienta.** Los hooks `setSource`/`onChange` eran no-ops y la configuración resuelta se memoizaba una sola vez al cargar. El plugin ahora consume la fuente resuelta: cada cambio de ajustes confirmado (o el watch heredado de `register`) vuelve a resolver la configuración y vuelve a registrar la herramienta — eliminando antes el registro antiguo, porque registrar de nuevo sobre un nombre ya vivo lo renombra silenciosamente. `allowCodexPatch` y todos los demás campos ya se pueden conmutar desde el panel de ajustes de DSH y surten efecto de inmediato, con la descripción de la herramienta (la lista de estilos de parche aceptados) manteniéndose sincronizada; sin necesidad de reiniciar el proceso. Al desacoplar el servicio de ajustes se vuelve a la entrada de composición, y el rejuicio es idempotente (se compara toda la configuración resuelta, no solo un campo).

## [0.1.1] — 2026-09-17

### Corregido

- **Cada escritura era denegada bajo `workspace-write`.** La herramienta no pasaba ninguna `sandboxPolicy` por llamada, así que el sistema de archivos que hace cumplir la política retrocedía a `ctx.sandboxPolicy.resolve()` sin ámbito — la raíz del workspace de DESPLIEGUE (el directorio de arranque del servidor) en lugar del cwd de la sesión. Una ruta claramente dentro del workspace de la sesión fallaba por tanto la prueba de contención y devolvía `file access denied under workspace-write mode`, incluso en una sesión `danger-full-access`, donde el modo ni siquiera se leía. La política ahora se resuelve por llamada con la sesión llamante en el ámbito (`resolve({ session })`) y se estampa en cada escritura y en cada petición de shell de Delete/Move, exactamente como lo hacen las herramientas nativas `write`/`edit`. Ahora se honran ambas mitades del modo: la anulación `sandbox/mode` de la sesión y su cwd como raíz del workspace.
- La resolución de rutas y la valla ahora comparten una misma raíz: el plan resuelve cada objetivo contra el `workspaceRoot` de la política (con retroceso al cwd de la sesión), de modo que la ruta que escribe el motor es la ruta que mide la valla.

## Unreleased

### Añadido

- Única herramienta `apply_patch` expuesta al modelo, que acepta diff git/unificado (por defecto) y la sintaxis `apply_patch` de Codex (opcional mediante `allowCodexPatch`).
- Detección automática de formato con una pista accionable cuando llega un estilo reconocido pero desactivado.
- Operaciones Add / Update (multi-hunk) / Delete / Move; Delete y Move pasan por el `ctx.shell` consciente de la sandbox, con las rutas pasadas únicamente por variables de entorno.
- Motor de dos fases todo-o-nada: verificación completa en solo lectura (localización del contexto con tres niveles de tolerancia, contención del workspace, rechazo de symlinks, detección de rutas duplicadas) antes de cualquier escritura.
- Secuencia oficial de write-intent en cada escritura: cascada `fs/write-intent` → `writeText` protegido → emisión `fs/observed`, de modo que la barrera de leer-antes-de-escribir se aplica a las escrituras de parches.
- Diagnóstico de cuatro elementos para hunks que no coinciden (archivo + índice del hunk, origen de la búsqueda, vista previa esperada con espacios visibles, extracto real) más una pista concreta.
- Parámetro `dryRun` y configuración `dryRunByDefault`.
- Salida agrupada con semántica Codex (added → modified → deleted), con diffs por archivo limitados por `maxDiffBytes` y `presentationMeta` seguro para el replay.
- Protección de tres niveles frente a conflictos de nombres de herramientas (`rename` por defecto / `skip` / `fail`), de modo que las colisiones con otros proveedores de `apply_patch` nunca rompan el arranque de DSH.
- Compatibilidad con DSH `0.1.2-rc.1` ~ `0.1.5-rc.2`: ruta de código única de autoría de herramientas más verificación estática `typecheck:0.1.5` contra los paquetes peer 0.1.5-rc.2; fallback de doble API para ajustes (`installSection` / `register`).
