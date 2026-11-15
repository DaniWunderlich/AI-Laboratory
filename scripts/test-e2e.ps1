param([int]$Port = 18401)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Push-Location $root
$oldPort = $env:LAB_PORT
$oldUrl = $env:LAB_TEST_URL
$project = 'ml-laboratory-e2e'
try {
    $env:LAB_PORT = "$Port"
    $env:LAB_TEST_URL = "http://127.0.0.1:$Port"
    docker compose -p $project up -d --build --wait
    if ($LASTEXITCODE -ne 0) { throw 'E2E stack failed to start.' }
    Push-Location frontend
    try {
        npm.cmd run test:e2e
        if ($LASTEXITCODE -ne 0) { throw 'Browser tests failed.' }
    } finally { Pop-Location }
} finally {
    # Only the fixed disposable E2E project and its own volume are removed.
    docker compose -p $project down --volumes --remove-orphans
    $env:LAB_PORT = $oldPort
    $env:LAB_TEST_URL = $oldUrl
    Pop-Location
}
