/**
 * OrganogramaPage — módulo standalone de organograma organizacional.
 * Embute o arquivo autocontido public/organograma.html em iframe ocupando a
 * área útil inteira. A URL do backend (PocketBase) é passada via querystring
 * (?api=...): o iframe é servido na origem do app (estático, sem proxy /api),
 * e o HTML usa ?api para saber onde gravar os nós (org_nodes) e criar vagas.
 */
export default function OrganogramaPage() {
  const api = (import.meta.env.VITE_POCKETBASE_URL || '').replace(/\/+$/, '')
  const src = api ? `/organograma.html?api=${encodeURIComponent(api)}` : '/organograma.html'
  return (
    <div className="w-full h-full -m-4 md:-m-8">
      <iframe
        src={src}
        title="Organograma Organizacional"
        className="w-full border-0"
        style={{ height: 'calc(100vh - 56px)', minHeight: 'calc(100vh - 56px)' }}
      />
    </div>
  )
}
