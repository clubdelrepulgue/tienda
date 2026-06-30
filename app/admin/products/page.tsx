"use client"

import { useState } from "react"
import Image from "next/image"
import useSWR from "swr"
import { Plus, Pencil, Search, Loader2, Upload, X } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Product, Category, ModifierGroup } from "@/lib/types"
import { toast } from "sonner"
import { createProduct, updateProduct, toggleProductActive } from "@/app/actions"
import { createClient } from "@/lib/supabase/client"
import { formatPrice } from "@/lib/utils"
import { useActiveBranch } from "../branch-context"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function ProductsPage() {
  const { activeBranchId } = useActiveBranch()
  const selectedBranch = activeBranchId ?? ""

  const { data: products, mutate: mutateProducts, isLoading: productsLoading } = useSWR<Product[]>(
    selectedBranch ? `/api/admin?type=products&branchId=${selectedBranch}` : null,
    fetcher
  )
  const { data: categories } = useSWR<Category[]>(
    selectedBranch ? `/api/admin?type=categories&branchId=${selectedBranch}` : null,
    fetcher
  )
  const { data: modifiers } = useSWR<ModifierGroup[]>(
    selectedBranch ? `/api/admin?type=modifiers&branchId=${selectedBranch}` : null,
    fetcher
  )

  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [saving, setSaving] = useState(false)

  const [formName, setFormName] = useState("")
  const [formDescription, setFormDescription] = useState("")
  const [formPrice, setFormPrice] = useState("")
  const [formCategory, setFormCategory] = useState("")
  const [formActive, setFormActive] = useState(true)
  const [formModifierGroups, setFormModifierGroups] = useState<string[]>([])
  const [formVariantLabel, setFormVariantLabel] = useState("Tamaño")
  const [formVariants, setFormVariants] = useState<{ nombre: string; precio: string; activo: boolean }[]>([])

  // Multiple images state
  const [existingImages, setExistingImages] = useState<string[]>([])
  const [newImageFiles, setNewImageFiles] = useState<{ file: File, preview: string }[]>([])

  const safeProducts = Array.isArray(products) ? products : []
  const filtered = safeProducts.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  const openCreate = () => {
    if (!selectedBranch) {
      toast.error("Selecciona una sucursal")
      return
    }
    setEditProduct(null)
    setFormName("")
    setFormDescription("")
    setFormPrice("")
    const safeCategories = Array.isArray(categories) ? categories : []
    setFormCategory(safeCategories?.[0]?.id || "")
    setFormActive(true)
    setFormModifierGroups([])
    setFormVariantLabel("Tamaño")
    setFormVariants([])
    setExistingImages([])
    setNewImageFiles([])
    setDialogOpen(true)
  }

  const openEdit = (product: Product) => {
    setEditProduct(product)
    setFormName(product.name)
    setFormDescription(product.description || "")
    setFormPrice(product.price.toString())
    setFormCategory(product.categoryId)
    setFormActive(product.active)
    setFormModifierGroups(product.modifierGroups || [])
    setFormVariantLabel(product.variantGroupLabel || "Tamaño")
    setFormVariants(
      (product.variants || []).map((v) => ({
        nombre: v.name,
        precio: v.price.toString(),
        activo: v.active,
      }))
    )
    setExistingImages(product.images || [])
    setNewImageFiles([])
    setDialogOpen(true)
  }

  const handleAddFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    files.forEach(file => {
      const reader = new FileReader()
      reader.onloadend = () => {
        setNewImageFiles(prev => [...prev, { file, preview: reader.result as string }])
      }
      reader.readAsDataURL(file)
    })
  }

  const handleRemoveExisting = (url: string) => {
    setExistingImages(prev => prev.filter(img => img !== url))
  }

  const handleRemoveNew = (index: number) => {
    setNewImageFiles(prev => prev.filter((_, i) => i !== index))
  }

  const cleanedVariants = formVariants
    .map((v) => ({ nombre: v.nombre.trim(), precio: parseFloat(v.precio), activo: v.activo }))
    .filter((v) => v.nombre.length > 0 && Number.isFinite(v.precio) && v.precio >= 0)
  const hasVariants = cleanedVariants.length > 0

  const handleSave = async () => {
    if (!formName || !formCategory) {
      toast.error("Completa todos los campos obligatorios")
      return
    }

    // Base price is only required when the product has no variants
    if (!hasVariants && !formPrice) {
      toast.error("Ingresa el precio o agrega al menos una variante")
      return
    }

    if (formVariants.length > 0 && !hasVariants) {
      toast.error("Cada variante necesita nombre y precio válidos")
      return
    }

    setSaving(true)
    try {
      const supabase = createClient()
      const uploadedUrls: string[] = []

      // Upload new images
      for (const item of newImageFiles) {
        const fileExt = item.file.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`

        const { error: uploadError } = await supabase.storage
          .from('productos')
          .upload(fileName, item.file)

        if (uploadError) {
          toast.error("Error al subir la imagen: " + uploadError.message)
          setSaving(false)
          return
        }

        const { data: { publicUrl } } = supabase.storage
          .from('productos')
          .getPublicUrl(fileName)

        uploadedUrls.push(publicUrl)
      }

      const allImages = [...existingImages, ...uploadedUrls]

      if (editProduct) {
        const result = await updateProduct(editProduct.id, {
          branchId: selectedBranch,
          nombre: formName,
          descripcion: formDescription,
          precio: parseFloat(formPrice) || 0,
          images: allImages,
          categoriaId: formCategory,
          activo: formActive,
          modifierGroupIds: formModifierGroups,
          variantGroupLabel: formVariantLabel,
          variants: cleanedVariants,
        })
        if (result.error) {
          toast.error(result.error)
          setSaving(false)
          return
        }
        toast.success("Producto actualizado")
      } else {
        const result = await createProduct({
          branchId: selectedBranch,
          nombre: formName,
          descripcion: formDescription,
          precio: parseFloat(formPrice) || 0,
          images: allImages,
          categoriaId: formCategory,
          activo: formActive,
          modifierGroupIds: formModifierGroups,
          variantGroupLabel: formVariantLabel,
          variants: cleanedVariants,
        })
        if (result.error) {
          toast.error(result.error)
          setSaving(false)
          return
        }
        toast.success("Producto creado")
      }
      setDialogOpen(false)
      mutateProducts()
    } catch (error) {
      console.error(error)
      toast.error("Algo salio mal")
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (productId: string) => {
    // Optimistic update
    mutateProducts(
      (prev) =>
        prev?.map((p) =>
          p.id === productId ? { ...p, active: !p.active } : p
        ),
      false
    )
    const result = await toggleProductActive(productId)
    if (result.error) {
      toast.error(result.error)
      mutateProducts()
    }
  }

  const getCategoryName = (id: string) => {
    const safeCategories = Array.isArray(categories) ? categories : []
    return safeCategories.find((c) => c.id === id)?.name || "Sin categoria"
  }

  if (!selectedBranch || productsLoading) {
    return (
      <div className="flex flex-col gap-6 max-w-6xl">
        <div>
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-48 mt-2" />
        </div>
        <Card className="rounded-2xl bg-card border-border">
          <CardContent className="p-6">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-14 w-full mb-3" />
            ))}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1
            className="text-2xl font-bold text-foreground"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Productos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Administra los productos del menu
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
            onClick={openCreate}
            disabled={!selectedBranch}
          >
            <Plus className="h-4 w-4" />
            Agregar producto
          </Button>
        </div>
      </div>

      <Card className="rounded-2xl bg-card border-border">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar productos..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 rounded-xl bg-secondary border-0 text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Producto</TableHead>
                  <TableHead className="text-muted-foreground">Categoria</TableHead>
                  <TableHead className="text-muted-foreground">Precio</TableHead>
                  <TableHead className="text-muted-foreground">Estado</TableHead>
                  <TableHead className="text-muted-foreground text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((product) => (
                  <TableRow key={product.id} className="border-border">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="relative h-10 w-10 rounded-lg overflow-hidden shrink-0 bg-secondary">
                          {product.images && product.images.length > 0 ? (
                            <Image
                              src={product.images[0]}
                              alt={product.name}
                              fill
                              className="object-cover"
                              sizes="40px"
                            />
                          ) : (
                            <div className="flex items-center justify-center h-full w-full">
                              <Upload className="h-4 w-4 text-muted-foreground/50" />
                            </div>
                          )}
                        </div>
                        <span className="font-medium text-sm text-foreground">
                          {product.name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="text-xs text-muted-foreground border-border"
                      >
                        {getCategoryName(product.categoryId)}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      {(() => {
                        const activeVariants = (product.variants || []).filter((v) => v.active)
                        if (activeVariants.length > 0) {
                          const min = Math.min(...activeVariants.map((v) => v.price))
                          return (
                            <span>
                              <span className="text-xs text-muted-foreground mr-1">Desde</span>
                              {formatPrice(min)}
                            </span>
                          )
                        }
                        return formatPrice(product.price)
                      })()}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={product.active}
                        onCheckedChange={() => handleToggleActive(product.id)}
                        aria-label={`Cambiar estado activo de ${product.name}`}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(product)}
                        aria-label={`Editar ${product.name}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md bg-card border-border rounded-2xl">
          <DialogHeader>
            <DialogTitle
              className="text-card-foreground"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {editProduct ? "Editar producto" : "Crear producto"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4 max-h-[70vh] overflow-y-auto pr-2">

            {/* Images Grid */}
            <div>
              <Label className="text-sm text-muted-foreground mb-2 block">Imagenes</Label>
              <div className="grid grid-cols-3 gap-3">
                {/* Existing Images */}
                {existingImages.map((url, i) => (
                  <div key={`existing-${i}`} className="relative aspect-square rounded-xl overflow-hidden bg-secondary group border border-border">
                    <Image src={url} alt={`Imagen ${i}`} fill className="object-cover" />
                    <button
                      onClick={() => handleRemoveExisting(url)}
                      className="absolute top-1 right-1 h-6 w-6 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}

                {/* New Image Previews */}
                {newImageFiles.map((item, i) => (
                  <div key={`new-${i}`} className="relative aspect-square rounded-xl overflow-hidden bg-secondary group border border-border">
                    <Image src={item.preview} alt={`Nueva imagen ${i}`} fill className="object-cover" />
                    <button
                      onClick={() => handleRemoveNew(i)}
                      className="absolute top-1 right-1 h-6 w-6 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    <div className="absolute bottom-1 right-1 bg-primary text-[10px] px-1 rounded text-primary-foreground font-bold">NUEVA</div>
                  </div>
                ))}

                {/* Add Button */}
                <Label className="relative aspect-square rounded-xl border-2 border-dashed border-border hover:border-primary/50 cursor-pointer flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary transition-colors bg-secondary/30">
                  <Upload className="h-5 w-5" />
                  <span className="text-[10px] font-medium">Agregar imagen</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={handleAddFiles}
                  />
                </Label>
              </div>
            </div>

            <div>
              <Label className="text-sm text-muted-foreground mb-1.5 block">
                Nombre
              </Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Nombre del producto"
                className="rounded-xl bg-secondary border-0 text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <Label className="text-sm text-muted-foreground mb-1.5 block">
                Ingredientes base
              </Label>
              <Textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Ej: Brie, cebolla caramelizada, rúcula y salsa truffle"
                className="min-h-20 resize-none rounded-xl bg-secondary border-0 text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <Label className="text-sm text-muted-foreground mb-1.5 block">
                Precio {hasVariants && <span className="text-xs">(ignorado, usa variantes)</span>}
              </Label>
              <Input
                type="number"
                step="0.01"
                value={formPrice}
                onChange={(e) => setFormPrice(e.target.value)}
                placeholder="0.00"
                disabled={hasVariants}
                className="rounded-xl bg-secondary border-0 text-foreground placeholder:text-muted-foreground disabled:opacity-50"
              />
            </div>

            {/* Variantes / Tamaños */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label className="text-sm text-muted-foreground">
                  Variantes (tamaños / opciones con precio propio)
                </Label>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                Si agregás variantes, cada una define su propio precio y el precio base se ignora.
                Ej: Simple / Doble, 32cm / 50cm.
              </p>

              {formVariants.length > 0 && (
                <div className="mb-2">
                  <Label className="text-xs text-muted-foreground mb-1 block">
                    Título del selector
                  </Label>
                  <Input
                    value={formVariantLabel}
                    onChange={(e) => setFormVariantLabel(e.target.value)}
                    placeholder="Ej: Tamaño, Carnes"
                    className="rounded-xl bg-secondary border-0 text-foreground placeholder:text-muted-foreground"
                  />
                </div>
              )}

              <div className="flex flex-col gap-2">
                {formVariants.map((variant, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={variant.nombre}
                      onChange={(e) =>
                        setFormVariants((prev) =>
                          prev.map((v, i) => (i === index ? { ...v, nombre: e.target.value } : v))
                        )
                      }
                      placeholder="Nombre (ej: Doble)"
                      className="flex-1 rounded-xl bg-secondary border-0 text-foreground placeholder:text-muted-foreground"
                    />
                    <Input
                      type="number"
                      step="0.01"
                      value={variant.precio}
                      onChange={(e) =>
                        setFormVariants((prev) =>
                          prev.map((v, i) => (i === index ? { ...v, precio: e.target.value } : v))
                        )
                      }
                      placeholder="0.00"
                      className="w-24 rounded-xl bg-secondary border-0 text-foreground placeholder:text-muted-foreground"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() =>
                        setFormVariants((prev) => prev.filter((_, i) => i !== index))
                      }
                      aria-label="Eliminar variante"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 rounded-xl gap-2"
                onClick={() =>
                  setFormVariants((prev) => [...prev, { nombre: "", precio: "", activo: true }])
                }
              >
                <Plus className="h-3.5 w-3.5" />
                Agregar variante
              </Button>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground mb-1.5 block">
                Categoria
              </Label>
              <Select value={formCategory} onValueChange={setFormCategory}>
                <SelectTrigger className="rounded-xl bg-secondary border-0 text-foreground">
                  <SelectValue placeholder="Selecciona una categoria" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {(Array.isArray(categories) ? categories : []).map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground mb-1.5 block">
                Grupos de modificadores
              </Label>
              <div className="flex flex-col gap-2 max-h-40 overflow-y-auto mt-2 border border-border p-3 rounded-xl bg-secondary/50">
                {(Array.isArray(modifiers) ? modifiers : []).map((mod) => (
                  <div key={mod.id} className="flex items-center justify-between">
                    <span className="text-sm text-foreground">{mod.name}</span>
                    <Switch
                      checked={formModifierGroups.includes(mod.id)}
                      onCheckedChange={(c) => {
                        if (c) {
                          setFormModifierGroups([...formModifierGroups, mod.id])
                        } else {
                          setFormModifierGroups(formModifierGroups.filter((id) => id !== mod.id))
                        }
                      }}
                    />
                  </div>
                ))}
                {(!modifiers || modifiers.length === 0) && (
                  <span className="text-xs text-muted-foreground text-center py-2">No hay modificadores disponibles</span>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm text-muted-foreground">Activo</Label>
              <Switch checked={formActive} onCheckedChange={setFormActive} />
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
              ) : editProduct ? (
                "Guardar cambios"
              ) : (
                "Crear producto"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
