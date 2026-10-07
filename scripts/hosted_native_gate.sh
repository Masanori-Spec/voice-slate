#!/usr/bin/env bash
set -euo pipefail
mkdir -p .native/app evidence .native/xdg-data/OpenUtau .native/xdg-cache/OpenUtau
export XDG_DATA_HOME="$PWD/.native/xdg-data"
export XDG_CACHE_HOME="$PWD/.native/xdg-cache"
curl --fail --location --retry 2 --output .native/OpenUtau-linux-x64.tar.gz 'https://github.com/openutau/OpenUtau/releases/download/0.1.572.3-alpha/OpenUtau-linux-x64.tar.gz'
echo 'f9f7854af0fd2e4d8c8c6416ac86069b6e4e4e264cc73f255f85d9ab215466e2  .native/OpenUtau-linux-x64.tar.gz' | sha256sum --check | tee evidence/release-integrity.txt
test "$(stat -c %s .native/OpenUtau-linux-x64.tar.gz)" = 328302323
tar -xzf .native/OpenUtau-linux-x64.tar.gz -C .native/app
test -f .native/app/OpenUtau.Core.dll
test -f .native/app/OpenUtau.deps.json
test -f .native/app/OpenUtau.runtimeconfig.json
sha256sum .native/app/OpenUtau.Core.dll .native/app/YamlDotNet.dll > evidence/official-dll-before.sha256
dotnet build native/NativeGate.csproj --configuration Release --output .native/gate
cp .native/gate/NativeGate.dll .native/app/VoiceSlate.NativeGate.dll
dotnet --info > evidence/dotnet-info.txt
dotnet exec --depsfile .native/app/OpenUtau.deps.json --runtimeconfig .native/app/OpenUtau.runtimeconfig.json .native/app/VoiceSlate.NativeGate.dll author evidence
python3 scripts/precision_probe.py
dotnet exec --depsfile .native/app/OpenUtau.deps.json --runtimeconfig .native/app/OpenUtau.runtimeconfig.json .native/app/VoiceSlate.NativeGate.dll precision evidence
python3 scripts/run_transform.py prototype-
VOICESLATE_EVIDENCE_DIR="$PWD/evidence" VOICESLATE_REFERENCE_PREFIX=prototype- VOICESLATE_REQUIRE_NATIVE=1 node --test tests/test_browser_core.cjs
node scripts/browser_test.mjs
node scripts/browser_convert.mjs
dotnet exec --depsfile .native/app/OpenUtau.deps.json --runtimeconfig .native/app/OpenUtau.runtimeconfig.json .native/app/VoiceSlate.NativeGate.dll verify evidence
sha256sum --check evidence/official-dll-before.sha256 | tee evidence/official-dll-unchanged.txt
python3 scripts/oracle.py
python3 scripts/browser_oracle.py
