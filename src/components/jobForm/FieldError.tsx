import React from 'react'

/** Mensagem de erro de validação exibida logo abaixo do campo. */
export const FieldError: React.FC<{ message?: string }> = ({ message }) =>
  message ? <p className="mt-1 text-[11px] font-medium text-rose-600">{message}</p> : null
