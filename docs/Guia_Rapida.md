# Guía Rápida — Plataforma Logística Friosan

**Versión 1.1 · 1 de agosto de 2026 · Resumen para capacitación y presentación**

> Diseñada para imprimirse en un máximo de dos páginas. Para detalles, consulte [Manual_Usuario.md](Manual_Usuario.md).

## Página 1 — Operación diaria

### 1. Ingresar y salir

1. Escriba su correo en **Usuario (correo)**.
2. Escriba su clave en **Contraseña** y presione **Iniciar sesión**.
3. La plataforma abre automáticamente la pantalla de su rol.
4. Para terminar, presione **Salir** en la barra superior.

Si olvidó la clave, escriba primero su correo y presione **Olvidé contraseña**. Al actualizar la página puede ser necesario iniciar sesión otra vez.

### 2. Flujo que debe recordar

`Agendado → En portería → En espera → En curso → Recepcionado → Almacenado → Cerrado → Terminado`

- **Comercial** agenda.
- **Portería** recibe, completa datos, sube la guía y asigna andén.
- **Recepción** avanza el proceso.
- **Calidad** registra condición, temperatura y evidencias.
- **Gerencia** consulta y exporta.
- **Visor/monitor** muestra el flujo; una cuenta autenticada con permiso puede finalizar camiones. Las pantallas públicas anónimas son de sólo lectura.

### 3. Comercial: agendar

1. En **Plantilla diaria**, complete **Cliente** y **Fecha y hora agendada**.
2. Elija **Con bitácora**, Tipo carga y notas.
3. Presione **Agregar a plantilla**.
4. Confirme que el registro aparece en el **Día a mostrar** correcto.

El registro queda **Agendado**. Patente y conductor se completan cuando llega.

### 4. Portería: recibir un agendado

1. Busque el camión en **Bitácora de ingresos**.
2. Presione **Completar datos** o **Editar datos**.
3. Ingrese patente, conductor y RUT; presione **Guardar datos**.
4. Presione **Subir foto guía** si corresponde.
5. En **Estado**, seleccione En portería o En espera.
6. Para comenzar, seleccione **En curso**.
7. Elija andén `A-1` a `A-9` y Carga/Descarga; presione **Asignar**.

Si dice **Andén ocupado**, elija otro. Para un camión no previsto, presione **Ingresar camión extra**, complete los datos y use **Guardar ingreso**.

### 5. Recepción: avanzar el camión

1. Elija **Recepción** o **Despacho**.
2. Busque por cliente, patente, conductor o andén.
3. Use la acción de la tarjeta:
   - **Mover a en curso**.
   - **Marcar recepcionado**.
   - **Marcar almacenado**.
   - **Cerrar viaje**.
4. Verifique que la tarjeta cambió de columna.

Use **Ver registros** para consultar la tabla. `admin` y `superadmin` pueden presionar **Modificar**, **+ Nuevo camión** o **Eliminar**. Al retroceder un estado, el andén se reinicia y debe revisarse.

<div style="page-break-after: always;"></div>

## Página 2 — Calidad, reportes y presentación

### 6. Calidad: registrar e imprimir

1. Presione **Vista calidad** o abra el módulo Calidad.
2. Filtre por Recepción/Despacho, estado u operación.
3. En el camión, presione **Registrar calidad**.
4. Complete Operación, Fase, Estado, Decisión cliente, producto, temperatura, cantidad, receptor y observaciones.
5. En **Subir archivos**, use imágenes o PDF menores de 10 MB.
6. Registre la firma y presione **Guardar registro**.
7. Abra **Historial de calidad** → **Ver informe** → **Imprimir / Descargar PDF**.

Los controles guardados no se pueden editar ni eliminar desde la aplicación.

### 7. Gerencia: filtrar y exportar

1. Compruebe que NO aparezca **Datos demo activos** antes de emitir un informe real.
2. Elija Día o Últimos 7 días.
3. Seleccione Cliente, Día o Bitácora.
4. Aplique búsqueda, andén y fecha.
5. Revise métricas, gráficos y vista previa.
6. Presione **Exportar** y elija PDF, Excel o Word.

**Enviar por correo** abre el programa de correo local; el usuario aún debe revisar y enviar. La vista previa/exportación contiene hasta 50 filas.

### 8. Clientes

- Busque por razón social, empresa o correo.
- `operaciones`, `admin` y `superadmin` pueden **Crear**, **Editar** y **Eliminar**.
- **Eliminar** no pide confirmación: revise la fila antes de presionar.
- El rol `clientes` es de consulta efectiva, aunque vea botones de escritura.

### 9. Super Admin: analítica y cuentas

- En **Vista rápida de la instalación**, cambie entre 7, 30, 90 días o Todo y revise ingresos, activos, finalización, permanencia y patentes completas.
- Use los gráficos para identificar volumen por período, empresas con más ingresos, distribución Recepción/Despacho, estados y horas de mayor demanda.
- En **Gestión de cuentas de empleados**, cree cuentas con nombre, correo, rol y contraseña temporal de al menos 8 caracteres.
- Use **Editar**, **Habilitar/Deshabilitar** o **Eliminar** según corresponda. La cuenta en uso no puede deshabilitarse ni eliminarse a sí misma.

### 10. Visor y TV

- Desde el ingreso, presione **Abrir visor TV**.
- Use Todos/Recepción/Despacho, búsqueda, **Ver histórico** y **Proyectar tablero**.
- Con una cuenta `visor`, `admin` o `superadmin`, para finalizar: **Finalizar camiones** → seleccione registros → **Finalizar seleccionados** → confirme.

Finalizar cambia el estado a **Terminado** y quita el camión de la vista activa.

### 11. Si aparece un error

| Situación | Acción rápida |
|---|---|
| Error de credenciales | Reescriba correo/clave o recupere la contraseña. |
| Error de permisos o red | Compruebe Internet, vuelva a iniciar sesión y reintente una vez. |
| Falta patente/conductor/RUT | Vuelva a Portería y use Completar datos. |
| Andén ocupado | Seleccione otro andén. |
| Archivo de calidad rechazado | Use imagen/PDF menor de 10 MB. |
| Visor no inicia | Presione Reintentar acceso y contacte soporte. |
| Cuenta no carga o falta autenticación | Salga, vuelva a iniciar sesión como Super Admin y actualice la lista. |

### 12. Checklist antes de una presentación

- Inicie sesión con cada rol que se mostrará.
- Use registros de prueba sin datos personales reales.
- Verifique conexión y fecha/hora del equipo.
- Confirme que Gerencia indique datos reales o explique claramente el modo demo.
- Prepare datos ficticios suficientes para que la analítica de Super Admin muestre tendencias y no revele información real.
- Prepare un camión en cada etapa principal.
- Autorice ventanas emergentes si demostrará PDF.
- Pruebe **Pantalla completa** y **Proyectar tablero**.
- No elimine registros ni finalice camiones reales durante la demostración.

### 13. Reportar un problema

Informe por el canal oficial definido por Friosan/proveedor: fecha y hora, rol, pantalla, patente mínima, pasos, resultado esperado/real, mensaje de error y captura con datos sensibles ocultos. Nunca envíe la contraseña.
