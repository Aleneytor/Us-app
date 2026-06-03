#!/usr/bin/env node
/**
 * inject-pwa-meta.js
 * Script post-build que inyecta los meta tags necesarios para que la app
 * funcione como PWA standalone en iOS Safari (oculta la barra del navegador).
 */

const fs = require("fs");
const path = require("path");

const indexPath = path.join(__dirname, "dist", "index.html");

if (!fs.existsSync(indexPath)) {
  console.error("❌ dist/index.html no encontrado. Ejecuta primero el build.");
  process.exit(1);
}

let html = fs.readFileSync(indexPath, "utf-8");

// Meta tags que necesitamos inyectar
const pwaMeta = `
    <!-- PWA: iOS Safari standalone mode (oculta barra del navegador) -->
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Juntos" />
    <!-- PWA: Android / Chrome -->
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="application-name" content="Juntos" />
    <meta name="format-detection" content="telephone=no" />
    <!-- viewport-fit=cover para soporte de notch -->`;

// Reemplaza el viewport existente con uno que incluya viewport-fit=cover
html = html.replace(
  /(<meta name="viewport"[^>]*content=")[^"]*("[^>]*>)/,
  '$1width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover$2'
);

// Verifica si ya están inyectados
if (html.includes("apple-mobile-web-app-capable")) {
  console.log("✅ Los meta tags de PWA ya están presentes. Nada que hacer.");
  process.exit(0);
}

// Inyecta después del meta viewport
html = html.replace(
  /(<meta name="viewport"[^>]*>)/,
  `$1${pwaMeta}`
);

fs.writeFileSync(indexPath, html, "utf-8");
console.log("✅ Meta tags de PWA inyectados correctamente en dist/index.html");
