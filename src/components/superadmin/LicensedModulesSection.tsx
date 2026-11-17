import React, { useCallback, useEffect, useState } from 'react'
import { Loader2, Puzzle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { listOrgModules, setModuleLicensed, type OrgModuleRecord } from '@/services/modules'
import { superadminService, type Organization } from '@/services/superadmin'

/** Módulo licenciável por organização (linha da tabela). */
interface ModuleRow {
  org: Organization
  record: OrgModuleRecord | null
}

/**
 * Seção "Módulos licenciados" do painel superadmin: alterna a licença do
 * módulo por organização e define a validade (licensed_until). Grava direto
 * na coleção org_modules (regra: escrita exclusiva de superadmin).
 */
export const LicensedModulesSection: React.FC = () => {
  const { toast } = useToast()
  const [rows, setRows] = useState<ModuleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [savingOrg, setSavingOrg] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [orgs, modules] = await Promise.all([
        superadminService.listOrganizations(),
        listOrgModules(),
      ])
      setRows(
        orgs.map((org) => ({
          org,
          record: modules.find((m) => m.org_id === org.id && m.module === 'indicadores') || null,
        })),
      )
    } catch (err) {
      console.error('Erro ao carregar módulos licenciados:', err)
      toast({
        title: 'Erro ao carregar módulos licenciados',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  const handleToggle = async (row: ModuleRow, licensed: boolean) => {
    setSavingOrg(row.org.id)
    try {
      await setModuleLicensed(row.org.id, 'indicadores', licensed, row.record?.licensed_until)
      setRows((prev) =>
        prev.map((r) =>
          r.org.id === row.org.id && r.record ? { ...r, record: { ...r.record, licensed } } : r,
        ),
      )
      toast({
        title: licensed ? 'Módulo licenciado' : 'Licença revogada',
        description: `Indicadores ${licensed ? 'liberado para' : 'bloqueado para'} ${row.org.name}.`,
      })
    } catch (err) {
      console.error('Erro ao salvar licença:', err)
      toast({
        title: 'Erro ao salvar licença',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setSavingOrg(null)
    }
  }

  const handleUntilChange = async (row: ModuleRow, value: string) => {
    setSavingOrg(row.org.id)
    try {
      await setModuleLicensed(row.org.id, 'indicadores', !!row.record?.licensed, value || null)
      setRows((prev) =>
        prev.map((r) =>
          r.org.id === row.org.id && r.record
            ? { ...r, record: { ...r.record, licensed_until: value || null } }
            : r,
        ),
      )
      toast({ title: 'Validade atualizada', description: `Indicadores · ${row.org.name}.` })
    } catch (err) {
      console.error('Erro ao salvar validade:', err)
      toast({
        title: 'Erro ao salvar validade',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setSavingOrg(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Puzzle className="w-4 h-4 text-sky-600" />
          Módulos licenciados
        </CardTitle>
        <CardDescription>
          Módulos licenciados à parte, por organização. Hoje: Indicadores.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500 py-4">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-500 py-4">Nenhuma organização cadastrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b">
                  <th className="py-2 px-2 font-medium">Organização</th>
                  <th className="py-2 px-2 font-medium">Módulo</th>
                  <th className="py-2 px-2 font-medium">Validade</th>
                  <th className="py-2 px-2 font-medium text-right">Licenciado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.org.id} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="py-2.5 px-2 font-medium text-slate-900">{row.org.name}</td>
                    <td className="py-2.5 px-2">
                      <Badge variant="outline" className="text-[10px]">
                        indicadores
                      </Badge>
                    </td>
                    <td className="py-2.5 px-2">
                      <Input
                        type="date"
                        value={row.record?.licensed_until || ''}
                        disabled={savingOrg === row.org.id}
                        onChange={(e) => handleUntilChange(row, e.target.value)}
                        className="h-8 w-40 text-xs"
                        aria-label={`Validade da licença de indicadores de ${row.org.name}`}
                      />
                    </td>
                    <td className="py-2.5 px-2 text-right">
                      <Switch
                        checked={!!row.record?.licensed}
                        disabled={savingOrg === row.org.id}
                        onCheckedChange={(v) => handleToggle(row, v)}
                        aria-label={`Licenciar indicadores para ${row.org.name}`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default LicensedModulesSection
