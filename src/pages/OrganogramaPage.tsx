/**
 * OrganogramaPage — módulo standalone de organograma organizacional.
 * Embute o arquivo autocontido public/organograma.html (persistência em
 * localStorage, sem integração com as collections do ATS) em iframe
 * ocupando a área útil inteira.
 */
export default function OrganogramaPage() {
  return (
    <div className="w-full h-full -m-4 md:-m-8">
      <iframe
        src="/organograma.html"
        title="Organograma Organizacional"
        className="w-full border-0"
        style={{ height: 'calc(100vh - 56px)', minHeight: 'calc(100vh - 56px)' }}
      />
    </div>
  )
}
