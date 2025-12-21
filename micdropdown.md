MANUAL DE USUARIO – PLATAFORMA OPERATIVA FRIOSAN LOGÍSTICA
Versión 1.0   |   Última actualización: 11-12-2025
Aplicación web para gestión integral de camiones en planta (recepción y despacho) con autenticación por roles y datos en tiempo real (Firebase/Firestore, despliegue Vercel).

====================================================================
ÍNDICE
1. Alcance y público objetivo
2. Roles y permisos
3. Acceso y navegación general
4. Pantallas y flujos (por rol)
   4.1 Portería
   4.2 Recepción (TruckBoard)
   4.3 Comercial (panel y plantilla diaria)
   4.4 Operaciones (Monitor)
   4.5 Visor (pantalla pública)
   4.6 Gerencia (dashboard ejecutivo)
   4.7 Historial
5. Campos y estados del camión
6. Reglas de negocio clave
7. Mensajes y errores frecuentes
8. FAQ operativa
9. Buenas prácticas y seguridad
10. Glosario
11. Anexos (accesos rápidos y soporte)
====================================================================

1. ALCANCE Y PÚBLICO OBJETIVO
Manual operativo para todo el personal que usa la plataforma (portería, recepción, operaciones, comercial, gerencia, admin/superadmin y visor). Detalla flujos, pantallas, campos y mensajes para la operación diaria y capacitación.

2. ROLES Y PERMISOS
Portería: controla acceso; crea o recibe camiones en estado en_porteria; deriva a recepción.
Recepción: gestiona el flujo operativo hasta cierre (en_espera, en_curso, recepcionado, almacenado, cerrado/terminado); puede reabrir según permisos.
Operaciones: supervisa vistas de control (Monitor, Visor); solo lectura.
Comercial: consulta y edita métricas comerciales (pallets, cajas, kilos, valor, items); carga la plantilla de camiones agendados.
Gerencia: visualiza KPIs y agenda; solo lectura.
Visor: tablero público estilo split-flap; solo lectura.
Admin / Superadmin: acceso total (crear, editar, mover, eliminar) para soporte y contingencia.

3. ACCESO Y NAVEGACIÓN GENERAL
1) Ingresar a la URL productiva o Vercel.
2) Autenticarse con correo y contraseña asignados.
3) La aplicación redirige al inicio correspondiente al rol.
4) Si se pierde acceso, usar la opción de recuperación de contraseña o contactar soporte.

Rutas principales:
/porteria   (control de acceso)
/recepcion  (TruckBoard – flujo operativo)
/monitor    (Operaciones)
/comercial  (panel comercial y plantilla)
/gerencia   (dashboard ejecutivo)
/historial  (consulta histórica)
/visor      (tablero público)
/(inicio)   redirige según rol

4. PANTALLAS Y FLUJOS

4.1 Portería
Objetivo: registrar ingreso inicial y derivar a recepción.
Flujo: registrar camión (estado en_porteria), validar patente, conductor, cliente, tipo de dock (recepción o despacho) y número cuando aplique; derivar a recepción (en_espera o en_curso).
Uso: Portería; Admin/Superadmin.

4.2 Recepción (TruckBoard)
Objetivo: mover camiones por estados hasta el cierre.
Columnas: en_espera, en_curso, recepcionado, almacenado, cerrado, terminado.
Flujo sugerido: pasar de en_espera a en_curso cuando hay andén; marcar recepcionado al terminar descarga/carga; marcar almacenado y luego cerrado/terminado para finalizar; reabrir si el rol lo permite.
Acciones: mover a siguiente o previo estado, marcar retraso, reabrir, eliminar (solo admin).
Uso: Recepción; Admin/Superadmin. Operaciones/Portería pueden visualizar según permisos.

4.3 Comercial (panel y plantilla diaria)
Objetivo: visibilidad de mercadería y agendamiento de camiones.
Panel de mercadería: tarjetas por andén con estado, métricas (pallets, cajas, kilos, valor) e items; búsqueda por cliente, patente, andén o notas; edición de mercadería por camión.
Plantilla diaria: formulario para agendar camiones del día (cliente, patente, conductor, RUT opcional, tipo de dock recepción o despacho, fecha y hora agendada, tipo de carga, notas). Crea el camión en estado agendado. Selector de día y tabla de agendados (hora, patente, cliente, conductor, RUT, tipo de carga, estado y notas). Pensado para que Portería solo marque ingreso y avance el flujo.
Uso: Comercial; Admin/Superadmin (solo ellos deben editar o crear aquí).

4.4 Operaciones (Monitor)
Objetivo: supervisión rápida por dock y estado.
Vista: contadores y tarjetas por estado (portería, espera, curso, recepcionado, almacenado, cerrado).
Uso: Operaciones; Gerencia en modo lectura.

4.5 Visor (pantalla pública)
Objetivo: visualización estilo split-flap para sala o TV.
Tabla: Hora, Patente, Cliente, Andén, Tipo, Estado con indicador (LED), Observación.
Indicador: rojo para pendiente/portería/espera; ámbar para en_curso; verde para recepcionado/almacenado/cerrado/terminado.
En estados finalizados el Tipo muestra “/ LISTO”.
Uso: rol visor (solo lectura); otros roles pueden consultarlo si se permite.

4.6 Gerencia (dashboard)
Objetivo: KPIs ejecutivas.
Métricas: totales, en curso o espera, espera promedio, porcentaje de puntualidad vs agenda, agenda próxima, retrasos, línea de tiempo del día.
Uso: Gerencia; Admin/Superadmin (lectura).

4.7 Historial
Objetivo: consulta de movimientos pasados.
Filtros: estado, dock y rango de fechas.
Uso: Recepción, Operaciones, Gerencia, Admin/Superadmin (lectura).

5. CAMPOS Y ESTADOS DEL CAMIÓN
Cliente: nombre del cliente.
Patente: placa en mayúsculas.
Conductor y RUT (opcional).
Dock: tipo (recepción o despacho) y número (1 a 9) cuando aplica.
Tipo de carga: carga, descarga o mixto.
Tipo de entrada: conos o andén; en finalizados se muestra como “LISTO”.
Estado: agendado, en_camino, en_porteria, en_espera, en_curso, recepcionado, almacenado, cerrado, terminado.
Tiempos: check-in portería, check-in andén, inicio y fin de proceso, almacenado, cerrado, última actualización.
Métricas comerciales: pallets, cajas, kilos, valor, items.
Notas o retraso: texto libre; se usa para DELAY en el visor.

6. REGLAS DE NEGOCIO CLAVE
Flujo estándar: en_porteria → en_espera → en_curso → recepcionado → almacenado → cerrado o terminado.
Check-in portería se fija al crear en en_porteria.
Check-in andén e inicio de proceso se fijan al pasar a en_espera o en_curso.
El visor prioriza camiones activos; si no hay, muestra recientes.
Comercial edita métricas sin cambiar el estado operativo.
Eliminar es irreversible (solo admin/superadmin).
La plantilla comercial crea camiones en agendado para que Portería o Recepción los avance.

7. MENSAJES Y ERRORES FRECUENTES
“No se pudieron cargar los camiones (permisos o red)”: revisar conexión o permisos en Firestore.
“Sin datos en visor”: no hay camiones activos o la colección trucks está vacía.
Login fallido: credenciales incorrectas o rol sin configurar; contactar al administrador.
Guardado fallido en comercial: permisos o red; reintentar.
Fecha u hora inválida al agendar: revisar el formato de fecha y hora.

8. FAQ OPERATIVA
No puedo editar estados: el rol es de solo lectura (comercial, visor, gerencia) o está en modo vista.
Ver solo recepción o despacho en visor: usar los botones de filtro en /visor.
Marcar retraso: en TruckBoard, botón Marcar retraso (recepción o admin).
Reabrir viaje cerrado: con rol recepción o admin; usar Reabrir o Retroceder.
Agregar métricas de mercadería: en /comercial, opción Editar mercadería.
Por qué veo “/ LISTO” en Tipo: el estado está finalizado (recepcionado, almacenado, cerrado, terminado).
Cómo agendar para mañana: en /comercial, usar la plantilla diaria con la fecha y hora del día siguiente.

9. BUENAS PRÁCTICAS Y SEGURIDAD
Mantener roles y correos actualizados; no compartir credenciales.
Revisar estados antes de cerrar un viaje; el cierre es final.
Usar notas claras en retrasos y observaciones.
En sala o TV, usar /visor en pantalla completa y con buen contraste.
Respetar respaldos y políticas de TI sobre Firestore.

10. GLOSARIO
Andén: punto físico de carga o descarga (1 a 9).
Entrada Conos: acceso sin asignación inmediata de andén.
Recepcionado: proceso de carga o descarga completado.
Almacenado: mercancía ubicada; viaje en cierre.
Cerrado o Terminado: viaje concluido.
DELAY: retraso mayor a 30 minutos desde check-in.
Indicador de estado (visor): punto de color según avance (rojo, ámbar, verde).

11. ANEXOS
Accesos rápidos: /porteria, /recepcion, /comercial, /gerencia, /visor, /monitor, /historial.
Uso en sala o TV (visor): abrir /visor en pantalla completa; filtrar por recepción o despacho según turno; ajustar brillo y contraste.
Contacto y soporte: operación diaria con Responsable de Operaciones; accesos y roles con el Administrador de la plataforma; infraestructura y despliegue con el equipo DevOps (Vercel y Firebase).

Documento elaborado por el equipo de Redacción Técnica y Análisis Funcional. Versionado en repositorio para exportación a PDF.
