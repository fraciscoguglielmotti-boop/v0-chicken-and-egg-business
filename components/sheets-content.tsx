"use client";

import { useState } from "react";
import {
  FileSpreadsheet,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Copy,
  Info,
  AlertTriangle,
  Loader2,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SHEET_NAMES, SHEET_COLUMNS } from "@/lib/google-sheets";

interface KeyDebugInfo {
  rawLength: number;
  parsedLength: number;
  rawStartsWith: string;
  rawEndsWith: string;
  parsedStartsWith: string;
  parsedHasBeginMarker: boolean;
  parsedHasEndMarker: boolean;
  parsedHasRealNewlines: boolean;
  parsedNewlineCount: number;
}

interface DiagnoseResult {
  status: string;
  message: string;
  missing?: string[];
  spreadsheetTitle?: string;
  availableSheets?: string[];
  detail?: string;
  keyDebug?: KeyDebugInfo;
}

export function SheetsContent() {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<DiagnoseResult | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const handleTestConnection = async () => {
    setTesting(true);
    setResult(null);
    try {
      const response = await fetch("/api/sheets?action=diagnose");
      const data = await response.json();
      setResult(data);
    } catch (err) {
      setResult({
        status: "network_error",
        message:
          "No se pudo conectar con el servidor. Verifica que la app este corriendo correctamente.",
        detail: String(err),
      });
    } finally {
      setTesting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  };

  const getStatusIcon = () => {
    if (!result) return null;
    switch (result.status) {
      case "connected":
        return <CheckCircle2 className="h-5 w-5 text-primary" />;
      case "missing_vars":
        return <AlertTriangle className="h-5 w-5 text-amber-500" />;
      default:
        return <XCircle className="h-5 w-5 text-destructive" />;
    }
  };

  const getStatusColor = () => {
    if (!result) return "border-border";
    switch (result.status) {
      case "connected":
        return "border-primary bg-primary/5";
      case "missing_vars":
        return "border-amber-500 bg-amber-50";
      default:
        return "border-destructive bg-destructive/5";
    }
  };

  return (
    <div className="space-y-6">
      {/* Diagnostico */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Diagnostico de Conexion
          </CardTitle>
          <CardDescription>
            Prueba la conexion y te mostramos exactamente que esta pasando
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={handleTestConnection} disabled={testing}>
            {testing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Diagnosticando...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Probar Conexion
              </>
            )}
          </Button>

          {result && (
            <div className={`rounded-lg border-2 p-4 ${getStatusColor()}`}>
              <div className="flex items-start gap-3">
                {getStatusIcon()}
                <div className="flex-1 space-y-2">
                  <p className="font-medium text-foreground">{result.message}</p>

                  {result.status === "missing_vars" && result.missing && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">
                        Agrega estas variables en la seccion{" "}
                        <strong>Vars</strong> del sidebar izquierdo de v0:
                      </p>
                      <ul className="space-y-1">
                        {result.missing.map((v) => (
                          <li
                            key={v}
                            className="flex items-center gap-2 text-sm"
                          >
                            <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs text-foreground">
                              {v}
                            </code>
                            <span className="text-destructive">
                              -- no configurada
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {result.status === "connected" && (
                    <div className="space-y-2">
                      {result.spreadsheetTitle && (
                        <p className="text-sm text-muted-foreground">
                          Hoja:{" "}
                          <strong className="text-foreground">
                            {result.spreadsheetTitle}
                          </strong>
                        </p>
                      )}
                      {result.availableSheets &&
                        result.availableSheets.length > 0 && (
                          <div>
                            <p className="text-sm text-muted-foreground mb-1">
                              Pestanas encontradas:
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {result.availableSheets.map((s) => {
                                const isExpected = Object.values(
                                  SHEET_NAMES
                                ).includes(s as string);
                                return (
                                  <span
                                    key={s}
                                    className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs ${
                                      isExpected
                                        ? "bg-primary/10 text-primary"
                                        : "bg-muted text-muted-foreground"
                                    }`}
                                  >
                                    {isExpected && (
                                      <CheckCircle2 className="h-3 w-3" />
                                    )}
                                    {s}
                                  </span>
                                );
                              })}
                            </div>
                            {/* Verificar pestanas faltantes */}
                            {(() => {
                              const missingSheets = Object.values(
                                SHEET_NAMES
                              ).filter(
                                (name) =>
                                  !result.availableSheets?.includes(name)
                              );
                              if (missingSheets.length > 0) {
                                return (
                                  <div className="mt-2">
                                    <p className="text-sm text-amber-600">
                                      Pestanas faltantes (crealas en tu Sheet):
                                    </p>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {missingSheets.map((s) => (
                                        <span
                                          key={s}
                                          className="inline-block rounded bg-amber-100 px-2 py-1 text-xs text-amber-700"
                                        >
                                          {s}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        )}
                    </div>
                  )}

                  {result.status !== "connected" &&
                    result.status !== "missing_vars" && (
                      <div className="space-y-2">
                        {result.detail && (
                          <details className="text-xs text-muted-foreground">
                            <summary className="cursor-pointer hover:text-foreground">
                              Ver detalle tecnico
                            </summary>
                            <pre className="mt-1 whitespace-pre-wrap rounded bg-muted p-2 font-mono">
                              {result.detail}
                            </pre>
                          </details>
                        )}
                        {result.keyDebug && (
                          <details className="text-xs text-muted-foreground">
                            <summary className="cursor-pointer hover:text-foreground">
                              Ver diagnostico de la clave privada
                            </summary>
                            <div className="mt-1 rounded bg-muted p-2 font-mono space-y-1">
                              <p>Largo raw: {result.keyDebug.rawLength} chars</p>
                              <p>Largo parseado: {result.keyDebug.parsedLength} chars</p>
                              <p>Empieza con: <code>{result.keyDebug.rawStartsWith}...</code></p>
                              <p>Termina con: <code>...{result.keyDebug.rawEndsWith}</code></p>
                              <p>Tiene BEGIN marker: {result.keyDebug.parsedHasBeginMarker ? "SI" : "NO"}</p>
                              <p>Tiene END marker: {result.keyDebug.parsedHasEndMarker ? "SI" : "NO"}</p>
                              <p>Tiene saltos de linea reales: {result.keyDebug.parsedHasRealNewlines ? "SI" : "NO"}</p>
                              <p>Cantidad de saltos de linea: {result.keyDebug.parsedNewlineCount}</p>
                            </div>
                          </details>
                        )}
                      </div>
                    )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Guia de configuracion */}
      <Card>
        <CardHeader>
          <CardTitle>Guia de Configuracion Paso a Paso</CardTitle>
          <CardDescription>
            Segui estos pasos para conectar tu hoja de calculo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="step1">
              <AccordionTrigger>
                Paso 1: Crear cuenta de servicio en Google Cloud
              </AccordionTrigger>
              <AccordionContent className="space-y-3">
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                  <li>
                    Anda a{" "}
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
                  <li>Crea un proyecto nuevo o usa uno existente</li>
                  <li>
                    Busca <strong>Google Sheets API</strong> en la biblioteca y
                    habilitala
                  </li>
                  <li>
                    Anda a <strong>Credenciales</strong> {">"}{" "}
                    <strong>Crear credenciales</strong> {">"}{" "}
                    <strong>Cuenta de servicio</strong>
                  </li>
                  <li>
                    Ponele un nombre, crea y despues anda a la pestaña{" "}
                    <strong>Claves</strong>
                  </li>
                  <li>
                    Click en <strong>Agregar clave</strong> {">"}{" "}
                    <strong>Crear clave nueva</strong> {">"}{" "}
                    <strong>JSON</strong>
                  </li>
                  <li>Se descarga un archivo JSON. Guardalo bien.</li>
                </ol>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="step2">
              <AccordionTrigger>
                Paso 2: Compartir tu hoja de calculo
              </AccordionTrigger>
              <AccordionContent className="space-y-3">
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                  <li>Abri tu hoja de Google Sheets</li>
                  <li>
                    Click en <strong>Compartir</strong> (arriba a la derecha)
                  </li>
                  <li>
                    Pega el email de la cuenta de servicio (el{" "}
                    <code className="rounded bg-muted px-1 text-xs text-foreground">
                      client_email
                    </code>{" "}
                    del JSON, termina en{" "}
                    <code className="rounded bg-muted px-1 text-xs text-foreground">
                      @...iam.gserviceaccount.com
                    </code>
                    )
                  </li>
                  <li>
                    Dale permisos de <strong>Editor</strong>
                  </li>
                </ol>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="step3">
              <AccordionTrigger>
                Paso 3: Configurar las variables de entorno
              </AccordionTrigger>
              <AccordionContent className="space-y-4">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>Donde van las variables</AlertTitle>
                  <AlertDescription>
                    En el sidebar izquierdo de v0, anda a la seccion{" "}
                    <strong>Vars</strong> y agrega cada una.
                  </AlertDescription>
                </Alert>

                <div className="space-y-3">
                  {[
                    {
                      name: "GOOGLE_SPREADSHEET_ID",
                      desc: 'El ID de tu hoja. Esta en la URL entre "/d/" y "/edit". Ejemplo: si la URL es https://docs.google.com/spreadsheets/d/1BxiM.../edit, el ID es 1BxiM...',
                    },
                    {
                      name: "GOOGLE_SERVICE_ACCOUNT_EMAIL",
                      desc: 'El campo "client_email" del archivo JSON que descargaste. Es algo como mi-cuenta@mi-proyecto.iam.gserviceaccount.com',
                    },
                    {
                      name: "GOOGLE_PRIVATE_KEY",
                      desc: 'El campo "private_key" del JSON. Copialo COMPLETO, incluyendo "-----BEGIN PRIVATE KEY-----" y "-----END PRIVATE KEY-----"',
                    },
                  ].map((variable) => (
                    <div
                      key={variable.name}
                      className="rounded-lg border bg-muted/30 p-3 space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <Label className="font-mono text-sm font-semibold text-foreground">
                          {variable.name}
                        </Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 text-xs"
                          onClick={() => copyToClipboard(variable.name)}
                        >
                          {copied === variable.name ? (
                            <>
                              <Check className="h-3 w-3" />
                              Copiado
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              Copiar nombre
                            </>
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {variable.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="step4">
              <AccordionTrigger>
                Paso 4: Verificar las pestanas de tu hoja
              </AccordionTrigger>
              <AccordionContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Tu hoja necesita estas pestanas (tabs abajo del todo en Google
                  Sheets). Si no las tenes, crealas:
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {Object.entries(SHEET_NAMES).map(([key, name]) => (
                    <div key={key} className="rounded-lg border p-3">
                      <h4 className="font-semibold text-sm text-foreground mb-2">
                        {name}
                      </h4>
                      <p className="text-xs text-muted-foreground mb-2">
                        Columnas en fila 1:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {SHEET_COLUMNS[
                          key as keyof typeof SHEET_COLUMNS
                        ]?.map((col, idx) => (
                          <span
                            key={idx}
                            className="inline-block rounded bg-muted px-1.5 py-0.5 text-xs text-foreground"
                          >
                            {col}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
