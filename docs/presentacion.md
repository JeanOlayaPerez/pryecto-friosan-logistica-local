# Friosan Logística · Tablero de Camiones (Demo local)
Versión: DEMO local con datos en `localStorage` (sin backend). Lista para producción conectando Firebase u otra API.

---
## 1. Propuesta de valor
- **Control total de andenes (1-9)** con estado visible (libre/ocupado) y semáforos por columna (espera/curso/terminado).
- **Priorización de retrasos** (temperatura, documentación, inspección, prioridad de carga) y botones de acción rápidos.
- **Roles claros**: Operaciones/Admin (accionan), Comercial (solo lectura), modo “solo vista” para demo/TV.
- **UI responsiva y animada**: funciona en TV, desktop, tablet, móvil. Fondo logístico y tarjetas con semáforo.
- **Listo para terreno**: datos locales para demo; estructura preparada para conectar Auth + Firestore (SDK modular v9).

---
## 2. Flujo funcional (con ejemplo real)
1) **Login** (demo):  
   - operaciones@friosan.com / comercial@friosan.com / admin@friosan.com — clave `demo123`.
2) **Tab principal**  
   - Tabs: Recepción / Despacho.  
   - Columnas: En espera / En curso / Terminados (semáforo).  
   - Buscador: cliente, patente, conductor, número de andén.
3) **Acciones (ops/admin)**  
   - Mover: Espera → En curso → Terminado; reabrir Terminado → En curso; devolver a Espera.  
   - Marcar retraso: añade motivo y destaca en panel de retrasos.  
   - Crear/editar camión; Reset datos locales (repuebla las semillas demo).
4) **Andenes**  
   - Tarjetas 1–9 con rojo/verde; muestra cuántos en espera por andén.
5) **Retrasos**  
   - Lista priorizada con motivo y tiempo en espera.
6) **Historial del día**  
   - Ingresos ordenados por hora (solo jornada actual).
7) **Monitor (/monitor)**  
   - Vista TV, solo lectura, contadores grandes y semáforo.

---
## 3. Datos de ejemplo cargados (8 camiones)
- **En espera (4)**  
  - Agrosuper · ABCJ45 · Andén 3 · “Pérdida de temperatura en ingreso”  
  - Guayarauco · PTZL11 · Andén 7 · “Falta de documentación de exportación”  
  - Polar Foods · MNTC33 · Andén 6 · “Retraso por inspección sanitaria”  
  - Rich Products · GHJK12 · Andén 9 · “Esperando turno prioritario”
- **En curso (2)**  
  - Friosur · BHFZ21 · Andén 5 · “Control de calidad en proceso”  
  - FrioTruck · XQRT22 · Andén 4 · “Carga de pallets mixtos”
- **Terminados (2)**  
  - RetailMax · DKLM98 · Andén 1 · “Descarga completa saludable”  
  - Andes Cargo · RBLK77 · Andén 8 · “Despacho completado”
- Persistencia: `localStorage` (clave `friosan-trucks-v2`). Botón “Reset datos locales” repuebla estas semillas.

---
## 4. Roles y permisos
- **Operaciones**: crear/editar, mover estados, marcar retraso, reset local.
- **Admin**: todo lo anterior.
- **Comercial**: solo lectura (sin botones de acción).  
- **Modo solo vista**: conmutador para desactivar acciones aunque seas ops/admin (útil en demo o TV).
- Futuro (Firebase): roles desde colección `users` (`role`: operaciones/comercial/admin) + reglas Firestore (lectura auth; escritura solo operaciones/admin).

---
## 5. UI/UX y responsividad
- Tema oscuro con gradiente y convoy animado de camiones; semáforos por estado y andén.
- Tarjetas con ETA estimada, tiempos de espera/proceso, notas y botones contextuales.
- Grillas fluidas:  
  - Badges superiores en 2–4 columnas según ancho.  
  - Panel central 3 columnas (apila en tablet/móvil).  
  - Andenes y retrasos en grilla adaptable.  
  - Tipografía clamped para legibilidad en TV y móvil.
- Animaciones: Framer Motion en tarjetas, contenedores y hover (micro-elevación).

---
## 6. Stack técnico
- React 18 + Vite + TypeScript.
- Tailwind CSS (tema extendido y utilidades).
- React Router (SPA) + `vercel.json` para rewrite a `index.html`.
- Framer Motion (animaciones).
- LocalStorage para demo; `src/shared/config/firebase.ts` listo para conectar Auth/Firestore modular v9.

---
## 7. Despliegue en Vercel (SPA)
- Build: `npm run build` · Output: `dist` · Framework: Vite.  
- `vercel.json` ya incluye rewrite `/(.*) -> /index.html`.  
- Pasos rápidos:  
  1) `git init && git add . && git commit -m "chore: friosan demo local"`  
  2) Subir a GitHub/GitLab.  
  3) Importar repo en Vercel → seleccionar Vite → build/output por defecto.  
  4) Sin variables de entorno en demo (si luego hay Firebase, se añaden `VITE_FIREBASE_*`).  
- Rutas a probar: `/login`, `/`, `/monitor`. Si ves pocos camiones: botón “Reset datos locales”.

---
## 8. Operación diaria (ejemplo)
- 08:00 Ingresan 4 camiones a Recepción (Agrosuper, Polar Foods, Rich Products, Friosur).  
- 08:15 Semáforo muestra 4 en espera; dos con alerta de retraso por temperatura/inspección.  
- 08:20 Operaciones marca retraso en Agrosuper y pasa Friosur a “En curso”.  
- 09:00 RetailMax termina, libera andén 1; Andes Cargo en despacho finaliza a las 09:10.  
- Monitor en TV muestra ocupación de andenes (rojo/verde) y contadores grandes.

---
## 9. Roadmap a producción
- Conectar Firebase (Auth + Firestore) con reglas por rol.
- Historizar KPI: tiempos promedio por estado/andén, SLA, exportables CSV.
- Alertas push/email para retrasos críticos.
- Integración QR/escáner en gate y sello fotográfico de carga.
- Branding Friosan definitivo (logo, paleta, tipografía corporativa).

---
## 10. CTA
- **Aprobación** para conectar backend y definir reglas de seguridad.  
- **Validación de branding** (logo/paleta Friosan).  
- **Piloto** 1 semana con datos reales: medir tiempos y ajustar flujo.
