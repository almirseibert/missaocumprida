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
  cpf?: string
  role: UserRole
  avatar?: string
  bio?: string
  document_verified: boolean
  is_verified_pro?: boolean
  verified_pro_since?: string | null
  verified_pro_expires?: string | null
  rating_avg: number
  rating_count: number
  latitude?: number | null
  longitude?: number | null
  is_active: boolean
  created_at: string
  skills?: ProviderSkill[]
  provider_balance?: number
  pix_key?: string | null
  pix_key_type?: PixKeyType | null
  hourly_rate?: number | null
  stripe_customer_id?: string | null
  rg?: string | null
  birth_date?: string | null
  mother_name?: string | null
  address_zip?: string | null
  address_street?: string | null
  address_number?: string | null
  address_complement?: string | null
  address_neighborhood?: string | null
  address_city?: string | null
  address_state?: string | null
  emergency_contact_name?: string | null
  emergency_contact_phone?: string | null
  no_show_count?: number
  suspended_until?: string | null
  terms_accepted_at?: string | null
  terms_version?: string | null
  document_photo_url?: string | null
  selfie_photo_url?: string | null
  document_submitted_at?: string | null
  document_verification_status?: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED'
  document_rejection_reason?: string | null
  document_reviewed_at?: string | null
  onboarding_state?: Record<string, OnboardingFlowState>
  notification_preferences?: Record<string, boolean>
  referral_code?: string | null
  referred_by_id?: string | null
  credit_balance?: number
}

export interface OnboardingFlowState {
  step?: number
  completed?: boolean
  completed_at?: string
  data?: Record<string, unknown>
}

export interface ServicePackage {
  id: string
  title: string
  description: string
  price: number
  duration_min: number
  includes: string[]
  photos: string[]
  is_active: boolean
  purchases_count: number
  rating_avg: number
  created_at: string
  category: { id: string; name: string; slug: string; icon: string }
  provider: {
    id: string
    name: string
    avatar: string | null
    bio: string | null
    rating_avg: number
    rating_count: number
    is_verified_pro?: boolean
    latitude?: number | null
    longitude?: number | null
  }
  distance_km?: number | null
  is_pro_highlighted?: boolean
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
  is_urgent?: boolean
  urgency_fee_pct?: number | null
  urgency_fee_value?: number | null
  urgency_deadline?: string | null
  urgency_radius_km?: number | null
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
  boost_level?: number
  boost_paid_at?: string | null
  boost_value?: number | null
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
  checkin_photo_url?: string
  checkin_lat?: number
  checkin_lng?: number
  checkin_address?: string
  done_at?: string
  complete_photo_url?: string
  complete_lat?: number
  complete_lng?: number
  complete_address?: string
  duration_minutes?: number
  hourly_amount?: number
  status: ScheduleStatus
  order?: Order
  provider?: User & { hourly_rate?: number }
  client?: User
  messages?: Message[]
}

export interface Notification {
  id: string
  type: string
  title: string
  body: string
  data?: Record<string, string>
  read: boolean
  created_at: string
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
