# Friosan Logística · Plataforma de operación de camiones

**Versión funcional con autenticación, datos en línea y panel de Super Administración**
**Actualización:** 1 de agosto de 2026

---

## 1. Propuesta de valor

- **Visibilidad del flujo completo:** agenda, portería, espera, proceso, recepción, almacenamiento, cierre y término.
- **Coordinación por rol:** cada equipo recibe la pantalla y las acciones que corresponden a su trabajo.
- **Datos compartidos en tiempo real:** los cambios operativos se almacenan en Firebase y se reflejan en las vistas conectadas.
- **Control de andenes y retrasos:** búsqueda, estados, ubicación y tiempos visibles en tableros operativos.
- **Supervisión ejecutiva:** reportes de Gerencia y analítica rápida para Super Admin.
- **Operación en distintos formatos:** escritorio, tablet, teléfono, monitor y visor TV.

---

## 2. Flujo operativo

`Agendado → En portería → En espera → En curso → Recepcionado → Almacenado → Cerrado → Terminado`

1. **Comercial** agenda el camión, la empresa, la fecha y el tipo de carga.
2. **Portería** confirma la llegada, completa patente, conductor y RUT, adjunta la guía y asigna conos o andén.
3. **Recepción** o **Despacho** avanza el proceso y controla su estado.
4. **Calidad** registra condición, temperatura, evidencias y firma.
5. **Gerencia** consulta indicadores, filtra información y exporta reportes.
6. **Visor/TV** presenta el estado de la operación; la pantalla pública es de sólo lectura y la finalización exige una cuenta autenticada con permiso.

Los camiones no previstos también pueden registrarse desde Portería, sin depender de una agenda previa.

---

## 3. Módulos disponibles

- **Comercial:** planificación diaria y consulta de mercadería.
- **Portería:** bitácora, datos de acceso, fotografía de guía y camiones extra.
- **Recepción/Despacho:** tablero, búsqueda, estados, andenes, retrasos y registros.
- **Calidad:** controles, archivos de evidencia, firma e informe imprimible.
- **Clientes:** directorio de empresas según los permisos del rol.
- **Gerencia:** métricas, reportes personalizados, vista previa y exportación a PDF, Excel o Word.
- **Historial:** consulta diaria por fecha y estado.
- **Visor, Visor TV y Monitor:** seguimiento visual para operación y pantallas compartidas.
- **Informes de seguridad:** bitácora protegida para Super Admin, con filtros, sincronización controlada y exportación CSV.

---

## 4. Super Administración

El rol `superadmin` dispone de un panel exclusivo con tres áreas principales:

### Analítica operativa

- Períodos de **7 días**, **30 días**, **90 días** o **Todo**.
- Ingresos del período, ingresos de hoy y camiones activos.
- Tasa de finalización y permanencia promedio cuando los registros tienen horas completas.
- Cobertura de patentes y cantidad de registros pendientes de revisión.
- Gráficos de volumen, empresas con más ingresos, Recepción vs. Despacho, estados e ingresos por hora.

### Gestión de camiones

- Búsqueda por empresa, patente, conductor o andén.
- Filtros por área y estado.
- Edición, cambio de estado y eliminación con confirmación.

### Gestión de cuentas

- Listado de empleados con rol, estado y último acceso.
- Creación y edición de nombre, correo, rol y contraseña.
- Habilitación o deshabilitación temporal del acceso.
- Eliminación permanente con confirmación.
- Protección de la cuenta en uso para impedir que se deshabilite o elimine a sí misma.

---

## 5. Roles y acceso

La plataforma reconoce los roles `porteria`, `recepcion`, `operaciones`, `calidad`, `comercial`, `gerencia`, `visor`, `clientes`, `admin` y `superadmin`.

- El inicio de sesión dirige a cada persona a su pantalla principal.
- Las rutas y acciones se restringen de acuerdo con el rol.
- La administración de cuentas sólo está disponible para Super Admin.
- Las operaciones sobre cuentas pasan por un servicio administrativo autenticado que valida la sesión antes de aplicar cambios.
- Las contraseñas nunca deben incorporarse a presentaciones, capturas ni archivos versionados.

---

## 6. Datos, reportes y modo demostración

- La operación normal usa Firebase Authentication, Firestore y Storage.
- Los tableros reciben actualizaciones conectadas a los registros del sistema.
- Gerencia dispone de un modo de demostración claramente identificado. Si aparece **Datos demo activos**, esa información no debe presentarse ni exportarse como operación real.
- Las vistas analíticas muestran estados vacíos cuando no existe información suficiente; no inventan valores.
- Antes de distribuir un reporte, se deben revisar el período, los filtros, la cantidad de filas y la presencia de datos personales.

---

## 7. Experiencia de uso

- Diseño adaptable a escritorio, tablet, teléfono y pantallas de proyección.
- Búsqueda por cliente, empresa, patente, conductor o andén según el módulo.
- Indicadores y gráficos con etiquetas visibles y estados sin datos.
- Modos de pantalla completa y proyección para monitores.
- Confirmaciones antes de acciones sensibles como finalizar o eliminar registros.

---

## 8. Escenario breve de demostración

1. Crear una agenda ficticia desde Comercial.
2. Completar patente y conductor en Portería y asignar un andén libre.
3. Avanzar el camión desde En espera hasta En curso en Recepción.
4. Registrar un control de Calidad con datos de prueba.
5. Mostrar el cambio en Visor o Monitor.
6. Abrir Gerencia para revisar filtros y exportación.
7. Entrar como Super Admin, cambiar el período analítico y comparar volumen, empresas y horas.
8. Mostrar la lista de cuentas sin revelar correos reales ni ejecutar eliminaciones.

---

## 9. Próximas mejoras sugeridas

- Alertas configurables para retrasos críticos.
- Integración con lectura QR o escáner en el acceso.
- Automatización de avisos y distribución de reportes.
- Métricas adicionales de nivel de servicio y ocupación por andén.
- Procedimientos de respaldo, recuperación y revisión periódica de accesos.

---

## 10. Checklist antes de presentar

- Usar cuentas y registros de prueba sin datos personales reales.
- Confirmar conexión, fecha y hora del equipo.
- Preparar camiones en distintas etapas para que los gráficos sean representativos.
- Verificar que Gerencia muestre datos reales o explicar de forma visible el modo demo.
- Probar las vistas móvil, TV y pantalla completa.
- No eliminar cuentas, clientes ni camiones reales durante la demostración.
- No mostrar contraseñas, RUT, firmas, guías ni correos privados.
