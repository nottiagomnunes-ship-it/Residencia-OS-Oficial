'use client'
/** Marca (ou desmarca) todas as caixinhas das questões desta página que pertencem ao formulário `form`. */
export default function MarcarTodas({ form }: { form: string }) {
  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      <input type="checkbox" className="size-4 accent-brand" onChange={e => {
        document.querySelectorAll<HTMLInputElement>(`input[type=checkbox][name=sel][form="${form}"]`).forEach(c => { c.checked = e.target.checked })
      }} />Marcar todas desta página</label>)
}
