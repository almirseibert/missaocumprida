-- Novos tipos de notificação (arquivo próprio: valores novos de enum não
-- podem ser usados na mesma transação em que são criados).
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'VERIFIED_PRO';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ORDER_UPDATED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ORDER_CANCELLED';
