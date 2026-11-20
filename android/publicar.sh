#!/usr/bin/env bash
# Compila y publica una nueva versión en GitHub (la app avisará a los usuarios).
# 1) Sube VERSION_CODE y VERSION_NAME en android/version.properties
# 2) Escribe las novedades en android/NOVEDADES.md
# 3) Ejecuta (Git Bash):  bash android/publicar.sh
set -euo pipefail
cd "$(dirname "$0")"
source ./version.properties
bash ./build.sh
cd ..
sed -i "s/^const VERSION_WEB = .*/const VERSION_WEB = \"$VERSION_NAME\";/" respaldo.js
git add -A
git commit -m "Versión $VERSION_NAME" || true
git push
gh release create "v$VERSION_NAME" MiHuerta.apk --repo Naxs0/MiHuerta \
  --title "Mi Huerta $VERSION_NAME" --notes-file android/NOVEDADES.md
echo "Publicada la versión $VERSION_NAME"
