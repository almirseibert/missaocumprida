'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { api } from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { PageSpinner } from '@/components/ui/Spinner'
import toast from 'react-hot-toast'
import { Wallet, ArrowDownCircle, Key } from 'lucide-react'
import type { BalanceData, ProviderWithdrawal, PixKeyType } from '@/types'

// ---------------------------------------------------------------------------
// Labels e cores
// ---------------------------------------------------------------------------
const withdrawalStatusLabel: Record<string, string> = {
  REQUESTED: 'Solicitado',
  PROCESSING: 'Em processamento',
  PAID: 'Pago',
  REJECTED: 'Rejeitado',
}

const withdrawalStatusColor: Record<string, 'amber' | 'blue' | 'green' | 'red' | 'gray'> = {
  REQUESTED: 'amber',
  PROCESSING: 'blue',
  PAID: 'green',
  REJECTED: 'red',
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
const withdrawSchema = z.object({
  amount: z.coerce.number().positive('Valor inválido').min(10, 'Valor mínimo: R$ 10,00'),
  pix_key: z.string().min(5, 'Chave PIX inválida'),
  pix_key_type: z.enum(['CPF', 'CNPJ', 'EMAIL', 'PHONE', 'RANDOM']),
})

const pixSchema = z.object({
  pix_key: z.string().min(5, 'Chave PIX inválida'),
  pix_key_type: z.enum(['CPF', 'CNPJ', 'EMAIL', 'PHONE', 'RANDOM']),
})

type WithdrawForm = z.infer<typeof withdrawSchema>
type PixForm = z.infer<typeof pixSchema>

const pixKeyTypeOptions = [
  { value: 'CPF', label: 'CPF' },
  { value: 'CNPJ', label: 'CNPJ' },
  { value: 'EMAIL', label: 'E-mail' },
  { value: 'PHONE', label: 'Telefone' },
  { value: 'RANDOM', label: 'Chave aleatória' },
]

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
export default function CarteiraPage() {
  const [balance, setBalance] = useState<BalanceData | null>(null)
  const [withdrawals, setWithdrawals] = useState<ProviderWithdrawal[]>([])
  const [loading, setLoading] = useState(true)
  const [showWithdrawForm, setShowWithdrawForm] = useState(false)
  const [showPixForm, setShowPixForm] = useState(false)

  const withdrawForm = useForm<WithdrawForm>({ resolver: zodResolver(withdrawSchema) })
  const pixForm = useForm<PixForm>({ resolver: zodResolver(pixSchema) })

  async function loadData() {
    try {
      const [balRes, wdRes] = await Promise.all([
        api.get('/payments/my-balance'),
        api.get('/payments/withdrawals'),
      ])
      setBalance(balRes.data.data)
      setWithdrawals(wdRes.data.data)

      if (balRes.data.data.pix_key) {
        pixForm.setValue('pix_key', balRes.data.data.pix_key)
        pixForm.setValue('pix_key_type', balRes.data.data.pix_key_type as PixKeyType)
        withdrawForm.setValue('pix_key', balRes.data.data.pix_key)
        withdrawForm.setValue('pix_key_type', balRes.data.data.pix_key_type as PixKeyType)
      }
    } catch {
      toast.error('Erro ao carregar carteira')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  async function onWithdraw(data: WithdrawForm) {
    try {
      await api.post('/payments/withdrawal', data)
      toast.success('Solicitação de saque enviada!')
      setShowWithdrawForm(false)
      withdrawForm.reset()
      loadData()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Erro ao solicitar saque')
    }
  }

  async function onSavePix(data: PixForm) {
    try {
      await api.put('/payments/pix-key', data)
      toast.success('Chave PIX salva!')
      setShowPixForm(false)
      loadData()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Erro ao salvar chave PIX')
    }
  }

  if (loading) return <PageSpinner />

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 space-y-6">
      <h1 className="text-2xl font-bold text-slate2-800 flex items-center gap-2">
        <Wallet className="w-6 h-6" />
        Minha Carteira
      </h1>

      {/* Saldo disponível */}
      <Card>
        <CardBody>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate2-500">Saldo disponível para saque</p>
              <p className="text-4xl font-bold text-green-600 mt-1">
                {formatCurrency(balance?.available_balance ?? 0)}
              </p>
            </div>
            <Button
              onClick={() => {
                if (balance?.available_balance) {
                  withdrawForm.setValue('amount', Number(balance.available_balance.toFixed(2)))
                }
                setShowWithdrawForm(true)
              }}
              disabled={!balance?.available_balance || balance.available_balance < 10}
              className="flex items-center gap-2"
            >
              <ArrowDownCircle className="w-4 h-4" />
              Sacar via PIX
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Chave PIX cadastrada */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate2-700 flex items-center gap-2">
              <Key className="w-4 h-4" />
              Chave PIX para recebimento
            </h2>
            <Button variant="outline" size="sm" onClick={() => setShowPixForm(!showPixForm)}>
              {balance?.pix_key ? 'Alterar' : 'Cadastrar'}
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          {balance?.pix_key ? (
            <div className="text-sm">
              <span className="text-slate2-500">Tipo: </span>
              <span className="font-medium">{pixKeyTypeOptions.find(o => o.value === balance.pix_key_type)?.label}</span>
              <span className="text-slate2-400 mx-2">|</span>
              <span className="font-mono">{balance.pix_key}</span>
            </div>
          ) : (
            <p className="text-sm text-slate2-400">Nenhuma chave PIX cadastrada. Cadastre para poder sacar.</p>
          )}

          {showPixForm && (
            <form onSubmit={pixForm.handleSubmit(onSavePix)} className="mt-4 space-y-3 border-t pt-4">
              <Select
                label="Tipo de chave PIX"
                options={pixKeyTypeOptions}
                error={pixForm.formState.errors.pix_key_type?.message}
                {...pixForm.register('pix_key_type')}
              />
              <Input
                label="Chave PIX"
                placeholder="Informe sua chave PIX"
                error={pixForm.formState.errors.pix_key?.message}
                {...pixForm.register('pix_key')}
              />
              <div className="flex gap-2">
                <Button type="submit" isLoading={pixForm.formState.isSubmitting}>Salvar</Button>
                <Button type="button" variant="outline" onClick={() => setShowPixForm(false)}>Cancelar</Button>
              </div>
            </form>
          )}
        </CardBody>
      </Card>

      {/* Formulário de saque */}
      {showWithdrawForm && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-slate2-700">Solicitar saque</h2>
          </CardHeader>
          <CardBody>
            <form onSubmit={withdrawForm.handleSubmit(onWithdraw)} className="space-y-4">
              <Input
                label={`Valor (disponível: ${formatCurrency(balance?.available_balance ?? 0)})`}
                type="number"
                step="0.01"
                placeholder="0,00"
                error={withdrawForm.formState.errors.amount?.message}
                {...withdrawForm.register('amount')}
              />
              <Select
                label="Tipo de chave PIX"
                options={pixKeyTypeOptions}
                error={withdrawForm.formState.errors.pix_key_type?.message}
                {...withdrawForm.register('pix_key_type')}
              />
              <Input
                label="Chave PIX"
                placeholder="Informe sua chave PIX"
                error={withdrawForm.formState.errors.pix_key?.message}
                {...withdrawForm.register('pix_key')}
              />
              <p className="text-xs text-slate2-500">
                Saques são processados em até 7 dias úteis. Valor mínimo: R$ 10,00.
              </p>
              <div className="flex gap-2">
                <Button type="submit" isLoading={withdrawForm.formState.isSubmitting}>Solicitar saque</Button>
                <Button type="button" variant="outline" onClick={() => setShowWithdrawForm(false)}>Cancelar</Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      {/* Histórico de saques */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-slate2-700">Histórico de saques</h2>
        </CardHeader>
        <CardBody>
          {withdrawals.length === 0 ? (
            <p className="text-sm text-slate2-400 text-center py-4">Nenhum saque solicitado ainda.</p>
          ) : (
            <div className="space-y-3">
              {withdrawals.map((w) => (
                <div key={w.id} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                  <div>
                    <p className="font-medium text-slate2-800">{formatCurrency(w.amount)}</p>
                    <p className="text-xs text-slate2-500">
                      {pixKeyTypeOptions.find(o => o.value === w.pix_key_type)?.label}: {w.pix_key}
                    </p>
                    <p className="text-xs text-slate2-400">{formatDate(w.created_at)}</p>
                    {w.notes && <p className="text-xs text-slate2-500 italic mt-1">{w.notes}</p>}
                  </div>
                  <Badge variant={withdrawalStatusColor[w.status] ?? 'gray'}>
                    {withdrawalStatusLabel[w.status] ?? w.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
