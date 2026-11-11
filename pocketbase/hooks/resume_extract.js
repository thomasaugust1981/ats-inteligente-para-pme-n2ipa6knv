/// <reference path="../pb_data/types.d.ts" />
//
// Hook: POST /backend/v1/resume/extract
// Recebe multipart com o campo "arquivo" (PDF ou DOCX), converte para texto com
// $documents.toMarkdown e pede ao agente NATIVO "resume-reader" o JSON estruturado
// no modelo padrão da ferramenta. Rota pública: a candidatura não exige login.
// Não usa $http nem segredos SKIP_CONNECTORS_*.

routerAdd('POST', '/backend/v1/resume/extract', (e) => {
  const files = e.findUploadedFiles('arquivo')
  if (!files || files.length === 0) {
    return e.badRequestError('Envie o arquivo do currículo.')
  }

  let markdown
  try {
    const result = $documents.toMarkdown({ file: files[0] })
    markdown = result.markdown
  } catch (err) {
    // 422 = arquivo ilegível/escaneado (sem texto selecionável); 413 = muito grande.
    if (err && (err.status === 422 || err.status === 413)) {
      return e.json(err.status, {
        error:
          'Não conseguimos ler o texto deste arquivo. Se for um PDF escaneado (imagem), tente uma versão com texto selecionável ou preencha o formulário manualmente.',
        code: 'unreadable',
      })
    }
    return e.json(500, {
      error: 'Falha ao processar o arquivo do currículo.',
      code: 'parse_failed',
    })
  }

  const text = (markdown || '').trim()
  if (text.length < 40) {
    return e.json(422, {
      error:
        'Não encontramos texto suficiente no arquivo para a leitura automática. Preencha o formulário manualmente, por favor.',
      code: 'unreadable',
    })
  }

  // Limita o texto enviado ao modelo para manter a resposta rápida.
  const maxChars = 30000
  const clipped = text.length > maxChars ? text.slice(0, maxChars) : text

  try {
    // user_id de serviço (criado na migration 0004): a rota é pública, mas a
    // plataforma exige um usuário real para escopar a conversa do agente.
    const serviceUser = $app.findAuthRecordByEmail('users', 'ai-service@ats.internal')

    const result = $ai.agent('resume-reader').chat({
      user_id: serviceUser.id,
      message:
        'Extraia os dados deste currículo e responda apenas com o JSON no formato combinado:\n\n' +
        clipped,
    })

    const raw = (result && result.content) || ''
    // O modelo às vezes envolve o JSON em fences — remove antes de parsear.
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/, '')
      .trim()
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start === -1 || end === -1 || end <= start) {
      return e.json(502, {
        error:
          'A análise do currículo não retornou dados utilizáveis. Tente novamente ou preencha manualmente.',
        code: 'bad_model_output',
      })
    }

    let parsed
    try {
      parsed = JSON.parse(cleaned.slice(start, end + 1))
    } catch (_) {
      return e.json(502, {
        error:
          'A análise do currículo não retornou dados utilizáveis. Tente novamente ou preencha manualmente.',
        code: 'bad_model_output',
      })
    }

    return e.json(200, { data: parsed, truncated: result.truncated || false })
  } catch (err) {
    if (err instanceof SkipAiConfigError) {
      return e.json(503, {
        error: 'A leitura automática está temporariamente indisponível.',
        code: 'ai_unavailable',
      })
    }
    if (err instanceof SkipAiAgentsError) {
      const status = err.status || 500
      return e.json(status >= 500 ? 502 : status, {
        error: status >= 500 ? 'Falha na análise automática do currículo.' : err.message,
        code: 'ai_error',
      })
    }
    if (err instanceof SkipAiError) {
      const status = err.status || 502
      return e.json(status >= 500 ? 502 : status, {
        error: status >= 500 ? 'Falha na análise automática do currículo.' : err.message,
        code: 'ai_error',
      })
    }
    return e.json(500, { error: 'Falha na análise automática do currículo.', code: 'unknown' })
  }
})
