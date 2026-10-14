# Wazzap derleme ve kurulum betiği (geliştirme kurulumu; hazır kurulum için GitHub Releases)
# İlk çalıştırmada gerekiyorsa Rust ve Visual Studio C++ derleme araçlarını kurar,
# uygulamayı derler, %LOCALAPPDATA%\Programs\Wazzap altına koyar ve Başlat menüsüne ekler.
#
# -Sessiz: uygulamanın içinden güncelleme için. Araç kurmaz, pencere açmaz, çıktıyı -Log dosyasına
#          yazar. Önce derler; derleme başarılıysa çalışan uygulamayı kapatıp yenisini kurar ve açar.

param(
  [switch]$Sessiz,
  [string]$Log = ''
)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

function Has($cmd) { [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }
function Say($text) {
  if ($Log) { Add-Content -Path $Log -Value $text -Encoding UTF8 }
  if (-not $Sessiz) { Write-Host $text }
}
function Step($text) { Say ''; Say "› $text" }
function Note($text) { Say "  $text" }
function Fail($text, $code) {
  Say $text
  if (-not $Sessiz) { Write-Host $text -ForegroundColor Red }
  exit $code
}

Say "Wazzap derleniyor ($(Get-Date -Format 'yyyy-MM-dd HH:mm'))"

# 1) Rust
$cargoBin = Join-Path $env:USERPROFILE '.cargo\bin'
if (-not (Has cargo) -and (Test-Path (Join-Path $cargoBin 'cargo.exe'))) { $env:Path = "$cargoBin;$env:Path" }
if (-not (Has cargo)) {
  if ($Sessiz) { Fail 'Rust bulunamadı. derle.bat ile bir kez elle kur.' 2 }
  if (-not (Has winget)) { Fail "winget bulunamadı. Microsoft Store'dan 'Uygulama Yükleyicisi'ni güncelleyip tekrar dene." 1 }
  Step 'Rust kuruluyor (bir kerelik)'
  winget install --id Rustlang.Rustup -e --silent --accept-source-agreements --accept-package-agreements
  $env:Path = "$cargoBin;$env:Path"
  rustup default stable-msvc
} else {
  Note 'Rust hazır'
}

# 2) Visual Studio C++ derleme araçları
$vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
$hasVc = $false
if (Test-Path $vswhere) {
  $vc = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
  if ($vc) { $hasVc = $true }
}
if (-not $hasVc) {
  if ($Sessiz) { Fail 'C++ derleme araçları bulunamadı. derle.bat ile bir kez elle kur.' 2 }
  Step 'C++ derleme araçları kuruluyor (bir kerelik, birkaç GB, 10-20 dakika; yönetici izni isteyecek)'
  winget install --id Microsoft.VisualStudio.2022.BuildTools -e --accept-source-agreements --accept-package-agreements `
    --override "--quiet --wait --norestart --nocache --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
} else {
  Note 'C++ derleme araçları hazır'
}

# 3) Derleme (uygulama bu sırada çalışmaya devam eder)
Step 'Derleniyor (ilk seferde 5-10 dakika sürer, sonrakiler çok daha kısa)'
if ($Sessiz -and $Log) {
  # PowerShell, cargo'nun stderr çıktısını hata sanmasın: yönlendirmeyi cmd yapsın.
  cmd /c "cargo build --release >> `"$Log`" 2>&1"
} else {
  cargo build --release
}
if ($LASTEXITCODE -ne 0) { Fail 'Derleme başarısız. Yukarıdaki hatayı Claude ile paylaş.' 1 }

# 4) Kurulum
Step 'Kuruluyor'
$dir = Join-Path $env:LOCALAPPDATA 'Programs\Wazzap'
New-Item -ItemType Directory -Force -Path $dir | Out-Null
$exe = Join-Path $dir 'Wazzap.exe'
# Eski adlarla (WhatsApp+, Tellal) kurulmuş sürümler de kapansın; veri klasörünü yeni sürüm taşıyacak.
$oldNames = @('WhatsApp+', 'Tellal')
$oldExes = $oldNames | ForEach-Object { Join-Path $env:LOCALAPPDATA "Programs\$_\$_.exe" }
Get-Process | Where-Object { $_.Path -eq $exe -or $oldExes -contains $_.Path } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 1500
$copied = $false
for ($i = 0; $i -lt 10 -and -not $copied; $i++) {
  try { Copy-Item 'target\release\wazzap.exe' $exe -Force; $copied = $true }
  catch { Start-Sleep -Milliseconds 500 }
}
if (-not $copied) { Fail 'Uygulama dosyası değiştirilemedi (hâlâ açık olabilir).' 1 }

# Uygulama güncellemeleri buradan bulsun: proje klasörünün yolu.
Set-Content -Path (Join-Path $dir 'kaynak.txt') -Value $PSScriptRoot -Encoding UTF8

# Eski adın izlerini temizle: kurulum klasörü, kısayollar, başlangıç kaydı.
foreach ($old in $oldNames) {
  $oldDir = Join-Path $env:LOCALAPPDATA "Programs\$old"
  if (Test-Path $oldDir) { Remove-Item $oldDir -Recurse -Force -ErrorAction SilentlyContinue }
  foreach ($folder in @([Environment]::GetFolderPath('Programs'), [Environment]::GetFolderPath('Desktop'))) {
    Remove-Item (Join-Path $folder "$old.lnk") -Force -ErrorAction SilentlyContinue
  }
  Remove-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name $old -ErrorAction SilentlyContinue
}

$shell = New-Object -ComObject WScript.Shell
foreach ($folder in @([Environment]::GetFolderPath('Programs'), [Environment]::GetFolderPath('Desktop'))) {
  $lnk = $shell.CreateShortcut((Join-Path $folder 'Wazzap.lnk'))
  $lnk.TargetPath = $exe
  $lnk.WorkingDirectory = $dir
  $lnk.IconLocation = "$exe,0"
  $lnk.Description = 'Wazzap'
  $lnk.Save()
}
Note "Uygulama: $exe"
Note 'Başlat menüsüne ve masaüstüne kısayol eklendi.'

Step 'Açılıyor'
Start-Process $exe
Say 'Tamam'
exit 0
