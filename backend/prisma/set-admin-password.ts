// Rotaciona a senha do usuário admin em produção sem embutir segredo no código.
// Uso:
//   ADMIN_EMAIL=admin@missaocumprida.com.br ADMIN_PASSWORD='<senha-forte>' npx tsx prisma/set-admin-password.ts
// (ou defina as envs no EasyPanel e rode: npm run db:set-admin)
//
// Se o admin não existir, ele é criado. Se existir, apenas a senha é atualizada.

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const email = process.env.ADMIN_EMAIL || 'admin@missaocumprida.com.br'
  const password = process.env.ADMIN_PASSWORD
  if (!password || password.length < 10) {
    throw new Error('Defina ADMIN_PASSWORD (mínimo 10 caracteres) antes de rodar.')
  }
  const hash = await bcrypt.hash(password, 10)
  const user = await prisma.user.upsert({
    where: { email },
    update: { password: hash, role: 'ADMIN', is_active: true },
    create: { name: 'Administrador', email, password: hash, role: 'ADMIN', document_verified: true },
    select: { id: true, email: true },
  })
  console.log(`✅ Senha do admin (${user.email}) definida com sucesso.`)
}

main()
  .catch((e) => { console.error('❌', e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
