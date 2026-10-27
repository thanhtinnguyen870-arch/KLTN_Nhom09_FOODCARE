# ============================================================
#  FoodCare Dev Startup Script
#  Chạy: .\start-dev.ps1
#  Tự động kiểm tra & khởi động toàn bộ môi trường dev
# ============================================================

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $RootDir "backend"
$FrontendDir = Join-Path $RootDir "frontend"
$EnvFile = Join-Path $BackendDir ".env"

Write-Host ""
Write-Host "╔══════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║       FoodCare Dev Environment Startup       ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ──────────────────────────────────────────
# 1. Kiểm tra MongoDB
# ──────────────────────────────────────────
Write-Host "▶ [1/4] Kiểm tra MongoDB..." -ForegroundColor Yellow
$mongo = Get-Service -Name "MongoDB" -ErrorAction SilentlyContinue
if ($null -eq $mongo) {
    Write-Host "  ✗ MongoDB service không tìm thấy!" -ForegroundColor Red
    Write-Host "  → Hãy cài MongoDB Community: https://www.mongodb.com/try/download/community" -ForegroundColor Gray
    exit 1
} elseif ($mongo.Status -ne "Running") {
    Write-Host "  ⚠ MongoDB đang dừng, đang khởi động..." -ForegroundColor Yellow
    Start-Service -Name "MongoDB"
    Start-Sleep -Seconds 2
    Write-Host "  ✓ MongoDB đã khởi động" -ForegroundColor Green
} else {
    Write-Host "  ✓ MongoDB đang chạy" -ForegroundColor Green
}

# ──────────────────────────────────────────
# 2. Kiểm tra .env và API keys
# ──────────────────────────────────────────
Write-Host ""
Write-Host "▶ [2/4] Kiểm tra cấu hình .env..." -ForegroundColor Yellow

if (-not (Test-Path $EnvFile)) {
    Write-Host "  ✗ Không tìm thấy $EnvFile" -ForegroundColor Red
    exit 1
}

$envContent = Get-Content $EnvFile -Raw

# Kiểm tra Gemini API key format
$geminiMatch = [regex]::Match($envContent, 'GEMINI_API_KEY=(.+)')
if ($geminiMatch.Success) {
    $geminiKey = $geminiMatch.Groups[1].Value.Trim()
    if ($geminiKey.StartsWith("AIzaSy") -or $geminiKey.StartsWith("AQ.")) {
        Write-Host "  ✓ GEMINI_API_KEY hợp lệ" -ForegroundColor Green
    } else {
        Write-Host "  ⚠ GEMINI_API_KEY format không xác định" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ⚠ GEMINI_API_KEY không tìm thấy trong .env" -ForegroundColor Yellow
}

Write-Host "  ✓ .env đã load" -ForegroundColor Green

# ──────────────────────────────────────────
# 3. Kiểm tra & khởi động ngrok (cho MoMo IPN)
# ──────────────────────────────────────────
Write-Host ""
Write-Host "▶ [3/4] Kiểm tra ngrok (MoMo IPN)..." -ForegroundColor Yellow

$ngrokExe = "C:\Users\thanh\AppData\Local\Microsoft\WinGet\Packages\Ngrok.Ngrok_Microsoft.Winget.Source_8wekyb3d8bbwe\ngrok.exe"
$ngrokExists = (Get-Command ngrok -ErrorAction SilentlyContinue) -or (Test-Path $ngrokExe)

if (-not $ngrokExists) {
    Write-Host "  ⚠ ngrok chưa cài — bỏ qua (MoMo IPN sẽ không hoạt động)" -ForegroundColor Yellow
    Write-Host "  → Cài ngrok: winget install ngrok.ngrok" -ForegroundColor Gray
} else {
    # Dùng full path nếu ngrok chưa có trong PATH
    $ngrokCmd = if (Get-Command ngrok -ErrorAction SilentlyContinue) { "ngrok" } else { $ngrokExe }

    # Đọc static domain từ MOMO_IPN_URL trong .env
    $momoIpnMatch = [regex]::Match($envContent, 'MOMO_IPN_URL=https://(.+?)/')
    $ngrokDomain = if ($momoIpnMatch.Success) { $momoIpnMatch.Groups[1].Value } else { $null }

    if ($ngrokDomain) {
        Write-Host "  → Khởi động ngrok với static domain: $ngrokDomain" -ForegroundColor Gray
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "& '$ngrokCmd' http 5000 --url=https://$ngrokDomain"
    } else {
        Write-Host "  → Khởi động ngrok (URL ngẫu nhiên)..." -ForegroundColor Gray
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "& '$ngrokCmd' http 5000"
    }
    Start-Sleep -Seconds 2
    Write-Host "  ✓ ngrok đang chạy với domain: $ngrokDomain" -ForegroundColor Green
}

# ──────────────────────────────────────────
# 4. Khởi động Backend & Frontend
# ──────────────────────────────────────────
Write-Host ""
Write-Host "▶ [4/4] Khởi động servers..." -ForegroundColor Yellow

Start-Process powershell -ArgumentList "-NoExit", "-Command", `
    "Set-Location '$BackendDir'; Write-Host 'Backend starting...' -ForegroundColor Cyan; npm run dev"
Write-Host "  ✓ Backend đang khởi động (port 5000)" -ForegroundColor Green

Start-Sleep -Seconds 1

Start-Process powershell -ArgumentList "-NoExit", "-Command", `
    "Set-Location '$FrontendDir'; Write-Host 'Frontend starting...' -ForegroundColor Magenta; npm run dev"
Write-Host "  ✓ Frontend đang khởi động (port 5173)" -ForegroundColor Green

Write-Host ""
Write-Host "╔══════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  ✅ Tất cả services đã được khởi động!       ║" -ForegroundColor Green
Write-Host "║                                              ║" -ForegroundColor Green
Write-Host "║  Frontend:  http://localhost:5173            ║" -ForegroundColor Green
Write-Host "║  Backend:   http://localhost:5000            ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""


