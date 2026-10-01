export default async function EmBreve({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return (
    <div className="rounded-2xl border border-dashed border-line p-10 text-center">
      <h1 className="text-xl font-semibold capitalize">{slug.replace(/-/g, ' ')}</h1>
      <p className="mt-2 text-muted">Esta área será construída nas próximas fases.</p>
    </div>
  )
}
