/// <reference path="../pb_data/types.d.ts" />
//
// 0004 — Leitor de currículo com IA:
// 1. Cria usuário de serviço (compartilhado, sem login no app) para assinar
//    as conversas do agente de IA em rotas públicas (candidatura anônima).
// 2. Define o agente NATIVO da Skip Cloud que interpreta o texto do currículo
//    e devolve JSON estruturado (formação, experiências, competências, dados básicos).
// 3. Campos novos na coleção candidates: resume_structured (JSON do modelo padrão)
//    e resume_source (origem: "ai_extracted" | "manual" | null).

migrate(
  (app) => {
    // ---- 1. Usuário de serviço para chamadas anônimas ao agente -------------
    const serviceEmail = 'ai-service@ats.internal'
    try {
      app.findAuthRecordByEmail('users', serviceEmail)
    } catch (_) {
      const users = app.findCollectionByNameOrId('users')
      const rec = new Record(users)
      rec.setEmail(serviceEmail)
      rec.setPassword($security.randomString(24))
      rec.setVerified(true)
      rec.set('name', 'Serviço de IA')
      rec.set('role', 'admin')
      app.save(rec)
    }

    // ---- 2. Agente nativo leitor de currículos -----------------------------
    $ai.agents.define(app, {
      slug: 'resume-reader',
      name: 'Leitor de Currículos',
      description:
        'Extrai dados estruturados de currículos (formação, experiência, competências e contato) a partir do texto do arquivo.',
      tier: 'fast',
      systemPrompt: [
        'Você é um extrator de dados de currículos brasileiros. Recebe o texto (markdown) de um currículo e responde APENAS com um JSON válido, sem texto antes ou depois, sem markdown fences.',
        'Formato exato esperado:',
        '{"name":"","email":"","phone":"","location":"","linkedin":"","summary":"","skills":[],"experiences":[{"title":"","company":"","start_date":"","end_date":"","current":false,"description":""}],"education":[{"degree":"","institution":"","start_date":"","end_date":"","status":""}],"languages":[],"courses":[]}',
        'Regras:',
        '- Use strings vazias quando um dado não existir no texto; nunca invente dados.',
        '- skills, languages e courses são arrays de strings curtas.',
        '- experiences: title = cargo, company = empresa, start_date/end_date no formato "MM/AAAA" (ou "AAAA" se só o ano), current = true se for o emprego atual ou "atual"/"presente".',
        '- education: degree = curso/formação, institution = instituição, status = "concluído"/"em andamento"/"trancado" se indicado.',
        '- location = cidade/estado; linkedin = URL do perfil se houver.',
        '- Preserve os textos no idioma original do currículo.',
        '- Se o texto não parecer um currículo, responda com todas as strings vazias e arrays vazios.',
      ].join('\n'),
    })

    // ---- 3. Campos novos em candidates -------------------------------------
    const candidates = app.findCollectionByNameOrId('candidates')
    if (!candidates.fields.getByName('resume_structured')) {
      candidates.fields.add(new JSONField({ name: 'resume_structured', maxSize: 2000000 }))
    }
    if (!candidates.fields.getByName('resume_source')) {
      candidates.fields.add(
        new SelectField({
          name: 'resume_source',
          values: ['ai_extracted', 'manual'],
          maxSelect: 1,
        }),
      )
    }

    // O upload agora aceita também Word (.docx), com limite de 10 MB.
    const resumeField = candidates.fields.getByName('resume')
    if (resumeField) {
      resumeField.maxSize = 10485760
      resumeField.mimeTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ]
    }
    app.save(candidates)
  },
  (app) => {
    const candidates = app.findCollectionByNameOrId('candidates')
    if (candidates.fields.getByName('resume_structured')) {
      candidates.fields.removeByName('resume_structured')
    }
    if (candidates.fields.getByName('resume_source')) {
      candidates.fields.removeByName('resume_source')
    }
    const resumeField = candidates.fields.getByName('resume')
    if (resumeField) {
      resumeField.maxSize = 15728640
      resumeField.mimeTypes = ['application/pdf']
    }
    app.save(candidates)

    try {
      $ai.agents.delete(app, 'resume-reader')
    } catch (_) {}

    try {
      const rec = app.findAuthRecordByEmail('users', 'ai-service@ats.internal')
      app.delete(rec)
    } catch (_) {}
  },
)
