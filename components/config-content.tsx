"use client"

import { useState } from "react"
import { Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PRODUCTOS } from "@/lib/types"

export function ConfigContent() {
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

  return (
    <div className="space-y-6">
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
                onChange={(e) =>
                  setEmpresa({ ...empresa, nombre: e.target.value })
                }
                placeholder="Mi Distribuidora"
              />
            </div>
            <div className="space-y-2">
              <Label>CUIT</Label>
              <Input
                value={empresa.cuit}
                onChange={(e) =>
                  setEmpresa({ ...empresa, cuit: e.target.value })
                }
                placeholder="XX-XXXXXXXX-X"
              />
            </div>
            <div className="space-y-2">
              <Label>Direccion</Label>
              <Input
                value={empresa.direccion}
                onChange={(e) =>
                  setEmpresa({ ...empresa, direccion: e.target.value })
                }
                placeholder="Calle 123"
              />
            </div>
            <div className="space-y-2">
              <Label>Telefono</Label>
              <Input
                value={empresa.telefono}
                onChange={(e) =>
                  setEmpresa({ ...empresa, telefono: e.target.value })
                }
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
            Precios base de tus productos (se pueden modificar al momento de la
            venta)
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
                    onChange={(e) =>
                      setPrecios({ ...precios, [producto.id]: e.target.value })
                    }
                  />
                  <span className="text-sm text-muted-foreground">
                    /{producto.unidad}
                  </span>
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

      {/* Configuracion de Impresion */}
      <Card>
        <CardHeader>
          <CardTitle>Formato de Documentos</CardTitle>
          <CardDescription>
            Configuracion para remitos y facturas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Prefijo Remito</Label>
              <Input placeholder="R-" defaultValue="R-" />
            </div>
            <div className="space-y-2">
              <Label>Numero Inicial</Label>
              <Input type="number" placeholder="1" defaultValue="1" />
            </div>
          </div>
          <Button variant="outline">
            <Save className="mr-2 h-4 w-4" />
            Guardar Configuracion
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
