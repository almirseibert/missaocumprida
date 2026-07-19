/**
 * Antibypass (Remap 2.0 — Taxa de Conexão): remove dados de contato de textos
 * que chegam à outra parte ANTES do pagamento das taxas (ex.: mensagem da
 * proposta). Telefones BR, e-mails, @handles e links são mascarados.
 */

const PATTERNS: RegExp[] = [
  // Telefones BR: +55 (11) 99999-9999, 11999999999, 9 9999-9999 etc.
  /(?:\+?55[\s.-]?)?(?:\(?\d{2}\)?[\s.-]?)?(?:9[\s.-]?)?\d{4}[\s.-]?\d{4}\b/g,
  // E-mails
  /[\w.+-]+@[\w-]+\.[\w.-]+/g,
  // Handles de rede social (@usuario) — exige 3+ chars para evitar falso positivo
  /@[A-Za-z0-9_.]{3,}/g,
  // Links
  /(?:https?:\/\/|www\.)\S+/gi,
  // Menções explícitas a apps de contato seguidas de qualquer coisa curta
  /\b(?:whats(?:app)?|zap|telegram|insta(?:gram)?)\b[\s:]*[\w@().-]{0,20}/gi,
]

export function sanitizeContactInfo(text: string): string {
  let out = text
  for (const pattern of PATTERNS) {
    out = out.replace(pattern, '[removido]')
  }
  return out
}
