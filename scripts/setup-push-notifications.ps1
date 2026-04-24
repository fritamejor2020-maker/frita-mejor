#!/usr/bin/env pwsh
# ============================================================
# setup-push-notifications.ps1
# Configura las push notifications de Frita Mejor en Supabase
# 
# Pasos ANTES de ejecutar este script:
# 1. Ve a: https://supabase.com/dashboard/account/tokens
# 2. Click "Generate new token" → copia el token
# 3. Ejecuta: .\scripts\setup-push-notifications.ps1 -SupabaseToken "sbp_xxxx..."
# ============================================================
param(
  [Parameter(Mandatory=$true)]
  [string]$SupabaseToken
)

$PROJECT_ID    = "uevcotmnffftoelscjua"
$VAPID_PUBLIC  = "BIhQQvOqQjVtCr-MfTGH1eoxYvl9pMuSOczEJU7kj1L867ntrf-b9QK1Hfi2PF8MTMV_IBaGmWa0HSpK4pZ_oh0"
$VAPID_PRIVATE = "THFdu3rLbRUEF8QWw-BR-Og4HFGwsbZrEF48slvcv0Q"
$VAPID_SUBJECT = "mailto:admin@fritamejor.com"

Write-Host "`n🔐 Autenticando con Supabase CLI..." -ForegroundColor Cyan
npx supabase login --token $SupabaseToken

if ($LASTEXITCODE -ne 0) {
  Write-Host "❌ Error de autenticacion. Verifica el token." -ForegroundColor Red
  exit 1
}

# ── Obtener las API keys del proyecto ─────────────────────────
Write-Host "`n🔑 Obteniendo API keys del proyecto..." -ForegroundColor Cyan
$headers = @{ "Authorization" = "Bearer $SupabaseToken"; "Content-Type" = "application/json" }
$apiResponse = Invoke-RestMethod -Uri "https://api.supabase.com/v1/projects/$PROJECT_ID/api-keys" -Headers $headers

$serviceRoleKey = ($apiResponse | Where-Object { $_.name -eq "service_role" }).api_key
$anonKey        = ($apiResponse | Where-Object { $_.name -eq "anon" }).api_key

if (-not $serviceRoleKey) {
  Write-Host "❌ No se pudo obtener la service_role key." -ForegroundColor Red
  exit 1
}

Write-Host "  ✅ Keys obtenidas" -ForegroundColor Green

# ── Actualizar el .env con la anon key ─────────────────────────
Write-Host "`n📝 Actualizando .env..." -ForegroundColor Cyan
$envContent = @"
VITE_SUPABASE_URL=https://$PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=$anonKey
VITE_VAPID_PUBLIC_KEY=$VAPID_PUBLIC
"@
Set-Content -Path ".env" -Value $envContent
Write-Host "  ✅ .env actualizado" -ForegroundColor Green

# ── Crear la tabla push_subscriptions en Supabase ─────────────
Write-Host "`n🗄️  Creando tabla push_subscriptions en Supabase..." -ForegroundColor Cyan
$sql = Get-Content -Path "supabase\push_subscriptions.sql" -Raw
$body = @{ query = $sql } | ConvertTo-Json
$pgHeaders = @{
  "Authorization" = "Bearer $SupabaseToken"
  "Content-Type"  = "application/json"
}
try {
  Invoke-RestMethod -Uri "https://api.supabase.com/v1/projects/$PROJECT_ID/database/query" `
    -Method POST -Headers $pgHeaders -Body $body | Out-Null
  Write-Host "  ✅ Tabla creada (o ya existia)" -ForegroundColor Green
} catch {
  Write-Host "  ⚠️  Error creando tabla: puede que ya exista. Continuando..." -ForegroundColor Yellow
}

# ── Configurar secrets de la Edge Function ────────────────────
Write-Host "`n🔒 Configurando secrets de la Edge Function..." -ForegroundColor Cyan
npx supabase secrets set --project-ref $PROJECT_ID `
  VAPID_PUBLIC_KEY=$VAPID_PUBLIC `
  VAPID_PRIVATE_KEY=$VAPID_PRIVATE `
  VAPID_SUBJECT=$VAPID_SUBJECT `
  SUPABASE_SERVICE_ROLE_KEY=$serviceRoleKey

if ($LASTEXITCODE -eq 0) {
  Write-Host "  ✅ Secrets configurados" -ForegroundColor Green
} else {
  Write-Host "  ❌ Error configurando secrets" -ForegroundColor Red
}

# ── Desplegar la Edge Function ─────────────────────────────────
Write-Host "`n🚀 Desplegando Edge Function notify-dejadors..." -ForegroundColor Cyan
npx supabase functions deploy notify-dejadors `
  --project-ref $PROJECT_ID `
  --no-verify-jwt

if ($LASTEXITCODE -eq 0) {
  Write-Host "  ✅ Edge Function desplegada exitosamente" -ForegroundColor Green
} else {
  Write-Host "  ❌ Error desplegando la Edge Function" -ForegroundColor Red
  exit 1
}

Write-Host "`n✅ ¡LISTO! Push notifications configuradas." -ForegroundColor Green
Write-Host "Recuerda hacer: npm run build && desplegar en Vercel para que el .env tome efecto." -ForegroundColor Yellow
