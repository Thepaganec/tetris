param(
    [int]$Port = 5173,
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$distRoot = Join-Path $scriptRoot "dist"
$indexPath = Join-Path $distRoot "index.html"

if (-not (Test-Path -LiteralPath $indexPath)) {
    throw "Production build was not found. The portable folder must contain dist\index.html next to this script."
}

$portOwner = Get-NetTCPConnection -LocalAddress "127.0.0.1" -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($portOwner) {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $($portOwner.OwningProcess)" -ErrorAction SilentlyContinue
    $commandLine = if ($process) { $process.CommandLine } else { "unknown command line" }
    throw "Port $Port is already used by PID=$($portOwner.OwningProcess): $commandLine"
}

$listener = [System.Net.HttpListener]::new()
$prefix = "http://127.0.0.1:$Port/"
$listener.Prefixes.Add($prefix)

# Helper serves production build files and keeps requests inside dist.
function Send-StaticFile {
    param(
        [System.Net.HttpListenerContext]$Context,
        [string]$DistRoot
    )

    $requestPath = [System.Uri]::UnescapeDataString($Context.Request.Url.LocalPath.TrimStart("/"))
    if ([string]::IsNullOrWhiteSpace($requestPath)) {
        $requestPath = "index.html"
    }

    $candidatePath = Join-Path $DistRoot $requestPath
    $fullDistRoot = [System.IO.Path]::GetFullPath($DistRoot)
    $fullPath = [System.IO.Path]::GetFullPath($candidatePath)

    if (-not $fullPath.StartsWith($fullDistRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        Write-Response -Response $Context.Response -StatusCode 403 -Text "Forbidden"
        return
    }

    if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
        Write-Response -Response $Context.Response -StatusCode 404 -Text "Not Found"
        return
    }

    $bytes = [System.IO.File]::ReadAllBytes($fullPath)
    $Context.Response.StatusCode = 200
    $Context.Response.ContentType = Get-ContentType -Path $fullPath
    $Context.Response.ContentLength64 = $bytes.Length
    $Context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    $Context.Response.OutputStream.Close()
}

# Helper writes short HTTP responses for static server errors.
function Write-Response {
    param(
        [System.Net.HttpListenerResponse]$Response,
        [int]$StatusCode,
        [string]$Text
    )

    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
    $Response.StatusCode = $StatusCode
    $Response.ContentType = "text/plain; charset=utf-8"
    $Response.ContentLength64 = $bytes.Length
    $Response.OutputStream.Write($bytes, 0, $bytes.Length)
    $Response.OutputStream.Close()
}

# Helper maps MIME types for Vite production assets.
function Get-ContentType {
    param(
        [string]$Path
    )

    $extension = [System.IO.Path]::GetExtension($Path).ToLowerInvariant()
    if ($extension -eq ".html") { return "text/html; charset=utf-8" }
    if ($extension -eq ".css") { return "text/css; charset=utf-8" }
    if ($extension -eq ".js") { return "text/javascript; charset=utf-8" }
    if ($extension -eq ".json") { return "application/json; charset=utf-8" }
    if ($extension -eq ".svg") { return "image/svg+xml" }
    if ($extension -eq ".png") { return "image/png" }
    if ($extension -eq ".jpg" -or $extension -eq ".jpeg") { return "image/jpeg" }
    if ($extension -eq ".webp") { return "image/webp" }
    if ($extension -eq ".gif") { return "image/gif" }
    if ($extension -eq ".ico") { return "image/x-icon" }
    if ($extension -eq ".wasm") { return "application/wasm" }
    return "application/octet-stream"
}

try {
    $listener.Start()

    if (-not $NoBrowser) {
        Start-Process $prefix
    }

    Write-Host "Cosmic Reactor Tetris is running: $prefix"
    Write-Host "Stop server: Ctrl+C"

    while ($listener.IsListening) {
        $context = $listener.GetContext()
        Send-StaticFile -Context $context -DistRoot $distRoot
    }
}
finally {
    if ($listener.IsListening) {
        $listener.Stop()
    }
    $listener.Close()
}
