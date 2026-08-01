# Manual de Usuario — Plataforma Logística Friosan SPA

**Versión del documento:** 1.1
**Fecha de revisión:** 1 de agosto de 2026
**Público objetivo:** personal de Portería, Recepción, Operaciones, Calidad, Comercial, Gerencia, Administración y usuarios de visor.
**Base de verificación:** rutas, componentes React, modelo de datos, autenticación, reglas de Firestore y Storage, y compilación de producción del proyecto.

> Este manual describe únicamente funciones presentes en la aplicación revisada. Las limitaciones operativas conocidas se reúnen en la sección 17.

## 1. Objetivo general de la plataforma

La plataforma permite coordinar el ingreso y avance de camiones en Friosan SPA. Centraliza:

- La agenda diaria de camiones previstos.
- El registro de camiones no previstos.
- Los datos del conductor, patente, empresa, guía y tipo de operación.
- La asignación de conos o andenes de recepción y despacho.
- El avance del camión por estados operativos.
- Los controles de calidad, temperatura, evidencias y firma del receptor.
- La consulta de historiales, indicadores y reportes de gerencia.
- La analítica rápida del flujo y la administración de cuentas para Super Admin.
- La visualización del flujo en monitores o televisores.

La información se actualiza desde Firebase. Cuando la conexión en vivo funciona, los cambios realizados por un área aparecen en las demás pantallas sin recargar manualmente.

## 2. Conceptos y flujo operativo

### 2.1 Áreas y ubicaciones

- **Recepción:** ingreso o descarga de mercadería.
- **Despacho:** salida o carga de mercadería.
- **Conos:** zona de espera sin andén asignado.
- **Andén:** ubicación numerada del 1 al 9. En algunas pantallas se muestra como `A-1`, `A-2`, etc.
- **Con bitácora:** camión creado previamente en la agenda comercial.
- **Sin bitácora:** camión no previsto, registrado directamente por Portería.

### 2.2 Estados disponibles

| Estado | Significado práctico |
|---|---|
| Agendado | El camión fue incorporado a la planificación. |
| En camino | Estado disponible para uso administrativo; no existe un botón operativo específico que lo asigne automáticamente. |
| En portería | El camión está siendo controlado en el acceso. |
| En espera | El camión ya fue registrado y espera atención o andén. |
| En curso | La carga o descarga está en ejecución. |
| Recepcionado | El proceso principal fue recibido o completado. |
| Almacenado | La mercadería fue almacenada. |
| Cerrado | El viaje fue cerrado operacionalmente. |
| Terminado | El registro se finalizó, normalmente desde el visor/monitor o mediante una acción administrativa. |

El flujo habitual es:

`Agendado → En portería → En espera → En curso → Recepcionado → Almacenado → Cerrado → Terminado`

El administrador puede seleccionar cualquiera de los estados. Recepción dispone además de acciones para reabrir o retroceder registros. Al retroceder un estado, la aplicación restablece la ubicación a **Conos** y el andén a `0`; revise la asignación antes de continuar.

## 3. Ingreso, recuperación de contraseña y cierre de sesión

### 3.1 Iniciar sesión

1. Abra la dirección de la plataforma entregada por Friosan.
2. En **Usuario (correo)**, escriba su correo completo.
3. En **Contraseña**, ingrese su clave.
4. Si necesita comprobar lo escrito, presione **Ver**. Para volver a ocultarla, presione **Ocultar**.
5. Presione **Iniciar sesión**.
6. La plataforma lo dirigirá automáticamente a la pantalla correspondiente a su rol.

Si el correo o la contraseña son incorrectos, aparece el mensaje: **“No pudimos iniciar sesión. Revisa tus credenciales.”**

> La sesión se conserva sólo en memoria. Al actualizar la página, cerrar la pestaña o perder la sesión, puede ser necesario ingresar nuevamente. Esta es la conducta implementada actualmente.

### 3.2 Recuperar la contraseña

1. Escriba su correo en **Usuario (correo)**.
2. Presione **Olvidé contraseña**.
3. Revise la bandeja de entrada y la carpeta de correo no deseado.
4. Abra el mensaje enviado por Firebase y siga el enlace de recuperación.

Si no escribe un correo, la pantalla indica: **“Ingresa tu correo para recuperar la clave.”**

### 3.3 Cerrar sesión

- En la barra superior, presione **Salir**.
- En el panel de Portería también existe un segundo botón **Salir** dentro de la cabecera de esa pantalla.

No cierre solamente la pestaña cuando el equipo sea compartido; use siempre **Salir**.

### 3.4 Abrir el visor TV

Desde la pantalla de ingreso, presione **Abrir visor TV**. La aplicación intentará iniciar una sesión anónima y mostrar el tablero. Si aparece **“Iniciando visor”**, espere la conexión. El visor requiere que el acceso anónimo esté habilitado en Firebase y que el dominio esté autorizado.

## 4. Tipos de usuarios

La plataforma reconoce diez roles:

| Rol | Uso principal |
|---|---|
| `porteria` | Control de acceso, bitácora, conductor, patente, guía y asignación de andén. |
| `recepcion` | Avance del flujo operativo y registros de calidad. |
| `operaciones` | Consulta del tablero y uso de módulos auxiliares autorizados. |
| `calidad` | Registro de condición, temperatura, evidencias, decisión y firma. |
| `comercial` | Agenda diaria de camiones. |
| `gerencia` | Indicadores, gráficos, reportes y consulta de calidad. |
| `visor` | Tablero general/monitor e identificación de camiones terminados. |
| `clientes` | Consulta del directorio de clientes. |
| `admin` | Gestión operativa amplia, sin acceso al panel exclusivo de superadministración. |
| `superadmin` | Analítica operativa, gestión total de camiones, cuentas de empleados, informes de seguridad y accesos rápidos. |

La matriz completa de rutas, acciones y límites está en [Funciones_y_Roles.md](Funciones_y_Roles.md).

## 5. Elementos comunes de la plataforma

### 5.1 Barra superior

La cabecera muestra el logotipo, el rol activo y los siguientes controles:

- **Pantalla completa:** amplía la aplicación. El texto cambia a **Salir pantalla completa** mientras esté activa.
- **Salir:** cierra la sesión.
- **Panel Admin:** visible sólo para `superadmin` y abre el panel administrativo.

No existe un menú general para todos los módulos. Cada rol recibe una pantalla inicial y, cuando corresponde, botones internos para pasar a otras vistas.

### 5.2 Lectura de las tarjetas de camión

Una tarjeta puede mostrar:

- Estado actual.
- Cliente o empresa.
- Patente y conductor.
- Conos o número de andén.
- Tipo de carga: carga, descarga o mixto.
- Hora agendada, ingreso a portería e ingreso a andén.
- Tiempo de espera o de proceso.
- Última actualización y notas.

Un camión en espera por 30 minutos o más aparece como retrasado. Los registros arrastrados desde un día anterior pueden aparecer con la marca **Prioridad / Ayer**.

## 6. Panel Comercial: agendar camiones

El rol `comercial` ingresa directamente al **Panel comercial**. Los roles `admin` y `superadmin` también pueden usar esta pantalla. `operaciones` puede consultarla, pero el alta comercial no está habilitada efectivamente para ese rol en la interfaz.

### 6.1 Crear una agenda

1. Ubique la sección **Plantilla diaria (comercial)**.
2. En **Cliente**, escriba el nombre de la empresa o cliente.
3. En **Fecha y hora agendada**, seleccione fecha y hora. Puede presionar el ícono de calendario.
4. En **Bitácora**, elija **Con bitácora** o **Sin bitácora**. Para el flujo comercial habitual use **Con bitácora**.
5. En **Tipo carga**, seleccione **Carga**, **Descarga** o **Mixto**.
6. Escriba notas si son necesarias.
7. Presione **Agregar a plantilla**.
8. Confirme el mensaje **“Camión agendado en la plantilla.”** y verifique visualmente que el registro quedó en el día correcto.

El camión se crea en estado **Agendado**, sin patente ni conductor. Portería completará esos datos cuando llegue.

### 6.2 Consultar la agenda

- Use **Día a mostrar** para elegir la fecha.
- La tabla muestra hora agendada, cliente, tipo de carga, estado y notas.
- En la parte superior use **Buscar por cliente, notas o andén** para reducir la lista visible.
- El panel **Mercadería por andenes** considera activos los registros que no estén en estado Cerrado o Terminado.

La pantalla comercial no ofrece botones para editar o eliminar agendas ya creadas. Esas operaciones se realizan con cuentas administrativas.

## 7. Panel de Portería

Portería abre por defecto la **Bitácora de ingresos**, con los registros en estados Agendado, En camino, En portería o En espera.

### 7.1 Recibir un camión agendado

1. Busque el camión en la tabla por razón social y hora agendada.
2. Si faltan patente, conductor o RUT, presione **Completar datos**. Si ya existen, el botón se llama **Editar datos**.
3. Complete **Patente**, **Nombre conductor** y **RUT conductor**.
4. Presione **Guardar datos** para guardar los tres campos. El botón **Guardar patente** guarda únicamente la patente.
5. Si no existe una guía, presione **Subir foto guía** y elija una imagen. Cuando ya existe, use **Ver foto guía**.
6. En la columna **Estado**, seleccione **En portería** o **En espera**, de acuerdo con el procedimiento interno.
7. Cuando corresponda iniciar la operación, seleccione **En curso**.
8. Aparecerá **Selecciona andén y operación**. Elija el andén `A-1` a `A-9` y **Carga** o **Descarga**.
9. Presione **Asignar**.

La plataforma impide asignar un andén que ya tenga otro camión **En curso** y exige patente, conductor y RUT antes de derivar el camión.

### 7.2 Registrar un camión no previsto

1. Presione **Ingresar camión extra**.
2. Complete los campos obligatorios: **Nombre conductor**, **Rut**, **Patente** y **Empresa**.
3. Seleccione **Cargar / Descargar**.
4. En **Ingreso a**, seleccione **Conos** o **Andén**.
5. Si elige Andén, seleccione un número del 1 al 9. Compruebe antes que esté libre; este formulario no valida ocupación con la misma lógica de la bitácora.
6. Opcionalmente adjunte una **Foto de la guía** y escriba **Notas**.
7. Presione **Guardar ingreso**.

El camión se crea directamente en estado **En espera**, con la hora actual y marcado como **Sin bitácora**. Si la foto falla, el camión puede quedar registrado igualmente y aparecerá un mensaje específico.

Para volver a la agenda, presione **Volver a bitácora**.

### 7.3 Consultar el registro del día

En **Registro de hoy — Camiones ingresados**:

1. Localice el registro.
2. Presione **Ver** para consultar conductor, RUT, patente, empresa, tipo de operación y notas.
3. Presione **Ocultar** para cerrar el detalle.

## 8. Panel principal de Recepción y Operaciones

La ruta de Recepción utiliza el **Panel principal — Operaciones en vivo**.

### 8.1 Interpretar el panel

El encabezado muestra fecha, hora, clima cuando está disponible, cantidad de camiones y andenes ocupados. Debajo aparecen:

- Selector **Recepción / Despacho**.
- Búsqueda por cliente, patente, conductor o andén.
- **Vista calidad**.
- **Ver registros / Ocultar registros**.
- **Modo solo vista / Salir de solo vista** para los roles que pueden operar.
- **+ Nuevo camión** sólo para `admin` y `superadmin`.
- Indicadores de espera, curso, recepcionados y almacenados.
- Paneles de retrasos, ocupación de andenes, agenda, columnas por estado e historial de hoy.

### 8.2 Cambiar el estado de un camión

Con rol `recepcion`, `admin` o `superadmin`:

1. Localice la tarjeta en la columna correspondiente.
2. Use la acción específica del estado:
   - **Mover a en curso** desde En espera.
   - **Marcar recepcionado** desde En curso.
   - **Marcar almacenado** desde Recepcionado.
   - **Cerrar viaje** desde Almacenado.
   - **Reabrir en curso** o **Reabrir** cuando necesite volver atrás.
3. Confirme visualmente que la tarjeta cambió de columna.

También aparecen **Siguiente etapa** y **Retroceder**. Prefiera las acciones con nombre de etapa para reducir errores. Al retroceder se borra la asignación actual de andén y el camión vuelve a Conos.

### 8.3 Marcar un retraso

En una tarjeta **En espera**, presione **Marcar retraso**. La versión actual no abre un cuadro para escribir el motivo: utiliza la nota existente o el texto “Retraso priorizado”. Esta limitación se detalla en las observaciones.

### 8.4 Consultar y modificar registros

1. Presione **Ver registros**.
2. Use la búsqueda y el selector Recepción/Despacho.
3. Revise empresa, patente, conductor, estado, andén y última actualización.
4. Con rol `admin` o `superadmin`, presione **Modificar** para abrir el formulario del camión.
5. Edite cliente, RUT, patente, conductor, dock, tipo de dock, ingreso, tipo de carga, hora agendada o notas.
6. Presione **Guardar**.

### 8.5 Crear o eliminar un camión como administrador

- Para crear, presione **+ Nuevo camión**, complete los campos obligatorios y presione **Crear**.
- Para eliminar, use **Eliminar** en la tarjeta y confirme **“Eliminar camión? Esta acción no se puede deshacer.”**

La eliminación es permanente y está autorizada únicamente para `admin` y `superadmin` por las reglas de la base de datos.

## 9. Control de Calidad

Pueden registrar controles los roles `recepcion`, `operaciones`, `calidad`, `admin` y `superadmin`. `gerencia` dispone de consulta de sólo lectura.

### 9.1 Buscar un camión

1. Seleccione **Todos**, **Recepción** o **Despacho**.
2. Escriba cliente, patente, conductor o andén en la búsqueda.
3. Use **Estado**: Activos, Todos, En curso, Recepcionado, Almacenado, Cerrado o Terminado.
4. Use **Operación**: Todas, Carga, Descarga o Mixto.

Los indicadores muestran camiones visibles, en curso, con registro, defectuosos y pendientes.

### 9.2 Registrar un control

1. En la tarjeta del camión, presione **Registrar calidad**.
2. Seleccione **Operación**: Descarga o Carga. La fase se ajusta automáticamente, pero puede cambiarla.
3. Seleccione **Fase**: Ingreso o Salida.
4. En **Estado**, elija Bueno, Observado o Defectuoso.
5. Si el estado no es Bueno, seleccione la **Decisión cliente**: Pendiente, Acepta o Rechaza.
6. Elija **Tipo de producto**: Congelado, Refrigerado o Ambiente.
7. Ingrese la **Temperatura (°C)**. La pantalla indicará Dentro de rango o Fuera de rango.
8. Complete **Materia prima / producto**, **Cantidad**, **Recibido por** y **Observaciones**.
9. En **Evidencia / archivos**, presione **Subir archivos**. Puede seleccionar varios.
10. Firme dentro de **Firma del receptor** con mouse o dedo. Use **Limpiar firma** para repetirla.
11. Presione **Guardar registro**.

Los campos de evidencia y firma son opcionales técnicamente. Como práctica operativa, complételos cuando el procedimiento interno lo exija.

**Archivos permitidos por el almacenamiento:** imágenes o PDF, de menos de 10 MB por archivo. Si se elige otro tipo, la aplicación puede mostrar sólo el error genérico de guardado.

### 9.3 Consultar e imprimir controles

1. Abra **Historial de calidad** en la tarjeta.
2. Revise condición, decisión, temperatura, receptor, producto, cantidad, notas y archivos.
3. Presione **Ver informe**.
4. En la vista del informe, presione **Imprimir / Descargar PDF**.
5. En el cuadro de impresión del navegador, elija una impresora o **Guardar como PDF**.

Los controles guardados son acumulativos. La versión actual no permite editarlos ni eliminarlos desde la interfaz.

## 10. Directorio de clientes

La pantalla **Directorio de empresas y contactos** muestra razón social, nombre de empresa y correo de contacto.

### 10.1 Consultar y buscar

1. Use **Buscar por razón social, nombre o correo**.
2. Revise la tabla **Empresas activas**.

El rol `clientes` debe considerarse de consulta: aunque la pantalla muestra botones de escritura, las reglas actuales de Firebase rechazan crear, editar o eliminar con ese rol.

### 10.2 Crear un cliente

Con `operaciones`, `admin` o `superadmin`:

1. Complete **Razón social** y **Nombre de la empresa**.
2. Opcionalmente escriba **Correo de contacto**.
3. Presione **Crear**.

### 10.3 Editar un cliente

1. Presione **Editar** en la fila.
2. Modifique los campos en la parte superior.
3. Presione **Actualizar**.
4. Para abandonar los cambios, presione **Cancelar edición**.

### 10.4 Eliminar un cliente

Presione **Eliminar** en la fila. Actualmente no se solicita una segunda confirmación; la eliminación se ejecuta inmediatamente si el rol tiene permiso. Verifique la razón social antes de presionar.

## 11. Reportes de Gerencia

Disponible para `gerencia`, `admin` y `superadmin`.

### 11.1 Verificar el origen de los datos

Revise el aviso bajo **Métricas**:

- Si aparece **Datos demo activos** y **“Mostrando datos demo para la reunión”**, los valores no provienen de la operación real.
- Si existe información real, puede activar o desactivar la demostración con el mismo botón.
- Si no existen registros reales, la pantalla activa datos demo automáticamente.

No entregue ni exporte un informe oficial mientras el modo demo esté activo.

### 11.2 Métricas y filtros

1. Elija **Día** o **Últimos 7 días**.
2. En **Tipo de reporte**, seleccione Cliente, Día o Bitácora.
3. Para Bitácora, seleccione **Con bitácora** o **Sin bitácora**.
4. En **Buscar**, ingrese cliente, patente o conductor.
5. En **Andén**, escriba un número exacto.
6. En **Día**, use el calendario.

La pantalla calcula total, en curso, finalizados, retrasos y promedio de espera. También presenta gráficos de flujo por cliente, distribución de estados y espera promedio por andén.

### 11.3 Reportes personalizados

1. En **Periodo**, elija Día, Semana, Mes o Año.
2. En **Indicador**, seleccione:
   - Camiones por empresa.
   - Camiones en total.
   - Empresa con más camiones.
   - Empresa con mayor volumen.
3. Para **Camiones por empresa**, seleccione una **Empresa**.
4. Elija la **Fecha base**.
5. Revise **Resultado** y **Top empresas**.

El indicador de volumen usa kilos, pallets o cajas si esos campos existen en los registros. La interfaz operativa actual no ofrece campos para cargarlos; por ello, con datos normales puede usar el número de camiones como referencia.

### 11.4 Exportar un reporte

La vista previa incluye como máximo 50 filas.

1. Aplique todos los filtros.
2. Presione **Exportar**.
3. Elija:
   - **PDF:** abre la impresión del navegador; seleccione Guardar como PDF.
   - **Excel:** descarga un archivo `.xls` basado en una tabla HTML.
   - **Word:** descarga un archivo `.doc` basado en una tabla HTML.
4. Abra el archivo y verifique fecha, filtros y cantidad de filas antes de enviarlo.

### 11.5 Preparar un correo

1. Escriba el destinatario en **correo@empresa.com**.
2. Presione **Enviar por correo**.
3. La aplicación abrirá el programa de correo predeterminado con asunto y cuerpo preparados.
4. Revise el contenido y presione **Enviar** en ese programa.

La plataforma no envía el mensaje directamente ni adjunta automáticamente el PDF, Excel o Word.

## 12. Panel de Superadministración

Sólo el rol `superadmin` puede abrir el **Panel de Administración**.

### 12.1 Analítica operativa

La sección **Vista rápida de la instalación** se actualiza con los registros de camiones del sistema. Use **7 días**, **30 días**, **90 días** o **Todo** para cambiar el período analizado.

Los indicadores muestran:

- Ingresos del período y comparación con el período anterior cuando existe una base comparable.
- Ingresos de hoy y camiones que siguen activos.
- Tasa de finalización.
- Permanencia promedio de los registros que tienen hora de ingreso y término.
- Porcentaje de patentes completas y cantidad de registros que requieren revisión.

Los gráficos presentan **Volumen de ingreso**, las siete **Empresas con más ingresos**, **Recepción vs. despacho**, **Estado de la operación** e **Ingresos por hora**. Si un período no tiene información suficiente, el gráfico muestra un estado vacío en lugar de estimar datos.

### 12.2 Gestión de camiones

1. Use **Buscar cliente, patente, conductor o andén**.
2. Filtre por **Todas las áreas / Recepción / Despacho**.
3. Filtre por estado.
4. En cada fila puede:
   - Cambiar el estado desde la lista desplegable.
   - Presionar **Editar** para modificar los datos.
   - Presionar **Eliminar** y confirmar la eliminación permanente.

### 12.3 Accesos rápidos

Los botones implementados son **Tablero**, **Visor general**, **Reportes**, **Informes seguridad**, **Clientes** y **Calidad**. Todos conservan la sesión y abren módulos autorizados para Super Admin.

### 12.4 Cuentas de empleados

La sección **Gestión de cuentas de empleados** permite crear, editar, habilitar, deshabilitar y eliminar cuentas. La tabla muestra nombre, correo, rol, estado y último acceso; use **Actualizar lista** para volver a consultar la información.

Las operaciones se realizan mediante un servicio administrativo autenticado. La aplicación envía la sesión activa y el servicio comprueba que pertenezca a un Super Admin antes de modificar una cuenta. No abra la dirección del servicio directamente ni comparta credenciales.

## 13. Visor general, visor TV y monitor

### 13.1 Funciones de consulta

El visor muestra patente, empresa, fecha/hora de bitácora, fecha/hora de ingreso, estado, proceso, andén y tiempo transcurrido.

- Use **Todos / Recepción / Despacho** para filtrar.
- Use la búsqueda por cliente, patente, conductor, andén o notas.
- Presione **Ver histórico** para consultar una semana y seleccionar un día.
- Presione **Proyectar tablero** para ocupar el espacio de pantalla con la tabla; use **Salir proyección** para volver.
- Los camiones de días anteriores aún activos se mantienen arriba con prioridad.
- La tabla rota el orden de los camiones regulares cada cinco segundos para facilitar su visualización.

El monitor separado muestra tableros de Recepción y Despacho por estado, totales finalizados, fuente de actualización e histórico semanal.

### 13.2 Finalizar camiones desde el visor

La función está disponible únicamente para una cuenta autenticada con permiso de finalización, como `visor`, `admin` o `superadmin`. El visor TV y el monitor iniciados con sesión anónima son estrictamente de sólo lectura: muestran datos operativos sanitizados y no presentan controles de selección ni finalización.

1. Presione **Finalizar camiones**.
2. Marque las casillas de los registros o presione **Seleccionar visibles** / **Seleccionar todos** según la pantalla.
3. Revise la cantidad en **Seleccionados**.
4. Presione **Finalizar seleccionados**.
5. Confirme la pregunta del navegador.

Esta acción cambia los camiones a **Terminado** y los retira de la lista activa. Úsela sólo cuando el proceso esté realmente concluido.

### 13.3 Diagnóstico del visor

Si el visor no recibe ningún camión, puede aparecer **Diagnóstico visor**. Presione **Ejecutar diagnóstico** para revisar conexión, configuración de Firebase, sesión, filtros y fuente de datos. No comparta capturas del diagnóstico fuera del equipo técnico, porque puede incluir identificadores de configuración y sesión.

## 14. Historial diario auxiliar

La ruta auxiliar de historial está disponible para algunos roles administrativos y de operaciones.

1. Seleccione **Día**.
2. Use **Hoy** para volver a la fecha actual o **Ver todos** para quitar la fecha.
3. Filtre por **Estado**.
4. Revise los totales y las tarjetas.

Los roles restringidos a una sola pantalla pueden ser redirigidos a su inicio al intentar abrir este historial.

## 15. Administración de usuarios y guardias

No existe una entidad separada llamada “guardia”. Un guardia que use Portería debe contar con una cuenta de rol `porteria`, creada por un Super Admin.

### 15.1 Crear una cuenta

1. Abra `/admin` y ubique **Gestión de cuentas de empleados**.
2. Complete **Nombre**, **Correo**, **Rol** y **Contraseña temporal**.
3. Use una contraseña de 8 a 128 caracteres y entréguela por un canal autorizado.
4. Presione **Crear cuenta** y espere el mensaje de confirmación.
5. Presione **Actualizar lista** si la nueva fila no aparece de inmediato.

### 15.2 Editar, cambiar acceso o eliminar

- Presione **Editar** para cambiar nombre, correo o rol. La nueva contraseña es opcional; déjela vacía para conservar la actual.
- Presione **Deshabilitar** para impedir temporalmente el inicio de sesión; use **Habilitar** para restablecer el acceso.
- Presione **Eliminar** y confirme sólo cuando la cuenta deba borrarse de forma permanente.
- La cuenta Super Admin que está en uso no puede quitarse su propio rol, deshabilitarse ni eliminarse desde esta pantalla.

Todas estas acciones requieren una sesión Super Admin activa. Nunca envíe contraseñas por canales abiertos ni reutilice claves entre personas.

## 16. Mensajes frecuentes y solución

| Mensaje o situación | Qué significa | Qué hacer |
|---|---|---|
| No pudimos iniciar sesión | Correo/clave incorrectos o cuenta no disponible. | Reescriba las credenciales o use Olvidé contraseña. |
| Cargando sesión / Cargando rol | La aplicación espera autenticación o perfil. | Espere unos segundos; si no avanza, recargue e ingrese de nuevo. |
| No tienes acceso a este módulo | El rol no está autorizado para esa pantalla. | Vuelva a su pantalla inicial y solicite revisión del rol. |
| No se pudieron cargar los camiones (permisos o red) | Falló Firebase, la red o el permiso. | Compruebe Internet, vuelva a iniciar sesión y reporte si persiste. |
| No se pudo actualizar el estado | La escritura fue rechazada o se perdió conexión. | No repita varias veces; confirme el estado actual y reintente una vez. |
| Completa patente, conductor y RUT | Faltan datos de Portería. | Presione Completar datos y guarde los tres campos. |
| Selecciona un andén y operación | Se intentó pasar a En curso sin asignación. | Elija A-1 a A-9 y Carga/Descarga; presione Asignar. |
| Andén ocupado por… | Otro camión En curso usa ese andén. | Seleccione otro andén o cierre el proceso anterior. |
| No se pudo subir la foto de la guía | Archivo, conexión o permisos de Storage. | Use una imagen menor de 10 MB y reintente con buena conexión. |
| No se pudo guardar el registro de calidad | Error de permisos, red o archivo no permitido. | Quite archivos incompatibles; use imágenes/PDF menores de 10 MB. |
| No se pudo abrir la ventana de impresión | El navegador bloqueó ventanas emergentes. | Autorice ventanas emergentes para el sitio y exporte de nuevo. |
| Iniciando visor no avanza | Acceso anónimo o dominio no configurado. | Presione Reintentar acceso y contacte al administrador técnico. |
| Mostrando datos demo para la reunión | No está viendo datos operativos reales. | No exporte; solicite revisión de conexión/datos. |
| La sesión no está disponible / Falta autenticación | La sesión administrativa expiró o no se pudo validar. | Salga, vuelva a iniciar sesión como Super Admin y reintente desde el panel. |
| Ya existe una cuenta con ese correo | El correo ya está registrado. | Edite la cuenta existente o use otro correo autorizado. |
| Firebase rechazó los datos de la cuenta | Algún dato no cumple las reglas de la cuenta. | Revise nombre, correo, rol y longitud de la contraseña; luego reintente una vez. |

## 17. Observaciones y funcionalidades pendientes

Las siguientes condiciones afectan el uso y no deben confundirse con funciones terminadas:

1. Los controles de calidad no se pueden editar ni eliminar desde la interfaz.
2. La pantalla de clientes muestra acciones de escritura al rol `clientes`, pero Firebase las rechaza; para ese rol es sólo consulta.
3. Algunos botones de retorno o historial pueden redirigir a la pantalla inicial por las restricciones del rol.
4. El reporte de gerencia puede mostrar datos demo automáticamente si no hay registros reales.
5. Algunas fechas de Comercial y Gerencia pueden desplazarse un día en la zona horaria de Chile; confirme siempre la fecha visible.
6. Algunos registros históricos sin una marca de ingreso completa pueden mostrar `--` o no participar en el cálculo de permanencia promedio.
7. La salida y horas totales del reporte se calculan usando la última actualización, no necesariamente el cierre real.
8. Existen encabezados con caracteres dañados en la vista previa de gerencia.
9. **Marcar retraso** no solicita un motivo nuevo.
10. La eliminación de un cliente no solicita confirmación.
11. La foto de guía existente se puede consultar, pero no hay un botón explícito para reemplazarla.
12. El correo de reportes abre el cliente de correo local; no envía desde el servidor.
13. No existe un canal de soporte integrado en la aplicación.

## 18. Recomendaciones de uso y seguridad

1. Use una cuenta individual; no comparta credenciales entre turnos.
2. Presione **Salir** al terminar, especialmente en computadores compartidos.
3. No envíe contraseñas, RUT completos ni capturas con datos personales por canales no autorizados.
4. Revise patente, empresa, operación y andén antes de cambiar a En curso.
5. No asigne un andén ocupado. Para camiones extra, compruébelo manualmente.
6. Antes de eliminar, confirme que el registro sea el correcto. Las eliminaciones no tienen papelera.
7. Antes de finalizar en el visor, revise la cantidad seleccionada.
8. No exporte reportes con **Datos demo activos**.
9. Guarde evidencias de calidad legibles y menores de 10 MB.
10. Si una acción muestra error, verifique el resultado antes de repetirla para evitar duplicados.
11. Mantenga actualizado el navegador. Para televisores antiguos, use el modo compatible configurado por soporte.

## 19. Reporte de errores y entrega de feedback

La aplicación no define un correo o formulario de soporte. Use el canal oficial acordado por Friosan con el proveedor o informe al administrador interno responsable.

Incluya siempre:

1. Fecha y hora del problema.
2. Rol utilizado, sin indicar la contraseña.
3. Pantalla o ruta: por ejemplo, Portería, Calidad o Reportes de gerencia.
4. Patente o identificador mínimo del registro; evite compartir RUT si no es necesario.
5. Pasos exactos realizados.
6. Resultado esperado y resultado obtenido.
7. Texto completo del mensaje de error.
8. Captura de pantalla con datos sensibles ocultos.
9. Navegador, equipo y estado de la conexión.

Clasifique el reporte como:

- **Crítico:** impide el ingreso o toda la operación.
- **Alto:** impide registrar o avanzar camiones.
- **Medio:** afecta un reporte o una función alternativa.
- **Bajo:** problema visual, texto o sugerencia.

## 20. Preguntas frecuentes

### ¿Por qué debo iniciar sesión después de actualizar la página?

Porque la sesión se guarda sólo en memoria. Es el comportamiento configurado en la versión revisada.

### ¿Por qué un camión agendado no tiene patente ni conductor?

Comercial agenda sólo el cliente y la hora. Portería completa los datos cuando el camión llega.

### ¿Puedo usar el mismo andén para dos camiones?

No mientras ambos estén En curso. La asignación desde la bitácora lo impide; en el alta de camión extra debe comprobarlo manualmente.

### ¿Qué diferencia hay entre Cerrado y Terminado?

Cerrado corresponde al cierre operativo. Terminado retira el registro de las vistas activas del visor y puede aplicarse en lote.

### ¿Puedo corregir un control de calidad?

No desde la interfaz actual. Registre un nuevo control aclaratorio y reporte el anterior al administrador.

### ¿El botón Enviar por correo manda el reporte automáticamente?

No. Abre el programa de correo del equipo; el usuario debe revisar y enviar.

### ¿Por qué veo datos que no reconozco en Gerencia?

Compruebe si aparece **Datos demo activos**. Si aparece, son datos de demostración.

### ¿Por qué el rol clientes no puede guardar cambios?

Las reglas de Firebase lo permiten sólo como lector, aunque la pantalla aún muestre controles de edición.

### ¿Se puede recuperar un camión o cliente eliminado?

No desde la aplicación. No existe papelera ni función de restauración.

### ¿Dónde se crean los usuarios de Portería o guardias?

En **Panel Admin → Gestión de cuentas de empleados**. El Super Admin debe crear la cuenta con rol `porteria`, asignar una contraseña temporal y entregarla por un canal autorizado.

### ¿Dónde está la guía rápida para una presentación?

Consulte [Guia_Rapida.md](Guia_Rapida.md).

## 21. Capturas recomendadas

El inventario profesional de imágenes, su ubicación dentro de este manual y el estado que debe preparar antes de capturar está en [Capturas_Recomendadas.md](Capturas_Recomendadas.md). Los archivos deben guardarse en `docs/imagenes` y ocultar credenciales, RUT y datos personales reales.
