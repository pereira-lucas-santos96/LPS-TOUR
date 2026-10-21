$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$portableNode = Join-Path $PSScriptRoot '.tools\node.exe'
if (Test-Path -LiteralPath $portableNode) {
    $nodeExecutable = $portableNode
} else {
    $installedNode = Get-Command node -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $installedNode) { throw 'Instale o Node.js 22 ou superior em https://nodejs.org e execute novamente.' }
    $nodeExecutable = $installedNode.Source
}
$nodeVersion = & $nodeExecutable --version
if ($LASTEXITCODE -ne 0 -or $nodeVersion -notmatch '^v(\d+)\.' -or [int]$Matches[1] -lt 22) {
    throw 'Este projeto precisa de Node.js 22 ou superior. Atualize em https://nodejs.org.'
}
& $nodeExecutable server.mjs
exit $LASTEXITCODE
