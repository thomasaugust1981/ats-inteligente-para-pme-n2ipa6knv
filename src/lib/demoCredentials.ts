/**
 * Credenciais do usuário de demonstração comercial.
 *
 * É uma conta de DEMONSTRAÇÃO (sem dado real), criada pela migração
 * 0040_demo_user.js na organização principal — por isso o e-mail e a senha
 * ficam expostos aqui, no frontend.
 *
 * Para DESLIGAR o bloco "Acesso de demonstração" na tela de login basta
 * trocar o valor abaixo por '' (o bloco então some sem erro — a LoginPage
 * renderiza-o condicionalmente com base nesta constante).
 */
export const DEMO_EMAIL = 'demo@ausland.com.br'
export const DEMO_PASSWORD = 'demo1234'

export const DEMO_CREDENTIALS: { email: string; password: string } | null =
  DEMO_EMAIL && DEMO_PASSWORD ? { email: DEMO_EMAIL, password: DEMO_PASSWORD } : null
