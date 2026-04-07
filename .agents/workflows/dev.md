---
description: Arrancar el servidor de desarrollo local de Frita Mejor
---

// turbo-all

1. Refresca las variables de entorno y asegúrate que Node.js esté disponible en el PATH.

2. Instala las dependencias si no están instaladas:
```
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force; $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User"); npm install
```
Ejecutar desde: `C:\Users\ASUS\.gemini\antigravity\scratch\frita-mejor`

3. Arranca el servidor de desarrollo:
```
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force; $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User"); npm run dev
```
Ejecutar desde: `C:\Users\ASUS\.gemini\antigravity\scratch\frita-mejor`

4. Abre el navegador en http://localhost:5173/
