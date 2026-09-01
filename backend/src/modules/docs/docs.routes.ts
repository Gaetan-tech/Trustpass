import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { openapiDocument } from '../../lib/openapi.js';

// Documentation interactive de l'API (Swagger UI) + spec OpenAPI brute.
// Montée sous /api/v1 → /api/v1/docs et /api/v1/openapi.json.
export const docsRoutes = Router();

// Swagger UI est chargé depuis jsDelivr. helmet applique une CSP `default-src 'self'`
// globale qui bloquerait le CDN et le script d'init inline : on la relâche
// UNIQUEMENT sur les routes de doc (le reste de l'API garde la CSP stricte).
const SWAGGER_CDN = 'https://cdn.jsdelivr.net';
function relaxCspForDocs(_req: Request, res: Response, next: NextFunction) {
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline' ${SWAGGER_CDN}`,
      `style-src 'self' 'unsafe-inline' ${SWAGGER_CDN}`,
      `img-src 'self' data: ${SWAGGER_CDN}`,
      `font-src 'self' data: ${SWAGGER_CDN}`,
      "connect-src 'self'",
    ].join('; '),
  );
  next();
}

// Spec OpenAPI (consommée par Swagger UI et par tout autre client, ex. Postman).
docsRoutes.get('/openapi.json', (_req: Request, res: Response) => {
  res.json(openapiDocument);
});

const SWAGGER_VERSION = '5.17.14';
const swaggerHtml = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>TrustPass API — Documentation</title>
    <link rel="stylesheet" href="${SWAGGER_CDN}/npm/swagger-ui-dist@${SWAGGER_VERSION}/swagger-ui.css" />
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><text y='14' font-size='14'>🎟️</text></svg>" />
    <style>
      body { margin: 0; background: #fafafa; }
      .topbar { display: none; }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="${SWAGGER_CDN}/npm/swagger-ui-dist@${SWAGGER_VERSION}/swagger-ui-bundle.js" crossorigin></script>
    <script src="${SWAGGER_CDN}/npm/swagger-ui-dist@${SWAGGER_VERSION}/swagger-ui-standalone-preset.js" crossorigin></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: 'openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
        layout: 'BaseLayout',
        docExpansion: 'list',
        defaultModelsExpandDepth: 0,
        tryItOutEnabled: true,
        persistAuthorization: true,
      });
    </script>
  </body>
</html>`;

docsRoutes.get('/docs', relaxCspForDocs, (_req: Request, res: Response) => {
  res.type('html').send(swaggerHtml);
});
