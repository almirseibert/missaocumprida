import { api } from './api'

/** Baixa um arquivo de rota autenticada (ex.: dossiê CSV do admin). */
export async function downloadAuthed(path: string, filename: string): Promise<void> {
  const res = await api.get(path, { responseType: 'blob' })
  const url = URL.createObjectURL(res.data as Blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
