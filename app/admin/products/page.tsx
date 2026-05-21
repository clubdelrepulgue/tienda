"use client"

import { useState } from "react"
import Image from "next/image"
import useSWR from "swr"
import { Plus, Pencil, Search, Loader2, Upload, X } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function ProductsPage() {
  const { data: products, mutate: mutateProducts, isLoading: productsLoading } = useSWR<Product[]>(
    "/api/admin?type=products",
    fetcher
  )
  const { data: categories } = useSWR<Category[]>(
    "/api/admin?type=categories",
    fetcher
  )
  const { data: modifiers } = useSWR<ModifierGroup[]>(
    "/api/admin?type=modifiers",
    fetcher
  )

  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [saving, setSaving] = useState(false)

  const [formName, setFormName] = useState("")
  const [formPrice, setFormPrice] = useState("")
  const [formCategory, setFormCategory] = useState("")
  const [formActive, setFormActive] = useState(true)
  const [formModifierGroups, setFormModifierGroups] = useState<string[]>([])

  // Multiple images state
  const [existingImages, setExistingImages] = useState<string[]>([])
  const [newImageFiles, setNewImageFiles] = useState<{ file: File, preview: string }[]>([])

  const safeProducts = Array.isArray(products) ? products : []
  const filtered = safeProducts.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  const openCreate = () => {
    setEditProduct(null)
    setFormName("")
    setFormPrice("")
    const safeCategories = Array.isArray(categories) ? categories : []
    setFormCategory(safeCategories?.[0]?.id || "")
    setFormActive(true)
    setFormModifierGroups([])
    setExistingImages([])
    setNewImageFiles([])
    setDialogOpen(true)
  }

  const openEdit = (product: Product) => {
    setEditProduct(product)
    setFormName(product.name)
    setFormPrice(product.price.toString())
    setFormCategory(product.categoryId)
    setFormActive(product.active)
    setFormModifierGroups(product.modifierGroups || [])
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

  const handleSave = async () => {
    if (!formName || !formPrice || !formCategory) {
      toast.error("Please fill all required fields")
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
          toast.error("Error uploading image: " + uploadError.message)
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
          nombre: formName,
          precio: parseFloat(formPrice),
          images: allImages,
          categoriaId: formCategory,
          activo: formActive,
          modifierGroupIds: formModifierGroups,
        })
        if (result.error) {
          toast.error(result.error)
          setSaving(false)
          return
        }
        toast.success("Product updated")
      } else {
        const result = await createProduct({
          nombre: formName,
          precio: parseFloat(formPrice),
          images: allImages,
          categoriaId: formCategory,
          activo: formActive,
          modifierGroupIds: formModifierGroups,
        })
        if (result.error) {
          toast.error(result.error)
          setSaving(false)
          return
        }
        toast.success("Product created")
      }
      setDialogOpen(false)
      mutateProducts()
    } catch (error) {
      console.error(error)
      toast.error("Something went wrong")
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
    return safeCategories.find((c) => c.id === id)?.name || "Unknown"
  }

  if (productsLoading) {
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
            Products
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your menu items
          </p>
        </div>
        <Button
          className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
          onClick={openCreate}
        >
          <Plus className="h-4 w-4" />
          Add Product
        </Button>
      </div>

      <Card className="rounded-2xl bg-card border-border">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
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
                  <TableHead className="text-muted-foreground">Product</TableHead>
                  <TableHead className="text-muted-foreground">Category</TableHead>
                  <TableHead className="text-muted-foreground">Price</TableHead>
                  <TableHead className="text-muted-foreground">Status</TableHead>
                  <TableHead className="text-muted-foreground text-right">Actions</TableHead>
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
                      ${product.price.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={product.active}
                        onCheckedChange={() => handleToggleActive(product.id)}
                        aria-label={`Toggle ${product.name} active status`}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(product)}
                        aria-label={`Edit ${product.name}`}
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
              {editProduct ? "Edit Product" : "Create Product"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4 max-h-[70vh] overflow-y-auto pr-2">

            {/* Images Grid */}
            <div>
              <Label className="text-sm text-muted-foreground mb-2 block">Images</Label>
              <div className="grid grid-cols-3 gap-3">
                {/* Existing Images */}
                {existingImages.map((url, i) => (
                  <div key={`existing-${i}`} className="relative aspect-square rounded-xl overflow-hidden bg-secondary group border border-border">
                    <Image src={url} alt={`Image ${i}`} fill className="object-cover" />
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
                    <Image src={item.preview} alt={`New Image ${i}`} fill className="object-cover" />
                    <button
                      onClick={() => handleRemoveNew(i)}
                      className="absolute top-1 right-1 h-6 w-6 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    <div className="absolute bottom-1 right-1 bg-primary text-[10px] px-1 rounded text-primary-foreground font-bold">NEW</div>
                  </div>
                ))}

                {/* Add Button */}
                <Label className="relative aspect-square rounded-xl border-2 border-dashed border-border hover:border-primary/50 cursor-pointer flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary transition-colors bg-secondary/30">
                  <Upload className="h-5 w-5" />
                  <span className="text-[10px] font-medium">Add Image</span>
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
                Name
              </Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Product name"
                className="rounded-xl bg-secondary border-0 text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <Label className="text-sm text-muted-foreground mb-1.5 block">
                Price
              </Label>
              <Input
                type="number"
                step="0.01"
                value={formPrice}
                onChange={(e) => setFormPrice(e.target.value)}
                placeholder="0.00"
                className="rounded-xl bg-secondary border-0 text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <Label className="text-sm text-muted-foreground mb-1.5 block">
                Category
              </Label>
              <Select value={formCategory} onValueChange={setFormCategory}>
                <SelectTrigger className="rounded-xl bg-secondary border-0 text-foreground">
                  <SelectValue placeholder="Select category" />
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
                Modifier Groups
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
                  <span className="text-xs text-muted-foreground text-center py-2">No modifiers available</span>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm text-muted-foreground">Active</Label>
              <Switch checked={formActive} onCheckedChange={setFormActive} />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : editProduct ? (
                "Save Changes"
              ) : (
                "Create Product"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
