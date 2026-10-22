// A small CSV reader for the nflverse files: quoted fields, embedded commas
// and newlines, gzip by extension. Returns rows as objects keyed by header.
import fs from 'node:fs'
import zlib from 'node:zlib'

export function readCsv(file) {
  let text = fs.readFileSync(file)
  if (file.endsWith('.gz')) text = zlib.gunzipSync(text)
  text = text.toString('utf8')
  const rows = []
  let header = null
  let field = ''
  let row = []
  let q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else q = false
      } else field += c
    } else if (c === '"') q = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      if (header == null) header = row
      else if (row.length > 1 || row[0] !== '') {
        const o = {}
        for (let k = 0; k < header.length; k++) o[header[k]] = row[k] ?? ''
        rows.push(o)
      }
      row = []
    } else field += c
  }
  if (field !== '' || row.length) {
    row.push(field)
    if (header != null) { const o = {}; for (let k = 0; k < header.length; k++) o[header[k]] = row[k] ?? ''; rows.push(o) }
  }
  return rows
}
