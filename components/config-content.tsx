"use client"

import { useState, useEffect, useCallback } from "react"
import { Save, Plus, UserCog, Shield, ShieldOff, Key, Trash2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { PRODUCTOS } from "@/lib/types"
import { useAuth } from "./auth-guard"

interface UserRow {
  ID: string
  Nombre: string
  Usuario: string
  Rol: string
  Activo: string
}

export function ConfigContent() {
  const { user, refreshAuth } = useAuth()
  const [loginActivo, setLoginActivo] = useState(true)
  const [users, setUsers] = useState<UserRow[]>([])
  const [loadingAuth, setLoadingAuth] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Dialog states
  const [addUserOpen, setAddUserOpen] = useState(false)
  const [resetPassOpen, setResetPassOpen] = useState(false)
  const [selectedUserIdx, setSelectedUserIdx] = useState<number | null>(null)

  // New user form
  const [newUser, setNewUser] = useState({ nombre: "", usuario: "", contrasena: "", rol: "usuario" })
  const [newPassword, setNewPassword] = useState("")

  const [precios, setPrecios] = useState({
    pollo_a: "2500",
    pollo_b: "2200",
    huevo_1: "8500",
    huevo_2: "7500",
  })

  const [empresa, setEmpresa] = useState({
    nombre: "Mi Distribuidora",
    cuit: "",
    direccion: "",
    telefono: "",
  })

  const showMessage = useCallback((type: "success" | "error", text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 4000)
  }, [])

  const fetchAuthData = useCallback(async () => {
    setLoadingAuth(true)
    try {
      const [checkRes, usersRes] = await Promise.all([
        fetch("/api/auth?action=check"),
        fetch("/api/auth?action=users"),
      ])
      const checkData = await checkRes.json()
      const usersData = await usersRes.json()

      setLoginActivo(checkData.loginActivo !== false)
      setUsers(usersData.users || [])
    } catch {
      showMessage("error", "Error al cargar datos de autenticacion")
    } finally {
      setLoadingAuth(false)
    }
  }, [showMessage])

  useEffect(() => {
    fetchAuthData()
  }, [fetchAuthData])

  const handleToggleLogin = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/auth", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle_login", loginActivo: !loginActivo }),
      })
      const data = await res.json()
      if (data.success) {
        setLoginActivo(!loginActivo)
        showMessage("success", loginActivo ? "Login desactivado. Ya no se pedira contrasena." : "Login activado. Se pedira contrasena para ingresar.")
        refreshAuth()
      } else {
        showMessage("error", data.error || "Error al cambiar estado del login")
      }
    } catch {
      showMessage("error", "Error de conexion")
    } finally {
      setSaving(false)
    }
  }

  const handleAddUser = async () => {
    if (!newUser.nombre || !newUser.usuario || !newUser.contrasena) {
      showMessage("error", "Completa todos los campos")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/auth", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_user", ...newUser }),
      })
      const data = await res.json()
      if (data.success) {
        showMessage("success", `Usuario "${newUser.usuario}" creado exitosamente`)
        setNewUser({ nombre: "", usuario: "", contrasena: "", rol: "usuario" })
        setAddUserOpen(false)
        fetchAuthData()
      } else {
        showMessage("error", data.error || "Error al crear usuario")
      }
    } catch {
      showMessage("error", "Error de conexion")
    } finally {
      setSaving(false)
    }
  }

  const handleToggleUserActive = async (idx: number, currentActive: boolean) => {
    setSaving(true)
    try {
      const res = await fetch("/api/auth", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_user", rowIndex: idx, activo: !currentActive }),
      })
      const data = await res.json()
      if (data.success) {
        showMessage("success", !currentActive ? "Usuario activado" : "Usuario desactivado")
        fetchAuthData()
      } else {
        showMessage("error", data.error || "Error al actualizar usuario")
      }
    } catch {
      showMessage("error", "Error de conexion")
    } finally {
      setSaving(false)
    }
  }

  const handleResetPassword = async () => {
    if (selectedUserIdx === null || !newPassword) {
      showMessage("error", "Ingresa la nueva contrasena")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/auth", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset_password", rowIndex: selectedUserIdx, nuevaContrasena: newPassword }),
      })
      const data = await res.json()
      if (data.success) {
        showMessage("success", "Contrasena restablecida exitosamente")
        setResetPassOpen(false)
        setNewPassword("")
        setSelectedUserIdx(null)
      } else {
        showMessage("error", data.error || "Error al restablecer contrasena")
      }
    } catch {
      showMessage("error", "Error de conexion")
    } finally {
      setSaving(false)
    }
  }

  const isAdmin = user?.rol === "admin"

  return (
    <div className="space-y-6">
      {/* Message */}
      {message && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${
          message.type === "success"
            ? "border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200"
            : "border-destructive/50 bg-destructive/10 text-destructive"
        }`}>
          {message.text}
        </div>
      )}

      {/* Login Toggle + User Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5" />
            Acceso y Usuarios
          </CardTitle>
          <CardDescription>
            Controla quien puede acceder al sistema y gestiona usuarios
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Login Toggle */}
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {loginActivo ? (
                  <Shield className="h-4 w-4 text-primary" />
                ) : (
                  <ShieldOff className="h-4 w-4 text-muted-foreground" />
                )}
                <p className="font-medium text-foreground">Login de Acceso</p>
              </div>
              <p className="text-sm text-muted-foreground">
                {loginActivo
                  ? "El sistema requiere usuario y contrasena para ingresar"
                  : "Cualquier persona puede acceder sin credenciales"}
              </p>
            </div>
            <Switch
              checked={loginActivo}
              onCheckedChange={handleToggleLogin}
              disabled={saving || loadingAuth}
            />
          </div>

          {/* Users Table */}
          {loadingAuth ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Usuarios del Sistema</h3>
                {isAdmin && (
                  <Button size="sm" onClick={() => setAddUserOpen(true)} disabled={saving}>
                    <Plus className="mr-1 h-4 w-4" />
                    Nuevo Usuario
                  </Button>
                )}
              </div>
              <div className="rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Usuario</TableHead>
                      <TableHead>Rol</TableHead>
                      <TableHead>Estado</TableHead>
                      {isAdmin && <TableHead className="text-right">Acciones</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={isAdmin ? 6 : 5} className="text-center text-muted-foreground py-6">
                          No hay usuarios registrados
                        </TableCell>
                      </TableRow>
                    ) : (
                      users.map((u, idx) => {
                        const isActive = u.Activo?.toUpperCase() === "TRUE"
                        return (
                          <TableRow key={u.ID}>
                            <TableCell className="font-mono text-xs">{u.ID}</TableCell>
                            <TableCell className="font-medium">{u.Nombre}</TableCell>
                            <TableCell>{u.Usuario}</TableCell>
                            <TableCell>
                              <Badge variant={u.Rol === "admin" ? "default" : "secondary"}>
                                {u.Rol === "admin" ? "Admin" : "Usuario"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={isActive ? "outline" : "destructive"} className={isActive ? "border-green-300 text-green-700 dark:border-green-700 dark:text-green-400" : ""}>
                                {isActive ? "Activo" : "Inactivo"}
                              </Badge>
                            </TableCell>
                            {isAdmin && (
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedUserIdx(idx)
                                      setNewPassword("")
                                      setResetPassOpen(true)
                                    }}
                                    title="Restablecer contrasena"
                                    disabled={saving}
                                  >
                                    <Key className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleToggleUserActive(idx, isActive)}
                                    title={isActive ? "Desactivar usuario" : "Activar usuario"}
                                    disabled={saving}
                                  >
                                    {isActive ? (
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    ) : (
                                      <Shield className="h-4 w-4 text-primary" />
                                    )}
                                  </Button>
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Datos de la Empresa */}
      <Card>
        <CardHeader>
          <CardTitle>Datos de la Empresa</CardTitle>
          <CardDescription>
            Informacion general de tu negocio
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Nombre del Negocio</Label>
              <Input
                value={empresa.nombre}
                onChange={(e) => setEmpresa({ ...empresa, nombre: e.target.value })}
                placeholder="Mi Distribuidora"
              />
            </div>
            <div className="space-y-2">
              <Label>CUIT</Label>
              <Input
                value={empresa.cuit}
                onChange={(e) => setEmpresa({ ...empresa, cuit: e.target.value })}
                placeholder="XX-XXXXXXXX-X"
              />
            </div>
            <div className="space-y-2">
              <Label>Direccion</Label>
              <Input
                value={empresa.direccion}
                onChange={(e) => setEmpresa({ ...empresa, direccion: e.target.value })}
                placeholder="Calle 123"
              />
            </div>
            <div className="space-y-2">
              <Label>Telefono</Label>
              <Input
                value={empresa.telefono}
                onChange={(e) => setEmpresa({ ...empresa, telefono: e.target.value })}
                placeholder="11-XXXX-XXXX"
              />
            </div>
          </div>
          <Button>
            <Save className="mr-2 h-4 w-4" />
            Guardar Cambios
          </Button>
        </CardContent>
      </Card>

      {/* Precios de Productos */}
      <Card>
        <CardHeader>
          <CardTitle>Precios de Lista</CardTitle>
          <CardDescription>
            Precios base de tus productos (se pueden modificar al momento de la venta)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {PRODUCTOS.map((producto) => (
              <div key={producto.id} className="space-y-2">
                <Label>{producto.nombre}</Label>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">$</span>
                  <Input
                    type="number"
                    value={precios[producto.id as keyof typeof precios]}
                    onChange={(e) => setPrecios({ ...precios, [producto.id]: e.target.value })}
                  />
                  <span className="text-sm text-muted-foreground">/{producto.unidad}</span>
                </div>
              </div>
            ))}
          </div>
          <Button>
            <Save className="mr-2 h-4 w-4" />
            Guardar Precios
          </Button>
        </CardContent>
      </Card>

      {/* Add User Dialog */}
      <Dialog open={addUserOpen} onOpenChange={setAddUserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo Usuario</DialogTitle>
            <DialogDescription>
              Crea un nuevo usuario para acceder al sistema
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nombre Completo</Label>
              <Input
                value={newUser.nombre}
                onChange={(e) => setNewUser({ ...newUser, nombre: e.target.value })}
                placeholder="Juan Perez"
              />
            </div>
            <div className="space-y-2">
              <Label>Usuario (para login)</Label>
              <Input
                value={newUser.usuario}
                onChange={(e) => setNewUser({ ...newUser, usuario: e.target.value })}
                placeholder="jperez"
              />
            </div>
            <div className="space-y-2">
              <Label>Contrasena</Label>
              <Input
                type="password"
                value={newUser.contrasena}
                onChange={(e) => setNewUser({ ...newUser, contrasena: e.target.value })}
                placeholder="Minimo 4 caracteres"
              />
            </div>
            <div className="space-y-2">
              <Label>Rol</Label>
              <Select value={newUser.rol} onValueChange={(v) => setNewUser({ ...newUser, rol: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="usuario">Usuario</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddUserOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddUser} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Crear Usuario
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetPassOpen} onOpenChange={setResetPassOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restablecer Contrasena</DialogTitle>
            <DialogDescription>
              {selectedUserIdx !== null && users[selectedUserIdx]
                ? `Ingresa la nueva contrasena para "${users[selectedUserIdx].Nombre}" (${users[selectedUserIdx].Usuario})`
                : "Ingresa la nueva contrasena"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nueva Contrasena</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Ingresa la nueva contrasena"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPassOpen(false)}>Cancelar</Button>
            <Button onClick={handleResetPassword} disabled={saving || !newPassword}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Key className="mr-2 h-4 w-4" />}
              Restablecer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
