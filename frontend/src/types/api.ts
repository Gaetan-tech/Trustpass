// Types miroir de docs/API_CONTRACT.md. Montants en centimes.

export type UserRole = 'buyer' | 'seller' | 'organizer' | 'controller' | 'admin';

export interface User {
  id: string;
  email: string;
  role: UserRole;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface EventSummary {
  id: string;
  name: string;
  venue?: string;
  startsAt: string;
  imageUrl?: string;
}

export interface Listing {
  id: string;
  event: EventSummary;
  ticketType?: { id: string; name: string };
  price: number; // centimes
}

export interface Ticket {
  id: string;
  event: EventSummary;
  ticketType?: { id: string; name: string };
  status: 'owned' | 'listed' | 'reserved' | 'sold' | 'used' | 'invalidated';
  qrVersion: number;
  reference?: string;
  holderName?: string;
  holderEmail?: string;
}

export interface TransferTicketResponse extends Ticket {
  qrCode: string;
  reassigned: boolean; // true si le destinataire avait un compte (propriété réassignée)
}

export type OrderStatus = 'pending' | 'paid' | 'transferred' | 'failed' | 'refunded';

export interface CreateOrderResponse {
  orderId: string;
  clientSecret: string | null;
  checkoutUrl: string | null; // URL de la page Stripe Checkout (redirection)
  reservedUntil: string | null;
  idempotentReplay?: boolean;
}

export interface OrderStatusResponse {
  id: string;
  status: OrderStatus;
  amount: number;
  ticketId?: string;
  newQr?: string;
}

export interface Paginated<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
}

export interface EventDetail {
  id: string;
  name: string;
  venue?: string;
  startsAt: string;
  imageUrl?: string;
  ticketTypes: { id: string; name: string; faceValue: number }[];
}

export interface EventRules {
  priceCap: number | null;
  resaleOpensAt: string | null;
  resaleClosesAt: string | null;
  byTicketType: { ticketTypeId: string; priceCap: number }[];
}

export interface EventStats {
  resaleCount: number;
  avgPrice: number; // centimes
  resaleRate: number; // 0..1
  totalListings: number;
  soldListings: number;
  recentActivity: { id: string; createdAt: string; ticketId: string; toUserId: string }[];
}

export interface HistoryEntry {
  type: 'attach' | 'purchase' | 'gift';
  at: string;
  from?: string; // possesseur précédent (email)
  to?: string; // nouveau possesseur (email, ou « Nom (email) » si nominatif)
}

export interface TicketOwner {
  email: string;
  name: string | null; // nom du porteur nominatif si défini
}

export type ValidateResponse =
  | { valid: true; ticketId: string; event: { id: string; name: string }; owner?: TicketOwner; history?: HistoryEntry[] }
  | { valid: false; reason: 'ALREADY_USED' | 'INVALIDATED' | 'UNKNOWN'; owner?: TicketOwner; history?: HistoryEntry[] };

// Historique complet d'un billet (vue organisateur).
export interface TicketHistory {
  ticket: {
    id: string;
    status: string;
    qrVersion: number;
    reference?: string;
    holderName?: string;
    holderEmail?: string;
    currentOwner: { id: string; email: string };
    event: { id: string; name: string; venue?: string; startsAt: string };
    ticketType?: { id: string; name: string };
  };
  history: HistoryEntry[];
}

export interface OrganizerTicketSummary {
  id: string;
  status: string;
  qrVersion: number;
  reference?: string;
  holderName?: string;
  ticketType?: string;
  ownerEmail: string;
  transfersCount: number;
}

export interface CreateEventInput {
  name: string;
  venue?: string;
  startsAt: string;
  imageUrl?: string;
  ticketTypes?: { name: string; faceValue: number }[];
}

export interface UpdateEventInput {
  name?: string;
  venue?: string;
  startsAt?: string;
  imageUrl?: string;
}

export interface ApiError {
  error: { code: string; message: string; details?: unknown };
}
