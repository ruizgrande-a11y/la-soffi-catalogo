# La Soffi · Catálogo online

Catálogo web administrable para **Pastelería & Heladería La Soffi**, inspirado en la estructura de SharCrys: portada independiente, entrada al catálogo, categorías, buscador, fichas de producto, pedido por WhatsApp y panel `/admin`.

## Estructura

- `/` — portada animada con fresas, chocolate y helados.
- `/catalogo` — catálogo con buscador, categorías, detalle y carrito/pedido por WhatsApp.
- `/admin` — panel para crear, editar, ocultar y eliminar productos, además de subir imágenes.
- `/api/*` — API Node.js sin dependencias externas.
- `data/products.json` — productos iniciales.
- `data/settings.json` — datos comerciales.

## Ejecutar localmente

```bash
ADMIN_USER=admin ADMIN_PASSWORD='TU_CLAVE' SESSION_SECRET='TU_SECRETO' node server.js
```

Luego abre `http://localhost:3000`.

> En modo demo, si no defines variables, el panel usa `admin / lasoffi2026`. **Cámbialo antes de publicar.**

## Hostinger / Node.js

1. Crea una aplicación Node.js en hPanel.
2. Conecta el repositorio GitHub de La Soffi o sube los archivos.
3. Usa Node.js 20 o superior.
4. Startup file: `server.js`.
5. Start command: `npm start`.
6. Variables de entorno mínimas: `ADMIN_USER`, `ADMIN_PASSWORD`, `SESSION_SECRET`.
7. Configura el dominio o subdominio para apuntar a la aplicación Node.js.
8. Reinicia la aplicación y valida `/api/health`.

No requiere `npm install` de paquetes externos porque usa únicamente módulos nativos de Node.js.
