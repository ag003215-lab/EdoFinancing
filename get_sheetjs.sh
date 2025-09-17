#!/usr/bin/env bash
# Script para descargar SheetJS xlsx.full.min.js en el directorio vendor/ para uso offline.
# Uso: ejecutar este script desde la raíz del proyecto (donde existe vendor/).
set -e
mkdir -p vendor
echo "Descargando SheetJS (xlsx.full.min.js) en vendor/ ..."
curl -L -o vendor/xlsx.full.min.js "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js"
echo "Descargado vendor/xlsx.full.min.js"