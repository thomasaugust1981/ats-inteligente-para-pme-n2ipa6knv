import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, ClipboardList, Loader2 } from 'lucide-react'
import type { DiscResult } from '@/types/ats'

// Questionário DISC: 20 afirmações (5 por fator), escala 1–4.
// Cada resposta soma no fator correspondente; o perfil é o fator dominante.

interface Question {
  text: string
  factor: 'D' | 'I' | 'S' | 'C'
}

const QUESTIONS: Question[] = [
  // Dominância (D)
  { text: 'Gosto de assumir o controle das situações e decidir rápido.', factor: 'D' },
  { text: 'Enfrento conflitos diretamente quando algo precisa mudar.', factor: 'D' },
  { text: 'Prefiro desafios difíceis a tarefas rotineiras.', factor: 'D' },
  { text: 'Tomo decisões firmes mesmo sem todos os detalhes.', factor: 'D' },
  { text: 'Gosto de resultados imediatos e mensuráveis.', factor: 'D' },
  // Influência (I)
  { text: 'Sou entusiasmado(a) e gosto de motivar as pessoas ao meu redor.', factor: 'I' },
  { text: 'Me comunico com facilidade, até com desconhecidos.', factor: 'I' },
  { text: 'Prefiro ambientes movimentados e sociais a trabalho solitário.', factor: 'I' },
  { text: 'Costumo otimizar situações tensas com bom humor.', factor: 'I' },
  { text: 'Gosto de convencer e apresentar ideias para grupos.', factor: 'I' },
  // Estabilidade (S)
  { text: 'Prefiro ambientes previsíveis, com rotinas claras.', factor: 'S' },
  { text: 'Sou paciente quando as coisas demoram para mudar.', factor: 'S' },
  { text: 'Valorizo relações de trabalho estáveis e de longo prazo.', factor: 'S' },
  { text: 'Escuto antes de reagir e busco harmonia no grupo.', factor: 'S' },
  { text: 'Me incomodam mudanças bruscas de planos.', factor: 'S' },
  // Conformidade (C)
  { text: 'Antes de decidir, analiso todos os dados e detalhes.', factor: 'C' },
  { text: 'Gosto de seguir normas e processos bem definidos.', factor: 'C' },
  { text: 'Erros me incomodam muito — prefiro fazer certo a fazer rápido.', factor: 'C' },
  { text: 'Sou meticuloso(a) com qualidade e precisão.', factor: 'C' },
  { text: 'Evito riscos sem antes ter evidências que os sustentem.', factor: 'C' },
]

const FACTOR_LABELS: Record<Question['factor'], string> = {
  D: 'Dominância',
  I: 'Influência',
  S: 'Estabilidade',
  C: 'Conformidade',
}

const PROFILE_TRAITS: Record<string, string> = {
  D: 'Perfil Determinado — orientado a resultados, direto e decidido.',
  I: 'Perfil Influente — comunicativo, otimista e persuasivo.',
  S: 'Perfil Estável — paciente, colaborativo e consistente.',
  C: 'Perfil Consciencioso — analítico, detalhista e preciso.',
}

type Answers = Record<number, number> // índice da questão -> nota 1..4

export function DiscFormPage() {
  const { token } = useParams<{ token: string }>()
  const [state, setState] = useState<
    'loading' | 'ready' | 'invalid' | 'completed' | 'submitting' | 'error'
  >('loading')
  const [answers, setAnswers] = useState<Answers>({})
  const [result, setResult] = useState<DiscResult | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!token) {
        if (!cancelled) setState('invalid')
        return
      }
      try {
        const record = await pb
          .collection('disc_results')
          .getFirstListItem<DiscResult>(`token = "${token}"`)
        if (cancelled) return
        if (record.status === 'completed') {
          setResult(record)
          setState('completed')
        } else {
          setState('ready')
        }
      } catch (err) {
        if (cancelled) return
        console.error('DISC: token inválido', getErrorMessage(err))
        setState('invalid')
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [token])

  const answered = useMemo(() => Object.keys(answers).length, [answers])
  const total = QUESTIONS.length
  const allAnswered = answered === total

  const setAnswer = useCallback((index: number, value: number) => {
    setAnswers((prev) => ({ ...prev, [index]: value }))
  }, [])

  const handleSubmit = async () => {
    if (!token || !allAnswered || !result) return
    setState('submitting')
    try {
      const score = { D: 0, I: 0, S: 0, C: 0 }
      for (const [indexStr, value] of Object.entries(answers)) {
        const question = QUESTIONS[Number(indexStr)]
        score[question.factor] += value
      }
      const dominant = (Object.entries(score) as [Question['factor'], number][]).sort(
        (a, b) => b[1] - a[1],
      )[0][0]

      const updated = await pb.collection('disc_results').update<DiscResult>(result.id, {
        score_d: score.D,
        score_i: score.I,
        score_s: score.S,
        score_c: score.C,
        profile: dominant,
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      setResult(updated)
      setState('completed')
    } catch (err) {
      console.error('DISC: falha ao salvar', getErrorMessage(err))
      setErrorMsg(getErrorMessage(err))
      setState('error')
    }
  }

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    )
  }

  if (state === 'invalid') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md w-full bg-white border rounded-xl shadow-sm p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center mx-auto">
            <ClipboardList className="w-6 h-6 text-rose-500" />
          </div>
          <h1 className="text-lg font-bold text-slate-900">Link inválido</h1>
          <p className="text-sm text-slate-500">
            Não encontramos um questionário para este link. Verifique se ele foi copiado por
            completo do e-mail que você recebeu ou peça um novo link ao recrutador.
          </p>
        </div>
      </div>
    )
  }

  if (state === 'completed') {
    const profile = result?.profile || ''
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-10">
        <div className="max-w-md w-full bg-white border rounded-xl shadow-sm p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
          </div>
          <h1 className="text-lg font-bold text-slate-900">Questionário concluído!</h1>
          <p className="text-sm text-slate-500">
            Obrigado pela sua participação. Suas respostas foram registradas e a equipe de seleção
            terá acesso ao resultado.
          </p>
          {profile && (
            <div className="border rounded-lg p-4 bg-slate-50 text-left">
              <p className="text-[11px] font-semibold text-slate-500 uppercase mb-1">Seu perfil</p>
              <Badge className="mb-2 bg-purple-100 text-purple-700 hover:bg-purple-100">
                {profile}
              </Badge>
              <p className="text-sm text-slate-700">{PROFILE_TRAITS[profile] || profile}</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (!result) return null

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-1.5">
          <h1 className="text-xl font-bold text-slate-900">Questionário de Perfil (DISC)</h1>
          <p className="text-sm text-slate-500">
            Para cada afirmação, indique o quanto ela combina com você. Não existem respostas certas
            ou erradas — leve cerca de 5 minutos.
          </p>
        </div>

        <div className="sticky top-3 z-10 bg-white border rounded-lg px-4 py-3 shadow-sm flex items-center gap-3">
          <Progress value={(answered / total) * 100} className="flex-1 h-2" />
          <span className="text-xs font-medium text-slate-500 tabular-nums whitespace-nowrap">
            {answered}/{total}
          </span>
        </div>

        <div className="space-y-4">
          {QUESTIONS.map((question, index) => (
            <div key={index} className="bg-white border rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium text-slate-800">
                {index + 1}. {question.text}
              </p>
              <RadioGroup
                value={String(answers[index] || '')}
                onValueChange={(value) => setAnswer(index, Number(value))}
                className="grid grid-cols-2 sm:grid-cols-4 gap-2"
              >
                {[
                  { value: 1, label: 'Discordo totalmente' },
                  { value: 2, label: 'Discordo em parte' },
                  { value: 3, label: 'Concordo em parte' },
                  { value: 4, label: 'Concordo totalmente' },
                ].map((option) => (
                  <Label
                    key={option.value}
                    htmlFor={`q-${index}-${option.value}`}
                    className={`flex flex-col items-center gap-1.5 p-2.5 rounded-md border text-[11px] text-center cursor-pointer transition ${
                      answers[index] === option.value
                        ? 'border-purple-400 bg-purple-50 font-semibold'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <RadioGroupItem
                      id={`q-${index}-${option.value}`}
                      value={String(option.value)}
                    />
                    {option.label}
                  </Label>
                ))}
              </RadioGroup>
            </div>
          ))}
        </div>

        {state === 'error' && (
          <p className="text-sm text-rose-600 text-center">
            Não foi possível salvar suas respostas. {errorMsg} Tente novamente.
          </p>
        )}

        <div className="flex justify-center pb-6">
          <Button
            onClick={handleSubmit}
            disabled={!allAnswered || state === 'submitting'}
            className="bg-purple-600 hover:bg-purple-700 text-white px-8"
          >
            {state === 'submitting' ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              'Enviar respostas'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default DiscFormPage
