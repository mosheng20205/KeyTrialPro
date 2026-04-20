$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$certDir = Join-Path $root ".local-certs"
$project = Join-Path $root "scripts\\local-cert-tool\\LocalCertTool.csproj"

$env:DOTNET_SKIP_FIRST_TIME_EXPERIENCE = "1"
$env:DOTNET_CLI_HOME = Join-Path $root ".dotnet"

dotnet run --project $project -- $certDir

