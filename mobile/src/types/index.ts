export type UserRole = 'CLIENT' | 'PROVIDER' | 'BOTH' | 'ADMIN'
export type OrderStatus =
  | 'OPEN' | 'IN_PROPOSAL' | 'ACCEPTED' | 'SCHEDULED'
  | 'IN_PROGRESS' | 'DONE' | 'RATED' | 'CANCELLED' | 'DISPUTED'
export type ProposalStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED'
export type ScheduleStatus = 'CONFIRMED' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED'
export type PaymentStatus = 'PENDING' | 'PAID' | 'RELEASED' | 'REFUNDED' | 'FAILED'

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
  rating_avg: number
  rating_count: number
  latitude?: number | null
  longitude?: number | null
  is_active: boolean
  created_at: string
  pix_key?: string
  pix_key_type?: string
  provider_balance?: number
}

export interface Category {
  id: string
  name: string
  slug: string
  group: string
  icon: string
  description?: string
  base_price_min: number
  base_price_max: number
}

export interface ServiceGroup {
  id: string
  name: string
  icon: string
  categories: Category[]
}

export interface Order {
  id: string
  client_id: string
  category_id: string
  title: string
  description?: string
  status: OrderStatus
  address?: string
  neighborhood?: string
  city?: string
  state?: string
  latitude?: number
  longitude?: number
  desired_date?: string
  estimated_price_min?: number
  estimated_price_max?: number
  final_price?: number
  client_total?: number
  provider_amount?: number
  platform_fee_value?: number
  client_fee_value?: number
  photos?: string[]
  created_at: string
  category?: Category
  client?: User
  distance_km?: number
}

export interface Proposal {
  id: string
  order_id: string
  provider_id: string
  value: number
  message: string
  status: ProposalStatus
  created_at: string
  provider?: User
}

export interface Schedule {
  id: string
  order_id: string
  provider_id: string
  client_id: string
  scheduled_at: string
  checkin_at?: string
  done_at?: string
  status: ScheduleStatus
  photos?: string[]
  order?: Order
  provider?: User
  client?: User
}

export interface Message {
  id: string
  schedule_id: string
  sender_id: string
  content: string
  type: string
  read: boolean
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
  reviewer_role: 'CLIENT' | 'PROVIDER'
  created_at: string
  reviewer?: User
}

export interface Payment {
  id: string
  order_id: string
  status: PaymentStatus
  amount: number
  payment_method?: string
  paid_at?: string
}

export interface Notification {
  id: string
  user_id: string
  title: string
  body: string
  type: string
  read: boolean
  data?: Record<string, string>
  created_at: string
}
