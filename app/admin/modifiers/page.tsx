"use client"

import { useEffect, useState } from "react"
import useSWR from "swr"
import { Plus, Trash2, GripVertical, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import type { Branch, ModifierGroup, ModifierOption } from "@/lib/types"
import { toast } from "sonner"
import { createModifierGroup, updateModifierGroup } from "@/app/actions"
import { formatPrice } from "@/lib/utils"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function ModifiersPage() {
  const { data: session } = useSWR<{ branches: Branch[]; activeBranchId: string | null }>(
    "/api/admin?type=session",
    fetcher
  )
  const [selectedBranch, setSelectedBranch] = useState("")
  const { data: groups, mutate, isLoading } = useSWR<ModifierGroup[]>(
    selectedBranch ? `/api/admin?type=modifiers&branchId=${selectedBranch}` : null,
    fetcher
  )

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editGroup, setEditGroup] = useState<ModifierGroup | null>(null)
  const [saving, setSaving] = useState(false)

  const [formName, setFormName] = useState("")
  const [formRequired, setFormRequired] = useState(false)
  const [formMax, setFormMax] = useState("5")
  const [formOptions, setFormOptions] = useState<
    { name: string; price: string }[]
  >([])

  useEffect(() => {
    if (!selectedBranch && session?.activeBranchId) {
      setSelectedBranch(session.activeBranchId)
    }
  }, [selectedBranch, session?.activeBranchId])

  const openCreate = () => {
    if (!selectedBranch) {
      toast.error("Selecciona una sucursal")
      return
    }
    setEditGroup(null)
    setFormName("")
    setFormRequired(false)
    setFormMax("5")
    setFormOptions([{ name: "", price: "0" }])
    setDialogOpen(true)
  }

  const openEdit = (group: ModifierGroup) => {
    setEditGroup(group)
    setFormName(group.name)
    setFormRequired(group.required)
    setFormMax(group.maxSelections.toString())
    setFormOptions(
      group.options.map((o) => ({ name: o.name, price: o.price.toString() }))
    )
    setDialogOpen(true)
  }

  const addOption = () => {
    setFormOptions((prev) => [...prev, { name: "", price: "0" }])
  }

  const removeOption = (index: number) => {
    setFormOptions((prev) => prev.filter((_, i) => i !== index))
  }

  const updateOption = (
    index: number,
    field: "name" | "price",
    value: string
  ) => {
    setFormOptions((prev) =>
      prev.map((o, i) => (i === index ? { ...o, [field]: value } : o))
    )
  }

  const handleSave = async () => {
    if (!formName) {
      toast.error("Ingresa un nombre para el grupo")
      return
    }
    const validOptions = formOptions.filter((o) => o.name.trim())
    if (validOptions.length === 0) {
      toast.error("Agrega al menos una opcion")
      return
    }

    setSaving(true)
    try {
      if (editGroup) {
        const result = await updateModifierGroup(editGroup.id, {
          branchId: selectedBranch,
          nombre: formName,
          required: formRequired,
          maxSel: parseInt(formMax) || 5,
          options: validOptions.map((o, i) => ({
            nombre: o.name,
            precioExtra: parseFloat(o.price) || 0,
            orden: i,
          })),
        })
        if (result.error) {
          toast.error(result.error)
          return
        }
        toast.success("Grupo de modificadores actualizado")
      } else {
        const result = await createModifierGroup({
          branchId: selectedBranch,
          nombre: formName,
          required: formRequired,
          maxSel: parseInt(formMax) || 5,
          options: validOptions.map((o, i) => ({
            nombre: o.name,
            precioExtra: parseFloat(o.price) || 0,
            orden: i,
          })),
        })
        if (result.error) {
          toast.error(result.error)
          return
        }
        toast.success("Grupo de modificadores creado")
      }
      setDialogOpen(false)
      mutate()
    } catch {
      toast.error("Algo salio mal")
    } finally {
      setSaving(false)
    }
  }

  if (!selectedBranch || isLoading) {
    return (
      <div className="flex flex-col gap-6 max-w-4xl">
        <div>
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-40 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1
            className="text-2xl font-bold text-foreground"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Modificadores
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configura extras, salsas, tamanos y mas
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
            <SelectTrigger className="w-full rounded-xl bg-card sm:w-56">
              <SelectValue placeholder="Sucursal" />
            </SelectTrigger>
            <SelectContent>
              {(session?.branches || []).map((branch) => (
                <SelectItem key={branch.id} value={branch.id}>
                  {branch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
            onClick={openCreate}
            disabled={!selectedBranch}
          >
            <Plus className="h-4 w-4" />
            Agregar grupo
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(Array.isArray(groups) ? groups : []).map((group) => (
          <Card
            key={group.id}
            className="rounded-2xl bg-card border-border cursor-pointer hover:border-primary/30 transition-colors"
            onClick={() => openEdit(group)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter") openEdit(group)
            }}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-card-foreground">
                  {group.name}
                </CardTitle>
                <div className="flex items-center gap-2">
                  {group.required && (
                    <Badge
                      variant="outline"
                      className="text-xs bg-primary/15 text-primary border-primary/20"
                    >
                      Obligatorio
                    </Badge>
                  )}
                  <Badge
                    variant="outline"
                    className="text-xs text-muted-foreground border-border"
                  >
                    Maximo {group.maxSelections}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-col gap-2">
                {group.options.map((option) => (
                  <div
                    key={option.id}
                    className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40" />
                      <span className="text-sm text-card-foreground">
                        {option.name}
                      </span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {option.price > 0
                        ? `+${formatPrice(option.price)}`
                        : "Gratis"}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md bg-card border-border rounded-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle
              className="text-card-foreground"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {editGroup ? "Editar grupo de modificadores" : "Crear grupo de modificadores"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div>
              <Label className="text-sm text-muted-foreground mb-1.5 block">
                Nombre del grupo
              </Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ej: Extras, Salsas, Tamano"
                className="rounded-xl bg-secondary border-0 text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formRequired}
                  onCheckedChange={setFormRequired}
                  id="required"
                />
                <Label htmlFor="required" className="text-sm text-muted-foreground">
                  Obligatorio
                </Label>
              </div>
              <div className="flex-1">
                <Label className="text-sm text-muted-foreground mb-1.5 block">
                  Selecciones maximas
                </Label>
                <Input
                  type="number"
                  min={1}
                  value={formMax}
                  onChange={(e) => setFormMax(e.target.value)}
                  className="rounded-xl bg-secondary border-0 text-foreground w-24"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-sm text-muted-foreground">
                  Opciones
                </Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-primary hover:text-primary gap-1"
                  onClick={addOption}
                >
                  <Plus className="h-3 w-3" />
                  Agregar
                </Button>
              </div>
              <div className="flex flex-col gap-2">
                {formOptions.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={opt.name}
                      onChange={(e) =>
                        updateOption(i, "name", e.target.value)
                      }
                      placeholder="Nombre de la opcion"
                      className="flex-1 rounded-xl bg-secondary border-0 text-foreground placeholder:text-muted-foreground text-sm"
                    />
                    <div className="relative w-24">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                        $
                      </span>
                      <Input
                        type="number"
                        step="0.01"
                        value={opt.price}
                        onChange={(e) =>
                          updateOption(i, "price", e.target.value)
                        }
                        className="pl-7 rounded-xl bg-secondary border-0 text-foreground text-sm"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => removeOption(i)}
                      aria-label="Quitar opcion"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : editGroup ? (
                "Guardar cambios"
              ) : (
                "Crear grupo"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
