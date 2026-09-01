// Spec OpenAPI 3.1 de l'API TrustPass — source dérivée de docs/API_CONTRACT.md
// et des routes réelles (src/modules/**/*.routes.ts). Servie en JSON sur
// /api/v1/openapi.json et rendue par Swagger UI sur /api/v1/docs.
//
// Les chemins sont relatifs au serveur « /api/v1 » : ainsi « Try it out »
// tape le même hôte que celui qui sert la doc (localhost en dev, l'URL Azure
// du Container App en prod), sans URL codée en dur.

const bearer = [{ bearerAuth: [] }];

// Enveloppe d'erreur uniforme (cf. API_CONTRACT §Conventions).
const errorResponse = (description: string) => ({
  description,
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/Error' },
    },
  },
});

export const openapiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'TrustPass API',
    version: '0.1.0',
    description: [
      'API de la marketplace de revente de billets **TrustPass** — revente encadrée',
      '(plafond de prix, fenêtre de revente), transfert nominatif atomique et',
      'contrôle d\'accès par QR.',
      '',
      '**Conventions**',
      '- Base URL : `/api/v1`',
      '- Auth : `Authorization: Bearer <accessToken>` (JWT). Rafraîchir via `POST /auth/refresh`.',
      '- Montants en **centimes**, devise `EUR`.',
      '- Pagination : `?page=1&limit=20` → `{ data, page, limit, total }`.',
      '- Erreurs : `{ "error": { "code", "message", "details" } }`.',
      '',
      '> Paiement en **mode simulé** dans cette démo (Stripe désactivé). Utiliser',
      '> `POST /orders/:id/simulate-pay` pour simuler un paiement réussi.',
    ].join('\n'),
    contact: { name: 'TrustPass' },
  },
  servers: [{ url: '/api/v1', description: 'Cet hôte (API montée sous /api/v1)' }],
  tags: [
    { name: 'Health', description: 'Sondes de supervision (liveness / readiness / métriques)' },
    { name: 'Auth', description: 'Authentification et gestion de session (E1)' },
    { name: 'Events', description: 'Événements et règles de revente organisateur (E6)' },
    { name: 'Tickets', description: 'Billets, transfert nominatif et contrôle d\'accès (E2/E5/E7)' },
    { name: 'Listings', description: 'Annonces de la marketplace (E3)' },
    { name: 'Orders', description: 'Tunnel d\'achat et paiement (E4)' },
    { name: 'Webhooks', description: 'Réception des événements de paiement (E4)' },
    { name: 'Organizer', description: 'Dashboard organisateur et comptes contrôleur (E8)' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Coller l\'`accessToken` renvoyé par `POST /auth/login`.',
      },
    },
    parameters: {
      Page: {
        name: 'page',
        in: 'query',
        required: false,
        schema: { type: 'integer', minimum: 1, default: 1 },
      },
      Limit: {
        name: 'limit',
        in: 'query',
        required: false,
        schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      },
      IdPath: {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string' },
      },
    },
    schemas: {
      Error: {
        type: 'object',
        required: ['error'],
        properties: {
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: { type: 'string', example: 'PRICE_ABOVE_CAP' },
              message: { type: 'string' },
              details: { type: 'object', additionalProperties: true },
            },
          },
        },
      },
      PaginationMeta: {
        type: 'object',
        properties: {
          page: { type: 'integer', example: 1 },
          limit: { type: 'integer', example: 20 },
          total: { type: 'integer', example: 42 },
        },
      },
      Role: { type: 'string', enum: ['user', 'organizer', 'controller'] },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          email: { type: 'string', format: 'email' },
          role: { $ref: '#/components/schemas/Role' },
          emailVerified: { type: 'boolean' },
        },
      },
      AuthTokens: {
        type: 'object',
        properties: {
          accessToken: { type: 'string' },
          refreshToken: { type: 'string' },
          user: { $ref: '#/components/schemas/User' },
        },
      },
      TicketType: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string', example: 'Carré Or' },
          faceValue: { type: 'integer', description: 'Valeur faciale en centimes', example: 8900 },
        },
      },
      Event: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string', example: 'Concert TrustPass Live' },
          venue: { type: 'string', nullable: true, example: 'Accor Arena, Paris' },
          startsAt: { type: 'string', format: 'date-time' },
          ticketTypes: { type: 'array', items: { $ref: '#/components/schemas/TicketType' } },
        },
      },
      Rule: {
        type: 'object',
        properties: {
          ticketTypeId: { type: 'string', nullable: true },
          priceCap: { type: 'integer', description: 'Plafond de revente en centimes' },
          resaleOpensAt: { type: 'string', format: 'date-time', nullable: true },
          resaleClosesAt: { type: 'string', format: 'date-time', nullable: true },
          commissionBps: { type: 'integer', description: 'Commission en points de base (1/100 %)' },
        },
      },
      Ticket: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          event: { $ref: '#/components/schemas/Event' },
          ticketType: { $ref: '#/components/schemas/TicketType' },
          status: {
            type: 'string',
            enum: ['owned', 'listed', 'reserved', 'sold', 'used'],
          },
          qrVersion: { type: 'integer' },
          holderName: { type: 'string', nullable: true },
          holderEmail: { type: 'string', nullable: true },
        },
      },
      Listing: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          event: { $ref: '#/components/schemas/Event' },
          ticketType: { $ref: '#/components/schemas/TicketType' },
          price: { type: 'integer', description: 'Prix en centimes' },
          status: { type: 'string', enum: ['active', 'reserved', 'sold', 'withdrawn'] },
        },
      },
      Order: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          status: { type: 'string', enum: ['pending', 'paid', 'transferred', 'failed'] },
          amount: { type: 'integer', description: 'Montant en centimes' },
          ticketId: { type: 'string', nullable: true },
        },
      },
      HistoryEntry: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['attach', 'purchase', 'gift'] },
          at: { type: 'string', format: 'date-time' },
          from: { type: 'string', nullable: true },
          to: { type: 'string', nullable: true },
        },
      },
    },
    responses: {
      Unauthorized: errorResponse('Non authentifié (token absent/expiré)'),
      Forbidden: errorResponse('Interdit (rôle ou propriété insuffisants)'),
      NotFound: errorResponse('Ressource introuvable'),
      ValidationError: errorResponse('Entrée invalide'),
    },
  },
  paths: {
    // ---------------------------------------------------------------- Health
    '/live': {
      get: {
        tags: ['Health'],
        summary: 'Liveness — le processus tourne',
        responses: {
          200: {
            description: 'Vivant',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { status: { type: 'string', example: 'alive' } } },
              },
            },
          },
        },
      },
    },
    '/ready': {
      get: {
        tags: ['Health'],
        summary: 'Readiness — dépendances (DB, Redis, file) prêtes',
        responses: {
          200: { description: 'Prêt à recevoir du trafic' },
          503: { description: 'Dégradé (au moins une dépendance indisponible)' },
        },
      },
    },
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'État détaillé (version, uptime, dépendances)',
        responses: {
          200: { description: 'OK' },
          503: { description: 'Dégradé' },
        },
      },
    },
    '/metrics': {
      get: {
        tags: ['Health'],
        summary: 'Métriques Prometheus (format texte)',
        responses: { 200: { description: 'Exposition Prometheus', content: { 'text/plain': {} } } },
      },
    },

    // ------------------------------------------------------------------ Auth
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Créer un compte',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', format: 'password', minLength: 8 },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Compte créé',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } },
          },
          400: { $ref: '#/components/responses/ValidationError' },
          409: errorResponse('Email déjà utilisé (`EMAIL_TAKEN`)'),
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Se connecter',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', format: 'password' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Jetons + utilisateur',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthTokens' } } },
          },
          401: errorResponse('Identifiants invalides (`INVALID_CREDENTIALS`)'),
        },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Rafraîchir les jetons (rotation)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['refreshToken'],
                properties: { refreshToken: { type: 'string' } },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Nouveaux jetons',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { accessToken: { type: 'string' }, refreshToken: { type: 'string' } },
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Se déconnecter (révoque le refresh token)',
        security: bearer,
        responses: {
          204: { description: 'Déconnecté' },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Profil de l\'utilisateur courant',
        security: bearer,
        responses: {
          200: {
            description: 'Profil',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },

    // ---------------------------------------------------------------- Events
    '/events': {
      get: {
        tags: ['Events'],
        summary: 'Lister les événements (paginé)',
        parameters: [
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/Limit' },
          { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Recherche texte' },
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } },
        ],
        responses: {
          200: {
            description: 'Liste paginée',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/PaginationMeta' },
                    {
                      type: 'object',
                      properties: {
                        data: { type: 'array', items: { $ref: '#/components/schemas/Event' } },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Events'],
        summary: 'Créer un événement',
        description: 'Rôle **organizer** requis.',
        security: bearer,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'startsAt'],
                properties: {
                  name: { type: 'string' },
                  venue: { type: 'string' },
                  startsAt: { type: 'string', format: 'date-time' },
                  ticketTypes: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: { name: { type: 'string' }, faceValue: { type: 'integer' } },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Créé',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Event' } } },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/events/{id}': {
      get: {
        tags: ['Events'],
        summary: 'Détail d\'un événement (+ catégories)',
        parameters: [{ $ref: '#/components/parameters/IdPath' }],
        responses: {
          200: {
            description: 'Événement',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Event' } } },
          },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      put: {
        tags: ['Events'],
        summary: 'Modifier un événement',
        description: 'Rôle **organizer** propriétaire. Au moins un champ ; `venue: ""` efface le lieu.',
        security: bearer,
        parameters: [{ $ref: '#/components/parameters/IdPath' }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  venue: { type: 'string' },
                  startsAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Mis à jour',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Event' } } },
          },
          400: { $ref: '#/components/responses/ValidationError' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        tags: ['Events'],
        summary: 'Supprimer un événement',
        description: 'Rôle **organizer** propriétaire. Règles et catégories supprimées en cascade.',
        security: bearer,
        parameters: [{ $ref: '#/components/parameters/IdPath' }],
        responses: {
          204: { description: 'Supprimé' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
          409: errorResponse('Des billets sont rattachés (`EVENT_HAS_TICKETS`)'),
        },
      },
    },
    '/events/{id}/rules': {
      get: {
        tags: ['Events'],
        summary: 'Règles de revente applicables',
        parameters: [{ $ref: '#/components/parameters/IdPath' }],
        responses: {
          200: {
            description: 'Règles',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Rule' } } },
          },
        },
      },
      put: {
        tags: ['Events'],
        summary: 'Créer / modifier une règle (upsert)',
        description: 'Rôle **organizer** propriétaire. Upsert sur `(event, ticketType)`.',
        security: bearer,
        parameters: [{ $ref: '#/components/parameters/IdPath' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['priceCap'],
                properties: {
                  ticketTypeId: { type: 'string' },
                  priceCap: { type: 'integer', description: 'Plafond en centimes' },
                  resaleOpensAt: { type: 'string', format: 'date-time' },
                  resaleClosesAt: { type: 'string', format: 'date-time' },
                  commissionBps: { type: 'integer' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Règle enregistrée',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Rule' } } },
          },
          403: { $ref: '#/components/responses/Forbidden' },
          422: errorResponse('Fenêtre invalide (`INVALID_WINDOW`)'),
        },
      },
    },

    // --------------------------------------------------------------- Tickets
    '/tickets/me': {
      get: {
        tags: ['Tickets'],
        summary: 'Mes billets',
        security: bearer,
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/Limit' },
        ],
        responses: {
          200: {
            description: 'Liste paginée de billets',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/PaginationMeta' },
                    {
                      type: 'object',
                      properties: {
                        data: { type: 'array', items: { $ref: '#/components/schemas/Ticket' } },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/tickets/attach': {
      post: {
        tags: ['Tickets'],
        summary: 'Rattacher un billet possédé',
        security: bearer,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['eventRef', 'ticketRef'],
                properties: {
                  eventRef: { type: 'string', description: 'Référence billetterie externe' },
                  ticketRef: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Rattaché',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Ticket' } } },
          },
          409: errorResponse('Déjà rattaché / non disponible (`TICKET_ALREADY_ATTACHED`)'),
          422: errorResponse('Billet non éligible (`TICKET_NOT_ELIGIBLE`)'),
        },
      },
    },
    '/tickets/validate': {
      post: {
        tags: ['Tickets'],
        summary: 'Valider un QR à l\'entrée',
        description: 'Rôle **controller**. Renvoie toujours 200 avec un verdict `valid`.',
        security: bearer,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['qrCode'],
                properties: { qrCode: { type: 'string' } },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Verdict de contrôle',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    valid: { type: 'boolean' },
                    ticketId: { type: 'string' },
                    reason: {
                      type: 'string',
                      enum: ['ALREADY_USED', 'INVALIDATED', 'UNKNOWN'],
                      nullable: true,
                    },
                    owner: {
                      type: 'object',
                      nullable: true,
                      properties: { email: { type: 'string' }, name: { type: 'string' } },
                    },
                    history: { type: 'array', items: { $ref: '#/components/schemas/HistoryEntry' } },
                  },
                },
              },
            },
          },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/tickets/{id}': {
      get: {
        tags: ['Tickets'],
        summary: 'Détail d\'un billet (+ QR courant)',
        description: 'Propriétaire uniquement.',
        security: bearer,
        parameters: [{ $ref: '#/components/parameters/IdPath' }],
        responses: {
          200: {
            description: 'Billet',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Ticket' } } },
          },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/tickets/{id}/transfer': {
      post: {
        tags: ['Tickets'],
        summary: 'Transfert nominatif direct (don)',
        description:
          'Propriétaire du billet. Régénère le QR (ancien invalidé, `qrVersion` +1) et met à jour le porteur. Si l\'email correspond à un compte TrustPass, la propriété est réassignée.',
        security: bearer,
        parameters: [{ $ref: '#/components/parameters/IdPath' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email'],
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Transféré',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/Ticket' },
                    {
                      type: 'object',
                      properties: {
                        qrCode: { type: 'string' },
                        reassigned: { type: 'boolean' },
                      },
                    },
                  ],
                },
              },
            },
          },
          400: { $ref: '#/components/responses/ValidationError' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
          409: errorResponse('Billet non transférable (`TICKET_NOT_TRANSFERABLE`)'),
        },
      },
    },

    // -------------------------------------------------------------- Listings
    '/listings': {
      get: {
        tags: ['Listings'],
        summary: 'Lister les annonces actives',
        parameters: [
          { name: 'eventId', in: 'query', schema: { type: 'string' } },
          { name: 'ticketTypeId', in: 'query', schema: { type: 'string' } },
          { name: 'maxPrice', in: 'query', schema: { type: 'integer' } },
          { name: 'sort', in: 'query', schema: { type: 'string', enum: ['price', 'createdAt'] } },
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/Limit' },
        ],
        responses: {
          200: {
            description: 'Liste paginée d\'annonces',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/PaginationMeta' },
                    {
                      type: 'object',
                      properties: {
                        data: { type: 'array', items: { $ref: '#/components/schemas/Listing' } },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Listings'],
        summary: 'Publier une annonce',
        description: 'Propriétaire du billet (**seller**).',
        security: bearer,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['ticketId', 'price'],
                properties: {
                  ticketId: { type: 'string' },
                  price: { type: 'integer', description: 'Prix en centimes' },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Annonce active',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Listing' } } },
          },
          403: { $ref: '#/components/responses/Forbidden' },
          409: errorResponse('Billet non listable (`TICKET_NOT_LISTABLE`)'),
          422: errorResponse('Prix au-dessus du plafond ou hors fenêtre (`PRICE_ABOVE_CAP` / `RESALE_WINDOW_CLOSED`)'),
        },
      },
    },
    '/listings/mine': {
      get: {
        tags: ['Listings'],
        summary: 'Mes annonces (tous statuts)',
        security: bearer,
        responses: {
          200: {
            description: 'Liste',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Listing' } },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/listings/{id}': {
      get: {
        tags: ['Listings'],
        summary: 'Détail d\'une annonce',
        parameters: [{ $ref: '#/components/parameters/IdPath' }],
        responses: {
          200: {
            description: 'Annonce',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Listing' } } },
          },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        tags: ['Listings'],
        summary: 'Retirer une annonce',
        description: 'Propriétaire de l\'annonce. Le billet redevient `owned`.',
        security: bearer,
        parameters: [{ $ref: '#/components/parameters/IdPath' }],
        responses: {
          204: { description: 'Retirée' },
          403: { $ref: '#/components/responses/Forbidden' },
          409: errorResponse('Non retirable (`LISTING_NOT_WITHDRAWABLE`)'),
        },
      },
    },

    // ---------------------------------------------------------------- Orders
    '/orders': {
      post: {
        tags: ['Orders'],
        summary: 'Réserver une annonce et créer l\'intent de paiement',
        description: 'Pose un verrou Redis (TTL 10 min) et passe l\'annonce `reserved`.',
        security: bearer,
        parameters: [
          {
            name: 'Idempotency-Key',
            in: 'header',
            required: true,
            schema: { type: 'string', format: 'uuid' },
            description: 'Clé d\'idempotence (obligatoire).',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['listingId'],
                properties: { listingId: { type: 'string' } },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Réservée',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    orderId: { type: 'string' },
                    clientSecret: { type: 'string', nullable: true },
                    reservedUntil: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
          409: errorResponse('Annonce réservée / indisponible (`LISTING_RESERVED` / `LISTING_NOT_AVAILABLE`)'),
          422: errorResponse('Hors fenêtre de revente (`RESALE_WINDOW_CLOSED`)'),
        },
      },
    },
    '/orders/mine': {
      get: {
        tags: ['Orders'],
        summary: 'Mes achats (paginé)',
        security: bearer,
        parameters: [
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/Limit' },
        ],
        responses: {
          200: {
            description: 'Historique',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/PaginationMeta' },
                    {
                      type: 'object',
                      properties: {
                        data: { type: 'array', items: { $ref: '#/components/schemas/Order' } },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/orders/{id}': {
      get: {
        tags: ['Orders'],
        summary: 'État d\'une commande',
        security: bearer,
        parameters: [{ $ref: '#/components/parameters/IdPath' }],
        responses: {
          200: {
            description: 'Commande',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/Order' },
                    { type: 'object', properties: { newQr: { type: 'string', nullable: true } } },
                  ],
                },
              },
            },
          },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/orders/{id}/finalize': {
      post: {
        tags: ['Orders'],
        summary: 'Finaliser une commande',
        description: 'Confirme la commande après retour du paiement.',
        security: bearer,
        parameters: [{ $ref: '#/components/parameters/IdPath' }],
        responses: {
          200: {
            description: 'Finalisée',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Order' } } },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/orders/{id}/simulate-pay': {
      post: {
        tags: ['Orders'],
        summary: 'Simuler un paiement réussi (démo/dev)',
        description:
          'Déclenche le transfert atomique comme le ferait `payment_intent.succeeded`. Refusé si Stripe est actif.',
        security: bearer,
        parameters: [{ $ref: '#/components/parameters/IdPath' }],
        responses: {
          200: {
            description: 'Payée et transférée',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Order' } } },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          404: { $ref: '#/components/responses/NotFound' },
          409: errorResponse('Stripe actif — simulation refusée'),
        },
      },
    },

    // -------------------------------------------------------------- Webhooks
    '/webhooks/stripe': {
      post: {
        tags: ['Webhooks'],
        summary: 'Webhook de paiement Stripe (source de vérité)',
        description:
          'Corps brut requis (`application/json`), signature vérifiée via l\'en-tête `Stripe-Signature`. Idempotent.',
        parameters: [
          { name: 'Stripe-Signature', in: 'header', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } },
        },
        responses: {
          200: {
            description: 'Reçu',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { received: { type: 'boolean' } } },
              },
            },
          },
          400: errorResponse('Signature invalide (`INVALID_SIGNATURE`)'),
        },
      },
    },

    // ------------------------------------------------------------- Organizer
    '/organizer/controllers': {
      get: {
        tags: ['Organizer'],
        summary: 'Lister les comptes contrôleur',
        security: bearer,
        responses: {
          200: { description: 'Liste des contrôleurs' },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
      post: {
        tags: ['Organizer'],
        summary: 'Créer un compte contrôleur',
        security: bearer,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  name: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Créé' },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/organizer/controllers/{id}': {
      delete: {
        tags: ['Organizer'],
        summary: 'Révoquer un compte contrôleur',
        security: bearer,
        parameters: [{ $ref: '#/components/parameters/IdPath' }],
        responses: {
          200: { description: 'Révoqué' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/organizer/events': {
      get: {
        tags: ['Organizer'],
        summary: 'Mes événements (organisateur)',
        security: bearer,
        responses: {
          200: {
            description: 'Liste',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Event' } },
              },
            },
          },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/organizer/events/{id}/stats': {
      get: {
        tags: ['Organizer'],
        summary: 'Statistiques de revente d\'un événement',
        security: bearer,
        parameters: [{ $ref: '#/components/parameters/IdPath' }],
        responses: {
          200: {
            description: 'Statistiques',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    resaleCount: { type: 'integer' },
                    avgPrice: { type: 'number' },
                    resaleRate: { type: 'number' },
                    recentActivity: { type: 'array', items: { type: 'object', additionalProperties: true } },
                  },
                },
              },
            },
          },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/organizer/events/{id}/tickets': {
      get: {
        tags: ['Organizer'],
        summary: 'Billets d\'un événement (suivi)',
        security: bearer,
        parameters: [{ $ref: '#/components/parameters/IdPath' }],
        responses: {
          200: { description: 'Liste de billets avec propriétaire et nombre de transferts' },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/organizer/tickets/{id}/history': {
      get: {
        tags: ['Organizer'],
        summary: 'Historique de possession d\'un billet',
        security: bearer,
        parameters: [{ $ref: '#/components/parameters/IdPath' }],
        responses: {
          200: {
            description: 'Billet + historique ordonné',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ticket: { $ref: '#/components/schemas/Ticket' },
                    history: { type: 'array', items: { $ref: '#/components/schemas/HistoryEntry' } },
                  },
                },
              },
            },
          },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
  },
} as const;
