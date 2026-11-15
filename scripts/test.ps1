$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
    foreach ($service in @('backend-tests', 'frontend-tests')) {
        docker compose -f compose.test.yaml run --rm --build $service
        if ($LASTEXITCODE -ne 0) { throw "$service failed." }
    }
} finally {
    docker compose -f compose.test.yaml down --remove-orphans
    Pop-Location
}
