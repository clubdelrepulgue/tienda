"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import { Edit2, Loader2, Plus, ShieldCheck, Trash2, UserCog } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { Skeleton } from "@/components/ui/skeleton"
import {
  createAdminUser,
  removeAdminUserAccess,
  updateAdminUserAccess,
} from "@/app/actions"
import type { AdminRole, AdminUserAccount, Branch } from "@/lib/types"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const roleLabels: Record<AdminRole, string> = {
  owner: "Owner",
  admin: "Admin",
  operator: "Operador",
}

const roleDescriptions: Record<AdminRole, string> = {
  owner: "Acceso total al sistema y usuarios.",
  admin: "Acceso global operativo y configuracion.",
  operator: "Solo opera una sucursal asignada.",
}

function formatDate(value: string | null) {
  if (!value) return "Nunca"

  return new Date(value).toLocaleString("es-UY", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function getRoleBadgeClass(role: AdminRole) {
  if (role === "owner") return "border-primary/20 bg-primary/15 text-primary"
  if (role === "admin") return "border-chart-2/20 bg-chart-2/15 text-chart-2"
  return "border-muted bg-secondary text-muted-foreground"
}

export default function AdminUsersPage() {
  const { data, mutate, isLoading } = useSWR<{
    users?: AdminUserAccount[]
    branches?: Branch[]
    error?: string
  }>("/api/admin?type=admin-users", fetcher)

  const users = Array.isArray(data?.users) ? data.users : []
  const branches = Array.isArray(data?.branches) ? data.branches : []

  const [createOpen, setCreateOpen] = useState(false)
  const [editUser, setEditUser] = useState<AdminUserAccount | null>(null)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<AdminRole>("operator")
  const [branchId, setBranchId] = useState("")

  const globalUsersCount = useMemo(
    () => users.filter((user) => user.role === "owner" || user.role === "admin").length,
    [users]
  )

  const resetForm = () => {
    setName("")
    setEmail("")
    setPassword("")
    setRole("operator")
    setBranchId(branches[0]?.id || "")
  }

  const openCreate = () => {
    resetForm()
    setCreateOpen(true)
  }

  const openEdit = (user: AdminUserAccount) => {
    setEditUser(user)
    setName(user.name)
    setRole(user.role)
    setBranchId(user.branchId || branches[0]?.id || "")
  }

  const handleCreate = async () => {
    if (!email.trim() || !password.trim()) {
      toast.error("Email y contrasena son obligatorios")
      return
    }
    if (role === "operator" && !branchId) {
      toast.error("Selecciona una sucursal para el operador")
      return
    }

    setSaving(true)
    try {
      const result = await createAdminUser({
        email,
        password,
        name,
        role,
        branchId: role === "operator" ? branchId : null,
      })

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success("Usuario creado")
      setCreateOpen(false)
      resetForm()
      mutate()
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async () => {
    if (!editUser) return
    if (role === "operator" && !branchId) {
      toast.error("Selecciona una sucursal para el operador")
      return
    }

    setSaving(true)
    try {
      const result = await updateAdminUserAccess(editUser.userId, {
        role,
        branchId: role === "operator" ? branchId : null,
        name,
      })

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success("Usuario actualizado")
      setEditUser(null)
      mutate()
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveAccess = async (user: AdminUserAccount) => {
    if (!confirm(`Quitar acceso admin a ${user.email}? El usuario de Auth no se borra.`)) return

    const result = await removeAdminUserAccess(user.userId)
    if (result.error) {
      toast.error(result.error)
      return
    }

    toast.success("Acceso removido")
    mutate()
  }

  if (isLoading) {
    return (
      <div className="flex max-w-6xl flex-col gap-6">
        <div>
          <Skeleton className="h-8 w-44" />
          <Skeleton className="mt-2 h-4 w-72" />
        </div>
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    )
  }

  if (data?.error) {
    return (
      <div className="flex max-w-3xl flex-col gap-4 rounded-2xl border border-destructive/20 bg-destructive/10 p-6 text-destructive">
        <h1 className="text-xl font-bold">No tienes acceso</h1>
        <p className="text-sm">Solo owners y admins globales pueden gestionar usuarios.</p>
      </div>
    )
  }

  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1
            className="text-2xl font-bold text-foreground"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Usuarios
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Crea administradores globales y operadores por sucursal.
          </p>
        </div>
        <Button className="rounded-xl gap-2" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Crear usuario
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Usuarios admin</p>
          <p className="mt-2 text-2xl font-bold text-foreground">{users.length}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Globales</p>
          <p className="mt-2 text-2xl font-bold text-foreground">{globalUsersCount}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Operadores</p>
          <p className="mt-2 text-2xl font-bold text-foreground">
            {users.length - globalUsersCount}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Usuario</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Sucursal</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Ultimo acceso</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                      {user.role === "operator" ? (
                        <UserCog className="h-5 w-5" />
                      ) : (
                        <ShieldCheck className="h-5 w-5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{user.name || user.email}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn("rounded-full", getRoleBadgeClass(user.role))}>
                    {roleLabels[user.role]}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {user.role === "operator" ? user.branchName || "Sin sucursal" : "Todas"}
                </TableCell>
                <TableCell>
                  <Badge variant={user.emailConfirmed ? "outline" : "secondary"} className="rounded-full">
                    {user.emailConfirmed ? "Confirmado" : "Pendiente"}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(user.lastSignInAt)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(user)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleRemoveAccess(user)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  No hay usuarios admin configurados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <UserDialog
        open={createOpen}
        title="Crear usuario"
        saving={saving}
        branches={branches}
        mode="create"
        name={name}
        email={email}
        password={password}
        role={role}
        branchId={branchId}
        onOpenChange={setCreateOpen}
        onNameChange={setName}
        onEmailChange={setEmail}
        onPasswordChange={setPassword}
        onRoleChange={setRole}
        onBranchChange={setBranchId}
        onSubmit={handleCreate}
      />

      <UserDialog
        open={Boolean(editUser)}
        title="Editar acceso"
        saving={saving}
        branches={branches}
        mode="edit"
        name={name}
        email={editUser?.email || ""}
        password=""
        role={role}
        branchId={branchId}
        onOpenChange={(open) => {
          if (!open) setEditUser(null)
        }}
        onNameChange={setName}
        onEmailChange={() => undefined}
        onPasswordChange={() => undefined}
        onRoleChange={setRole}
        onBranchChange={setBranchId}
        onSubmit={handleUpdate}
      />
    </div>
  )
}

function UserDialog({
  open,
  title,
  saving,
  branches,
  mode,
  name,
  email,
  password,
  role,
  branchId,
  onOpenChange,
  onNameChange,
  onEmailChange,
  onPasswordChange,
  onRoleChange,
  onBranchChange,
  onSubmit,
}: {
  open: boolean
  title: string
  saving: boolean
  branches: Branch[]
  mode: "create" | "edit"
  name: string
  email: string
  password: string
  role: AdminRole
  branchId: string
  onOpenChange: (open: boolean) => void
  onNameChange: (value: string) => void
  onEmailChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onRoleChange: (value: AdminRole) => void
  onBranchChange: (value: string) => void
  onSubmit: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl bg-card">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div>
            <Label htmlFor={`${mode}-name`} className="mb-1.5 block text-sm text-muted-foreground">
              Nombre
            </Label>
            <Input
              id={`${mode}-name`}
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder="Nombre del usuario"
              className="rounded-xl"
            />
          </div>

          <div>
            <Label htmlFor={`${mode}-email`} className="mb-1.5 block text-sm text-muted-foreground">
              Email
            </Label>
            <Input
              id={`${mode}-email`}
              type="email"
              value={email}
              disabled={mode === "edit"}
              onChange={(event) => onEmailChange(event.target.value)}
              placeholder="usuario@empresa.com"
              className="rounded-xl"
            />
          </div>

          {mode === "create" && (
            <div>
              <Label htmlFor="create-password" className="mb-1.5 block text-sm text-muted-foreground">
                Contrasena inicial
              </Label>
              <Input
                id="create-password"
                type="password"
                value={password}
                onChange={(event) => onPasswordChange(event.target.value)}
                placeholder="Minimo 8 caracteres"
                className="rounded-xl"
              />
            </div>
          )}

          <div>
            <Label className="mb-1.5 block text-sm text-muted-foreground">Rol</Label>
            <Select value={role} onValueChange={(value) => onRoleChange(value as AdminRole)}>
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["owner", "admin", "operator"] as AdminRole[]).map((item) => (
                  <SelectItem key={item} value={item}>
                    {roleLabels[item]} - {roleDescriptions[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {role === "operator" && (
            <div>
              <Label className="mb-1.5 block text-sm text-muted-foreground">Sucursal</Label>
              <Select value={branchId} onValueChange={onBranchChange}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Selecciona sucursal" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button className="rounded-xl" onClick={onSubmit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "create" ? "Crear usuario" : "Guardar cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
