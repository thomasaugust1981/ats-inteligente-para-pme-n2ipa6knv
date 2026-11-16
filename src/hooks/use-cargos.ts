import { useEffect, useState } from 'react'
import { cargosService } from '@/services/cargos'
import type { Cargo } from '@/types/ats'

/**
 * Lista de cargos da organização (FASE 1 CHA) — usada pelo formulário de vaga
 * e pela validação de publicação.
 */
export function useCargos(): { cargos: Cargo[]; loading: boolean } {
  const [cargos, setCargos] = useState<Cargo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const list = await cargosService.listCargos()
        if (alive) setCargos(list)
      } catch (err) {
        console.error('Erro ao carregar cargos:', err)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  return { cargos, loading }
}
