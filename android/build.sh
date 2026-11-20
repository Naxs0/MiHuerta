#!/usr/bin/env bash
# Compila Mi Huerta como APK. Uso (Git Bash):  bash android/build.sh
set -euo pipefail
cd "$(dirname "$0")"
SDK="${ANDROID_SDK:-/f/android-sdk}"
BT="$SDK/bt/android-15"
PJ="$SDK/pf/android-35/android.jar"
# La versión se define en android/version.properties
source ./version.properties

rm -rf build && mkdir -p build/assets/www/icons build/assets/www/lib build/gen build/classes build/dex
cp ../index.html ../styles.css ../data.js ../calc.js ../clima.js ../respaldo.js ../app.js ../manifest.webmanifest build/assets/www/
cp ../icons/*.png build/assets/www/icons/
cp -r ../lib/leaflet build/assets/www/lib/
cp migrar.html build/assets/www/
sed -i "s/^const VERSION_WEB = .*/const VERSION_WEB = \"$VERSION_NAME\";/" build/assets/www/respaldo.js

"$BT/aapt2.exe" compile --dir res -o build/res.zip
"$BT/aapt2.exe" link -o build/base.apk -I "$PJ" --manifest AndroidManifest.xml \
  --min-sdk-version 24 --target-sdk-version 34 \
  --version-code "$VERSION_CODE" --version-name "$VERSION_NAME" \
  -A build/assets --java build/gen build/res.zip

javac -nowarn -source 11 -target 11 -classpath "$PJ" -d build/classes \
  $(find src build/gen -name '*.java') 2>&1 | grep -v -i 'warning' || true
"$BT/d8.bat" --release --lib "$PJ" --min-api 24 --output build/dex $(find build/classes -name '*.class')

python -I - build/base.apk build/dex/classes.dex build/unsigned.apk <<'PY'
import sys, zipfile
src, dex, out = sys.argv[1:]
with zipfile.ZipFile(src) as zi, zipfile.ZipFile(out, "w") as zo:
    for it in zi.infolist():
        zo.writestr(it, zi.read(it.filename))
    zo.write(dex, "classes.dex", compress_type=zipfile.ZIP_DEFLATED)
PY
"$BT/zipalign.exe" -p -f 4 build/unsigned.apk build/aligned.apk

KS=mihuerta.keystore
if [ ! -f "$KS" ]; then
  keytool -genkeypair -keystore "$KS" -alias mihuerta -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass mihuerta123 -keypass mihuerta123 -dname "CN=Mi Huerta" >/dev/null 2>&1
fi
"$BT/apksigner.bat" sign --ks "$KS" --ks-pass pass:mihuerta123 --ks-key-alias mihuerta \
  --out ../MiHuerta.apk build/aligned.apk
"$BT/apksigner.bat" verify ../MiHuerta.apk && echo "OK -> MiHuerta.apk"
