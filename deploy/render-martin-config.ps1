# Reemplaza `envsubst < martin-config.template.yaml > martin-config.yaml` (el runner
# de deploy ahora es un self-hosted en Windows Server, sin gettext/envsubst nativo).
# Lee .env de la carpeta actual (mismo formato KEY=VALUE que ya usa docker compose,
# sin necesidad de que las variables ya estén en el entorno del proceso) y sustituye
# ${VAR} en el template. Martin sigue sin soportar ${VAR} directo en su config —
# verificado en vivo, ver comentario del propio template.

param(
    [string]$EnvFile = ".env",
    [string]$Template = "martin-config.template.yaml",
    [string]$Output = "martin-config.yaml"
)

$ErrorActionPreference = "Stop"

$vars = @{}
Get-Content $EnvFile | ForEach-Object {
    if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
    $key, $value = $_ -split '=', 2
    $vars[$key.Trim()] = $value.Trim()
}

$rendered = [System.Text.RegularExpressions.Regex]::Replace(
    (Get-Content $Template -Raw),
    '\$\{(\w+)\}',
    { param($m) $vars[$m.Groups[1].Value] }
)

Set-Content -Path $Output -Value $rendered -NoNewline
Write-Host "Generado $Output desde $Template"
