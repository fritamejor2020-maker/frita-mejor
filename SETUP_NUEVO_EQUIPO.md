# 🚀 Guía de Configuración e Inmunización Máster — Frita Mejor (Antigravity AI Agent Guide)

Este documento contiene el contexto completo, la arquitectura, credenciales, reglas del sistema y comandos para que **Antigravity AI Agent** pueda continuar el desarrollo de forma perfecta e inmediata en cualquier equipo nuevo o nueva sesión.

---

## 🔐 1. Usuarios y Contraseñas de Vendedores

El sistema maneja usuarios independientes para cada vendedor en `useAuthStore.js`:

| Vendedor | ID de Usuario | Contraseña | Vehículo Habitual | Rol |
|---|---|---|---|---|
| **Brandon** | `USR-005` | `0000` | `T2` | `VENDEDOR` |
| **Víctor** | `USR-010` | `7408` | `T4` | `VENDEDOR` |
| **Vendedor Móvil** | `USR-011` | `5` | `T1` | `VENDEDOR` |
| **Administrador** | `USR-001` | *(Admin)* | Todas las Sedes | `ADMIN` |

> [!IMPORTANT]
> **REGLA DE USUARIOS:** Cada vendedor debe iniciar sesión con su propia cuenta y contraseña individual. No compartir la cuenta genérica `USR-005` entre varios vendedores.

---

## 🎯 2. Instrucciones de Inicio para Antigravity AI Agent

Cuando el usuario te pida *"Configura este equipo siguiendo SETUP_NUEVO_EQUIPO.md"* o inicies en un nuevo computador, ejecuta automáticamente los siguientes pasos:

### Paso 1: Instalación y Verificación de Entorno
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
npm install
```

### Paso 2: Verificación de Compilación
```powershell
npm run build
```
Asegúrate de que no existan errores de compilación TypeScript/Vite antes de entregar cambios.

### Paso 3: Configuración de Git
```powershell
git config user.name "fritamejor2020-maker"
git config credential.helper wincred
```

---

## 🏗️ 3. Arquitectura del Sistema y Reglas Críticas (NO ROMPER)

### A. Almacenamiento en Supabase (`app_state` JSON)
- **Toda la aplicación utiliza una arquitectura de Tabla Única JSON (`public.app_state`)** con llaves como `posShifts`, `inventory_BRANCH-001`, `customer_delivery_requests`, `vendorLocations`, `geofences`, etc.
- **🚫 NO hacer queries SQL a tablas relacionales inexistentes** (como `supabase.from('vendor_locations')`, `geofences`, `delivery_requests` o `push_subscriptions`). Esas queries causaban errores de Postgres en el servidor. Toda lectura/escritura debe hacerse a través de `app_state` usando `syncManager.js` o `.maybeSingle()`.

### B. Inicio y Cierre de Turnos (Network-First & Prevalencia de Cierre)
1. **Verificación Network-First (`SellerSetupView.tsx`):**
   Antes de abrir un turno local en celular/tablet, se consulta Supabase en la nube Network-First. Si la nube indica que el turno de ese vehículo para esa jornada ya fue marcado como `CERRADO` (`closedAt !== null`), el celular **bloquea la reapertura**.
2. **Cierre Inmediato (0ms):**
   Al cerrar turno o accionar *"Forzar Cierre"* desde el Admin, se escribe `closedAt`, se desactiva el GPS y se eliminan las coordenadas en `vendorLocations` tanto en Zustand como en Supabase.
3. **Prevalencia de Cierre en Deduplicación (`shiftIdMap`):**
   En `AdminVehicleInventoryTab.tsx`, si una versión de un turno tiene `closedAt`, **esa versión cerrada PREVALECE SIEMPRE** sobre cualquier versión vieja abierta.

### C. Asignación de Cargas y Surtidos (Por Vehículo y Rango Temporal)
1. **Coincidencia por Vehículo (`vehicleId` / `pointId`):**
   Las cargas y surtidos se asocian strictly por el código del vehículo (`T1`, `T2`, etc.). Las cargas de `T1` jamás migran a `T2`.
2. **Asignación por Rango Temporal (`openedAt` ➔ `closedAt`):**
   - Si un vehículo tiene 1 solo turno en el día (ej. `T1 PM`), el **100% de las cargas y surtidos del día le pertenecen**.
   - Si un vehículo tiene 2 turnos en el día (`T1 AM` y `T1 PM`), los movimientos entre 8:00 AM y 12:30 PM corresponden a `AM`, y de 12:30 PM en adelante corresponden a `PM`.
   - **NO filtrar cargas o surtidos por el nombre del vendedor ni por comparaciones de texto frágiles**.

### D. Módulo de Pedidos de Clientes (`/pedir`)
1. **Nombre del Vendedor en el Mapa:**
   Prioriza el nombre de la señal GPS en vivo (`loc.name`) emitida por el celular del vendedor. Muestra el nombre humano (ej. Brandon, Víctor) en lugar de nombres genéricos.
2. **Filtro GPS Inactivo (15 min):**
   Descarta automáticamente a vendedores cuya señal GPS tenga más de 15 minutos de antigüedad sin actualizar.
3. **Radio de Cobertura y Reasignación:**
   Mantiene filtro de 3km de cobertura. Los pedidos no contestados a los 60s se auto-rotan al siguiente carrito más cercano.

### E. Aplicación de Escritorio Electron (`electron/main.cjs`)
- Electron ejecuta la app de React en su `BrowserWindow` e incluye un daemon de sincronización biométrica en segundo plano.
- Las consultas a `app_state` en Electron usan `.maybeSingle()` para evitar excepciones `PGRST116`.

---

## 🛠️ 4. Comandos Frecuentes para Antigravity

- **Compilar proyecto:** `npm run build`
- **Iniciar dev server:** `npm run dev`
- **Subir cambios a GitHub:** `git add . && git commit -m "..." && git push origin main`

---

¡Proyecto 100% listo, documentado e inmunizado para Antigravity AI Agent! 🚀
