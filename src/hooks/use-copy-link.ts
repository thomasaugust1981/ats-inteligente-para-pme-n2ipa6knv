import { useCallback } from 'react'
import { useToast } from '@/hooks/use-toast'

/**
 * Cópia de links públicos com feedback de confirmação/erro padronizado (toast).
 * Fallback para contextos sem navigator.clipboard (HTTP, navegadores antigos).
 */
export function useCopyLink() {
  const { toast } = useToast()

  const copyLink = useCallback(
    async (url: string, label = 'Link') => {
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(url)
        } else {
          // Fallback: textarea temporária + seleção manual
          const ta = document.createElement('textarea')
          ta.value = url
          ta.style.position = 'fixed'
          ta.style.opacity = '0'
          document.body.appendChild(ta)
          ta.select()
          document.execCommand('copy')
          document.body.removeChild(ta)
        }
        toast({
          title: 'Copiado!',
          description: `${label} copiado para a área de transferência.`,
        })
        return true
      } catch (_) {
        // Não travar a UX: o usuário copia manualmente com o link já visível na tela
        toast({
          title: 'Copie manualmente',
          description: 'Selecione e copie o endereço exibido na tela.',
          variant: 'destructive',
        })
        return false
      }
    },
    [toast],
  )

  return { copyLink }
}
