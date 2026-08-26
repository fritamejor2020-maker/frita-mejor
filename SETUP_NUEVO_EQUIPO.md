# 🚀 Guía de Configuración e Inmunización Automática — Frita Mejor (Antigravity AI Agent Guide)

Este documento contiene las instrucciones exactas para que el asistente AI (Antigravity) configure, instale y verifique el proyecto **Frita Mejor** de manera autónoma en un nuevo equipo de trabajo.

---

## 🎯 Instrucciones para Antigravity AI Agent

Cuando el usuario lea este archivo o te pida *"Configura este proyecto siguiendo SETUP_NUEVO_EQUIPO.md"*, ejecuta automáticamente la siguiente secuencia de verificación y preparación:

### Paso 1: Verificación de Entorno e Instalación de Dependencias
1. Ejecuta `npm install` en la raíz del proyecto para asegurar que todas las dependencias (`react`, `vite`, `leaflet`, `lucide-react`, `zustand`, `@supabase/supabase-js`, etc.) estén instaladas correctamente.
2. Verifica que `node` y `npm` funcionen correctamente.

### Paso 2: Verificación de Compilación (Vite Build Test)
1. Ejecuta `npm run build` para garantizar que la aplicación compile sin errores de TypeScript, JSX o dependencias.
2. Si se detecta cualquier advertencia o fallo de módulos, resuélvelo de inmediato.

### Paso 3: Configuración de Credenciales Git
1. Configura el usuario de Git si no está configurado:
   - `git config user.name "fritamejor2020-maker"`
   - `git config credential.helper wincred`
2. Asegura que la rama remota esté rastreando `origin/main`.

### Paso 4: Arquitectura del Proyecto y Reglas Clave (No Romper)
Mantén strictly las siguientes garantías arquitectónicas logradas en el sistema:

1. **Separación de Catálogo POS vs Surtido:**
   - La función `getDeliveryItems()` en `src/store/useInventoryStore.js` debe filtrar estrictamente las bebidas (`type === 'BEBIDA'` o categoría `CAT-002`), insumos y productos con `showInTricicloPos: true`.
   - Tanto el vendedor (pestaña *"Pedir Surtido"*) como el dejador (pestañas *"Surtir y Recibir"*) usan idénticamente `getDeliveryItems()`, estando 100% alineados con Admin > Triciclos & Flota > Productos Triciclos.

2. **Módulo de Pedidos de Clientes (0ms Latencia & Sin Banners Bloqueantes):**
   - Todos los pedidos de clientes y tarjetas de aceptación/rechazo deben manejarse **exclusivamente dentro de la pestaña "PEDIDOS"** (`activeTab === 'deliveries'`) en `VendedorDashboard.tsx`.
   - **No usar overlays oscuros de pantalla completa** (`fixed inset-0 bg-black/85`) ni banners amontonados.
   - La auto-rotación de pedidos no contestados se dispara a los 60 segundos (1 min), reasignando automáticamente al siguiente carrito disponible.

3. **Gestión de Turnos Multisede (Sin Duplicados ni Bloqueos):**
   - En `SellerSetupView.tsx`, si un vehículo (`T1`, `T2`, etc.) ya tiene un turno abierto hoy (`closedAt: null`), cualquier celular o iPad ingresa **directamente al turno existente** reutilizando el turno activo, sin bloquear por nombre de usuario y sin crear turnos duplicados.
   - Al realizar *Cierre de Jornada*, `VendedorDashboard.tsx` y `AdminVehicleInventoryTab.tsx` actualizan la fecha `closedAt` en **todas las llaves** (`posShifts%`, `vendorLocations%`) de Supabase para que el Admin pase la tarjeta inmediatamente a `CERRADOS`.

---

## 🛠️ Comandos Frecuentes para Antigravity

- **Probar compilación:** `npm run build`
- **Iniciar servidor dev:** `npm run dev`
- **Subir cambios a GitHub:** `git add . && git commit -m "..." && git push origin main`

---

¡Proyecto listo y documentado para Antigravity AI Agent!
