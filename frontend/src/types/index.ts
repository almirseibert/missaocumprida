export type UserRole = 'CLIENT' | 'PROVIDER' | 'BOTH' | 'ADMIN'

export type OrderStatus =
  | 'OPEN'
  | 'IN_PROPOSAL'
  | 'ACCEPTED'
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'DONE'
  | 'RATED'
  | 'CANCELLED'
  | 'DISPUTED'

export type ProposalStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED'
export type ScheduleStatus = 'CONFIRMED' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED'
export type FieldType = 'TEXT' | 'TEXTAREA' | 'SELECT' | 'RADIO' | 'BOOLEAN' | 'PHOTO' | 'NUMBER' | 'DATE'
export type ReviewerRole = 'CLIENT' | 'PROVIDER'
export type PaymentStatus = 'PENDING' | 'PAID' | 'RELEASED' | 'REFUNDED' | 'FAILED'
export type WithdrawalStatus = 'REQUESTED' | 'PROCESSING' | 'PAID' | 'REJECTED'
export type PixKeyType = 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'RANDOM'

export interface User {
  id: string
  name: string
  email: string
  phone?: string
  role: UserRole
  avatar?: string
  bio?: string
  document_verified: boolean
  rating_avg: number
  rating_count: number
  latitude?: number | null
  longitude?: number | null
  is_active: boolean
  created_at: string
  skills?: ProviderSkill[]
}

export interface ServiceGroup {
  id: string
  name: string
  slug: string
  icon: string
  description?: string
  categories: Category[]
}

export interface Category {
  id: string
  group_id: string
  name: string
  slug: string
  icon: string
  description?: string
  base_price_min: number
  base_price_max: number
  requires_photos: boolean
  estimated_hours?: number
  is_active: boolean
}

export interface QuestionnaireField {
  id: string
  category_id: string
  question: string
  field_type: FieldType
  options?: string[]
  placeholder?: string
  is_required: boolean
  order: number
  affects_price: boolean
  help_text?: string
}

export interface ProviderSkill {
  id: string
  provider_id: string
  category_id: string
  years_experience?: number
  certification?: string
  service_radius_km?: number
  hourly_rate?: number
  is_active: boolean
  category?: Category
}

export interface Order {
  id: string
  client_id: string
  category_id: string
  title: string
  description?: string
  answers: Record<string, string>
  photos: string[]
  status: OrderStatus
  desired_date?: string
  address?: string | null
  neighborhood?: string | null
  city?: string
  state?: string
  latitude?: number | null
  longitude?: number | null
  location_blurred?: boolean
  estimated_price_min?: number
  estimated_price_max?: number
  final_price?: number
  platform_fee_pct?: number
  platform_fee_value?: number
  provider_amount?: number
  client_fee_pct?: number
  client_fee_value?: number
  client_total?: number
  stripe_payment_intent_id?: string
  distance_km?: number | null
  created_at: string
  category?: Category
  client?: User
  proposals?: Proposal[]
  payment?: Payment
}

export interface Proposal {
  id: string
  order_id: string
  provider_id: string
  value: number
  message?: string
  status: ProposalStatus
  created_at: string
  provider?: User
  order?: Order
}

export interface Schedule {
  id: string
  order_id: string
  proposal_id: string
  provider_id: string
  client_id: string
  scheduled_at: string
  checkin_at?: string
  done_at?: string
  status: ScheduleStatus
  order?: Order
  provider?: User
  client?: User
  messages?: Message[]
}

export interface Message {
  id: string
  schedule_id: string
  sender_id: string
  content: string
  photo_url?: string
  is_read: boolean
  created_at: string
  sender?: User
}

export interface Rating {
  id: string
  schedule_id: string
  reviewer_id: string
  reviewed_id: string
  score: number
  comment?: string
  reviewer_role: ReviewerRole
  created_at: string
  reviewer?: User
}

export interface Payment {
  id: string
  order_id: string
  client_id: string
  provider_id: string
  stripe_payment_intent: string
  amount: number
  provider_amount: number
  platform_fee: number
  status: PaymentStatus
  paid_at?: string
  released_at?: string
  created_at: string
}

export interface ProviderWithdrawal {
  id: string
  provider_id: string
  amount: number
  pix_key: string
  pix_key_type: PixKeyType
  status: WithdrawalStatus
  processed_at?: string
  notes?: string
  created_at: string
}

export interface BalanceData {
  available_balance: number
  pix_key?: string
  pix_key_type?: PixKeyType
  total_released: number
  recent_withdrawals: ProviderWithdrawal[]
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}
