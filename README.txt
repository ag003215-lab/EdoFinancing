# Sistema Financiero Empresarial Pro X (Single-user)

## Cómo correr
1) Descomprime el ZIP.
2) Abre `index.html` en tu navegador (requiere internet para cargar los CDNs de Tailwind, Font Awesome, Chart.js y html2pdf).
3) Captura tus datos en la sección **Entrada de datos**.
4) Usa **Preview** para ver el PDF y **Exportar** para descargarlo.

> Si necesitas trabajar 100% offline, te dejo pendiente una versión que incluya librerías locales (sin CDN).


---

## Incluir SheetJS para XLSX real (instrucciones)

Para habilitar exportación **XLSX** real y offline usando SheetJS, descarga el archivo `xlsx.full.min.js` dentro de la carpeta `vendor/`.

Puedes ejecutar desde la raíz del proyecto:

```bash
./get_sheetjs.sh
```

O descarga manualmente desde el CDN oficial: `https://cdn.sheetjs.com/` y coloca `xlsx.full.min.js` en `vendor/`.

La app detectará `window.XLSX` y usará SheetJS para crear un archivo `.xlsx` profesional. Si SheetJS no está presente la app usará un método alternativo (archivo .xls basado en HTML) como fallback.

---
