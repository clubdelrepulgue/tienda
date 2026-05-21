"use client"

import { useState } from "react"
import useSWR from "swr"
import { Plus, Pencil, Trash2, Search, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import type { Category } from "@/lib/types"
import { toast } from "sonner"
import { createCategory, updateCategory, deleteCategory } from "@/app/actions"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function CategoriesPage() {
    const { data: categories, mutate: mutateCategories, isLoading } = useSWR<Category[]>(
        "/api/admin?type=categories",
        fetcher
    )

    const [search, setSearch] = useState("")
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editCategory, setEditCategory] = useState<Category | null>(null)
    const [saving, setSaving] = useState(false)

    const [formName, setFormName] = useState("")
    const [formSlug, setFormSlug] = useState("")
    const [formOrder, setFormOrder] = useState("")

    const safeCategories = Array.isArray(categories) ? categories : []
    const filtered = safeCategories.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase())
    )

    const openCreate = () => {
        setEditCategory(null)
        setFormName("")
        setFormSlug("")
        setFormOrder("0")
        setDialogOpen(true)
    }

    const openEdit = (category: Category) => {
        setEditCategory(category)
        setFormName(category.name)
        setFormSlug(category.slug)
        setFormOrder((category.order || 0).toString())
        setDialogOpen(true)
    }

    const generateSlug = (name: string) => {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)+/g, "")
    }

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value
        setFormName(val)
        if (!editCategory) {
            setFormSlug(generateSlug(val))
        }
    }

    const handleSave = async () => {
        if (!formName || !formSlug) {
            toast.error("Please fill all required fields")
            return
        }

        setSaving(true)
        try {
            if (editCategory) {
                const result = await updateCategory(editCategory.id, {
                    nombre: formName,
                    slug: formSlug,
                    orden: parseInt(formOrder) || 0,
                })
                if (result.error) {
                    toast.error(result.error)
                    return
                }
                toast.success("Category updated")
            } else {
                const result = await createCategory({
                    nombre: formName,
                    slug: formSlug,
                    orden: parseInt(formOrder) || 0,
                })
                if (result.error) {
                    toast.error(result.error)
                    return
                }
                toast.success("Category created")
            }
            setDialogOpen(false)
            mutateCategories()
        } catch {
            toast.error("Something went wrong")
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!window.confirm("Are you sure you want to delete this category? Products linked to it might be affected.")) return

        try {
            const result = await deleteCategory(id)
            if (result.error) {
                toast.error(result.error)
                return
            }
            toast.success("Category deleted")
            mutateCategories()
        } catch {
            toast.error("Failed to delete category")
        }
    }

    if (isLoading) {
        return (
            <div className="flex flex-col gap-6 max-w-4xl">
                <div>
                    <Skeleton className="h-8 w-32" />
                    <Skeleton className="h-4 w-48 mt-2" />
                </div>
                <Card className="rounded-2xl bg-card border-border">
                    <CardContent className="p-6">
                        {[1, 2, 3].map((i) => (
                            <Skeleton key={i} className="h-14 w-full mb-3" />
                        ))}
                    </CardContent>
                </Card>
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
                        Categories
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Organize your products into categories
                    </p>
                </div>
                <Button
                    className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
                    onClick={openCreate}
                >
                    <Plus className="h-4 w-4" />
                    Add Category
                </Button>
            </div>

            <Card className="rounded-2xl bg-card border-border">
                <CardHeader className="pb-4">
                    <div className="flex items-center gap-3">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search categories..."
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
                                    <TableHead className="text-muted-foreground">Order</TableHead>
                                    <TableHead className="text-muted-foreground">Name</TableHead>
                                    <TableHead className="text-muted-foreground">Slug</TableHead>
                                    <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.map((category) => (
                                    <TableRow key={category.id} className="border-border">
                                        <TableCell className="font-medium text-muted-foreground">
                                            {category.order}
                                        </TableCell>
                                        <TableCell>
                                            <span className="font-medium text-sm text-foreground">
                                                {category.name}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-sm font-mono text-muted-foreground bg-secondary px-2 py-0.5 rounded-md">
                                                {category.slug}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    onClick={() => openEdit(category)}
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                                    onClick={() => handleDelete(category.id)}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {filtered.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                            No categories found.
                                        </TableCell>
                                    </TableRow>
                                )}
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
                            {editCategory ? "Edit Category" : "Create Category"}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-4 py-4">
                        <div>
                            <Label className="text-sm text-muted-foreground mb-1.5 block">
                                Name
                            </Label>
                            <Input
                                value={formName}
                                onChange={handleNameChange}
                                placeholder="e.g. Burgers"
                                className="rounded-xl bg-secondary border-0 text-foreground placeholder:text-muted-foreground"
                            />
                        </div>
                        <div>
                            <Label className="text-sm text-muted-foreground mb-1.5 block">
                                Slug
                            </Label>
                            <Input
                                value={formSlug}
                                onChange={(e) => setFormSlug(e.target.value)}
                                placeholder="e.g. burgers"
                                className="rounded-xl bg-secondary border-0 text-foreground placeholder:text-muted-foreground"
                            />
                        </div>
                        <div>
                            <Label className="text-sm text-muted-foreground mb-1.5 block">
                                Order (Display priority)
                            </Label>
                            <Input
                                type="number"
                                value={formOrder}
                                onChange={(e) => setFormOrder(e.target.value)}
                                placeholder="0"
                                className="rounded-xl bg-secondary border-0 text-foreground placeholder:text-muted-foreground"
                            />
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
                            ) : editCategory ? (
                                "Save Changes"
                            ) : (
                                "Create Category"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
