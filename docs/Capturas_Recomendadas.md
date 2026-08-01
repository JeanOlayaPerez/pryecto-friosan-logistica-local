# Capturas Recomendadas para el Manual

**Carpeta de destino:** `docs/imagenes`
**Formato recomendado:** PNG, 1600 × 900 px o superior, sin credenciales ni datos personales reales.

## 1. Criterios de preparación

1. Use cuentas de demostración con el rol indicado.
2. Prepare registros ficticios claramente identificados como prueba.
3. Oculte correo, contraseña, RUT, firmas y documentos reales.
4. Capture la pantalla completa y luego recorte sólo si mejora la lectura.
5. Mantenga el mismo zoom del navegador, idealmente 100 %.
6. No muestre **Datos demo activos** en una captura que se presente como reporte real. Si se documenta ese modo, el aviso debe verse completo.
7. Para acciones destructivas, capture el cuadro de confirmación sin ejecutarlas sobre datos reales.

## 2. Inventario de capturas

| Archivo sugerido | Pantalla y estado a preparar | Rol | Ubicación en `Manual_Usuario.md` |
|---|---|---|---|
| `01_inicio_sesion.png` | Formulario con correo y contraseña vacíos, botones Ver, Olvidé contraseña, Iniciar sesión y Abrir visor TV. | Sin sesión | Sección 3.1 |
| `02_cabecera_comun.png` | Barra superior con rol, Pantalla completa y Salir. | Cualquier cuenta interna | Sección 5.1 |
| `03_comercial_plantilla.png` | Panel comercial con formulario y varios camiones agendados en el día. | Comercial | Secciones 6.1–6.2 |
| `04_porteria_bitacora.png` | Tabla de bitácora con un agendado que aún no tiene datos del conductor. | Portería | Sección 7.1, pasos 1–4 |
| `05_porteria_guia.png` | Fila con botones Completar/Editar datos y Subir/Ver foto guía. | Portería | Sección 7.1, paso 5 |
| `06_porteria_asignar_anden.png` | Panel “Selecciona andén y operación” abierto al elegir En curso. | Portería | Sección 7.1, pasos 7–9 |
| `07_porteria_camion_extra.png` | Formulario Camión no previsto con Conos/Andén y Foto de la guía. | Portería | Sección 7.2 |
| `08_panel_operaciones.png` | Panel principal con selector Recepción/Despacho, KPIs, retrasos, andenes y columnas de estado. | Recepción | Sección 8.1 |
| `09_acciones_recepcion.png` | Tarjeta En curso o Recepcionado mostrando acciones de avance. | Recepción | Sección 8.2 |
| `10_tabla_registros.png` | **Ver registros** abierto; para documentación, use datos ficticios. | Admin | Sección 8.4 |
| `11_formulario_camion_admin.png` | Modal Nuevo camión o Editar camión. | Admin/Superadmin | Secciones 8.4–8.5 |
| `12_calidad_filtros.png` | Cabecera de Calidad, indicadores y filtros. | Calidad | Sección 9.1 |
| `13_calidad_formulario.png` | Formulario abierto con temperatura y señal Dentro/Fuera de rango. | Calidad | Sección 9.2, pasos 1–8 |
| `14_calidad_evidencia_firma.png` | Archivos seleccionados y firma ficticia. | Calidad | Sección 9.2, pasos 9–11 |
| `15_informe_calidad.png` | Vista imprimible de un control ficticio. | Calidad/Gerencia | Sección 9.3 |
| `16_directorio_clientes.png` | Formulario y tabla del directorio. | Operaciones/Admin | Sección 10 |
| `17_gerencia_metricas.png` | Métricas, tipos de reporte y filtros con datos reales o prueba controlada. | Gerencia | Secciones 11.1–11.2 |
| `18_gerencia_personalizado.png` | Periodo, indicador, empresa, fecha base, resultado y Top empresas. | Gerencia | Sección 11.3 |
| `19_gerencia_exportar.png` | Vista previa y menú Exportar abierto con PDF/Excel/Word. | Gerencia | Secciones 11.4–11.5 |
| `20_modo_demo.png` | Avisos Datos demo activos y Mostrando datos demo para la reunión. | Gerencia | Sección 11.1 y sección 17 |
| `21_superadmin_analitica.png` | Período de 30 días, seis indicadores y gráficos de volumen, empresas, áreas, estados y horas con datos ficticios coherentes. | Superadmin | Sección 12.1 |
| `22_superadmin_camiones.png` | Filtros y tabla de gestión de camiones con acciones Editar, Estado y Eliminar. | Superadmin | Sección 12.2 |
| `23_superadmin_cuentas.png` | Formulario Nueva cuenta y tabla con rol, estado, último acceso y acciones; cubra correos reales. | Superadmin | Secciones 12.4 y 15 |
| `24_visor_general.png` | Tablero con filtros, histórico y botón Proyectar tablero. | Visor | Sección 13.1 |
| `25_visor_finalizar.png` | Modo de selección abierto con seleccionados y Finalizar seleccionados; no confirmar sobre datos reales. | Visor | Sección 13.2 |
| `26_monitor.png` | Monitor con Recepción/Despacho, resumen, fuente e histórico semanal. | Visor/entorno configurado | Sección 13.1 |
| `27_diagnostico_visor.png` | Diagnóstico ejecutado con identificadores sensibles cubiertos. | Soporte técnico | Sección 13.3 |
| `28_historial_diario.png` | Calendario, filtros de estado, indicadores y tarjetas. | Admin/Operaciones | Sección 14 |
| `29_error_anden_ocupado.png` | Mensaje Andén ocupado por… usando registros ficticios. | Portería | Sección 16 |
| `30_error_permisos_red.png` | Mensaje genérico de carga/actualización, sin consola técnica. | Rol afectado | Sección 16 |

## 3. Capturas mínimas para una versión breve

Si el PDF debe ser corto, incluya como mínimo:

1. `01_inicio_sesion.png`.
2. `03_comercial_plantilla.png`.
3. `04_porteria_bitacora.png`.
4. `06_porteria_asignar_anden.png`.
5. `08_panel_operaciones.png`.
6. `13_calidad_formulario.png`.
7. `17_gerencia_metricas.png`.
8. `21_superadmin_analitica.png`.
9. `23_superadmin_cuentas.png`.
10. `24_visor_general.png`.

## 4. Validación antes de publicar

Revise cada captura a tamaño completo antes de incorporarla al manual. Confirme que los textos sean legibles, que las fechas y totales correspondan al escenario preparado y que no aparezcan correos, contraseñas, RUT, firmas, documentos ni otros datos reales.
