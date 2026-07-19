import React from 'react'

// Renderizador de markdown mínimo para os documentos legais (termos, privacidade).
// Suporta: ## / ### (títulos), **negrito**, listas com "-", tabelas com "|" e
// parágrafos. Suficiente para textos jurídicos servidos pelo backend.

function renderInline(text: string, keyBase: string): React.ReactNode[] {
  // Divide em trechos **negrito** preservando o resto.
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) {
      return <strong key={`${keyBase}-b${i}`}>{p.slice(2, -2)}</strong>
    }
    return <React.Fragment key={`${keyBase}-t${i}`}>{p}</React.Fragment>
  })
}

export function renderMarkdown(md: string): React.ReactNode[] {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const out: React.ReactNode[] = []
  let i = 0
  let key = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    // Linha em branco
    if (trimmed === '') { i++; continue }

    // Títulos
    if (trimmed.startsWith('### ')) {
      out.push(<h3 key={key++} className="text-lg font-semibold mt-6 mb-2 text-slate-900">{renderInline(trimmed.slice(4), `h3${key}`)}</h3>)
      i++; continue
    }
    if (trimmed.startsWith('## ')) {
      out.push(<h2 key={key++} className="text-xl font-bold mt-8 mb-3 text-slate-900">{renderInline(trimmed.slice(3), `h2${key}`)}</h2>)
      i++; continue
    }

    // Tabela (linhas iniciando com |)
    if (trimmed.startsWith('|')) {
      const rows: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) { rows.push(lines[i].trim()); i++ }
      const parseRow = (r: string) => r.slice(1, r.endsWith('|') ? -1 : undefined).split('|').map((c) => c.trim())
      const header = parseRow(rows[0])
      const bodyRows = rows.slice(1).filter((r) => !/^\|[\s|:-]+\|?$/.test(r)).map(parseRow)
      out.push(
        <table key={key++} className="w-full text-sm my-4 border-collapse">
          <thead>
            <tr>{header.map((h, hi) => <th key={hi} className="border border-slate-200 bg-slate-50 px-3 py-2 text-left font-semibold">{renderInline(h, `th${key}-${hi}`)}</th>)}</tr>
          </thead>
          <tbody>
            {bodyRows.map((cols, ri) => (
              <tr key={ri}>{cols.map((c, ci) => <td key={ci} className="border border-slate-200 px-3 py-2 align-top">{renderInline(c, `td${key}-${ri}-${ci}`)}</td>)}</tr>
            ))}
          </tbody>
        </table>,
      )
      continue
    }

    // Lista
    if (trimmed.startsWith('- ')) {
      const items: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('- ')) { items.push(lines[i].trim().slice(2)); i++ }
      out.push(
        <ul key={key++} className="list-disc pl-6 my-3 space-y-1 text-slate-700">
          {items.map((it, ii) => <li key={ii}>{renderInline(it, `li${key}-${ii}`)}</li>)}
        </ul>,
      )
      continue
    }

    // Parágrafo (agrupa linhas contíguas)
    const paragraph: string[] = []
    while (i < lines.length && lines[i].trim() !== '' && !/^\s*(#{2,3}\s|-\s|\|)/.test(lines[i])) {
      paragraph.push(lines[i].trim()); i++
    }
    out.push(<p key={key++} className="my-3 text-slate-700 leading-relaxed">{renderInline(paragraph.join(' '), `p${key}`)}</p>)
  }

  return out
}
