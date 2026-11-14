//
// Pesos de avaliação POR VAGA (aspectos técnico, comportamental e cultural).
// Três campos opcionais em jobs (números inteiros 0–100). Quando os três estão
// preenchidos e somam 100, o score de IA da candidatura usa a régua da vaga;
// caso contrário (null/vazios), usa a régua global de ai_agent_settings.
// Idempotente: só adiciona o campo se ele ainda não existir.
//

migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('jobs')
    const names = ['weight_technical', 'weight_behavioral', 'weight_cultural']
    for (const name of names) {
      if (!col.fields.getByName(name)) {
        col.fields.add(new NumberField({ name: name, min: 0, max: 100, onlyInt: true }))
      }
    }
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('jobs')
    const names = ['weight_technical', 'weight_behavioral', 'weight_cultural']
    for (const name of names) {
      try {
        if (col.fields.getByName(name)) {
          col.fields.remove(name)
        }
      } catch (_) {}
    }
    app.save(col)
  },
)
