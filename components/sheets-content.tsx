"use client"

import { useState } from "react"
import {
  FileSpreadsheet,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Copy,
  Info,
} from "lucide-react"
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { SHEET_NAMES, SHEET_COLUMNS } from "@/lib/google-sheets"

export function SheetsContent() {
  const [testing, setTesting] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<
    "idle" | "success" | "error"
  >("idle")

  const handleTestConnection = async () => {
    setTesting(true)
    try {
      const response = await fetch("/api/sheets?sheet=Ventas")
      if (response.ok) {
        setConnectionStatus("success")
      } else {
        setConnectionStatus("error")
      }
    } catch {
      setConnectionStatus("error")
    } finally {
      setTesting(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Estado de Conexion
          </CardTitle>
          <CardDescription>
            Verifica la conexion con tu hoja de Google Sheets
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Button onClick={handleTestConnection} disabled={testing}>
              {testing ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Probando...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Probar Conexion
                </>
              )}
            </Button>
            {connectionStatus === "success" && (
              <div className="flex items-center gap-2 text-primary">
                <CheckCircle2 className="h-5 w-5" />
                <span>Conectado correctamente</span>
              </div>
            )}
            {connectionStatus === "error" && (
              <div className="flex items-center gap-2 text-destructive">
                <XCircle className="h-5 w-5" />
                <span>Error de conexion</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Configuration Guide */}
      <Card>
        <CardHeader>
          <CardTitle>Configuracion de Google Sheets</CardTitle>
          <CardDescription>
            Sigue estos pasos para conectar tu hoja de calculo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="step1">
              <AccordionTrigger>
                Paso 1: Crear cuenta de servicio en Google Cloud
              </AccordionTrigger>
              <AccordionContent className="space-y-4">
                <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                  <li>
                    Ve a{" "}
                    <a
                      href="https://console.cloud.google.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline inline-flex items-center gap-1"
                    >
                      Google Cloud Console
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </li>
                  <li>Crea un nuevo proyecto o selecciona uno existente</li>
                  <li>
                    Habilita la API de Google Sheets desde la biblioteca de APIs
                  </li>
                  <li>
                    Ve a Credenciales {">"} Crear credenciales {">"} Cuenta de servicio
                  </li>
                  <li>Descarga el archivo JSON de credenciales</li>
                </ol>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="step2">
              <AccordionTrigger>
                Paso 2: Compartir la hoja de calculo
              </AccordionTrigger>
              <AccordionContent className="space-y-4">
                <p className="text-muted-foreground">
                  Comparte tu hoja de Google Sheets con el email de la cuenta de
                  servicio (termina en @...iam.gserviceaccount.com) como Editor.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="step3">
              <AccordionTrigger>
                Paso 3: Configurar variables de entorno
              </AccordionTrigger>
              <AccordionContent className="space-y-4">
                <p className="text-muted-foreground">
                  Agrega estas variables de entorno en la seccion "Vars" del sidebar:
                </p>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-xs">GOOGLE_SPREADSHEET_ID</Label>
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value="ID de tu hoja (esta en la URL)"
                        className="font-mono text-xs"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard("GOOGLE_SPREADSHEET_ID")}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">GOOGLE_SERVICE_ACCOUNT_EMAIL</Label>
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value="Email del archivo JSON descargado"
                        className="font-mono text-xs"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() =>
                          copyToClipboard("GOOGLE_SERVICE_ACCOUNT_EMAIL")
                        }
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">GOOGLE_PRIVATE_KEY</Label>
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value="private_key del archivo JSON"
                        className="font-mono text-xs"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard("GOOGLE_PRIVATE_KEY")}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* Sheet Structure */}
      <Card>
        <CardHeader>
          <CardTitle>Estructura de Hojas Requerida</CardTitle>
          <CardDescription>
            Tu hoja de Google Sheets debe tener estas pestanas con las siguientes
            columnas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              La primera fila de cada hoja debe contener los encabezados de
              columna exactamente como se muestran abajo.
            </AlertDescription>
          </Alert>

          <div className="grid gap-4 md:grid-cols-2">
            {Object.entries(SHEET_NAMES).map(([key, name]) => (
              <div key={key} className="rounded-lg border p-4">
                <h4 className="font-semibold text-foreground mb-2">{name}</h4>
                <div className="flex flex-wrap gap-1">
                  {SHEET_COLUMNS[key as keyof typeof SHEET_COLUMNS]?.map(
                    (col, idx) => (
                      <span
                        key={idx}
                        className="inline-block rounded bg-muted px-2 py-1 text-xs"
                      >
                        {col}
                      </span>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
