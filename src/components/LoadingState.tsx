import React from 'react'
import { Loader2 } from 'lucide-react'

/**
 * Indicador de carregamento padronizado: um ícone animado + mensagem em português.
 * Usado em todas as telas que carregam listas ou detalhes, para que nenhuma tela
 * fique em branco enquanto os dados chegam.
 */
export const LoadingState: React.FC<{ message?: string; className?: string }> = ({
  message = 'Carregando...',
  className = 'py-16',
}) => (
  <div className={`flex flex-col items-center justify-center text-slate-500 gap-2 ${className}`}>
    <Loader2 className="w-6 h-6 animate-spin text-sky-600" />
    <p className="text-sm">{message}</p>
  </div>
)

export default LoadingState
