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

interface DiagnoseResult {
  status: string;
  message: string;
  missing?: string[];
  spreadsheetTitle?: string;
  availableSheets?: string[];
  serviceAccountEmail?: string;
  detail?: string;
  configInfo?: {
    hasJson: boolean;
    hasEmail: boolean;
    hasKey: boolean;
    jsonLength: number;
  };
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
            Prueba la conexion con tu hoja de Google Sheets
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

                  {result.status === "connected" && (
                    <div className="space-y-2">
                      {result.serviceAccountEmail && (
                        <p className="text-sm text-muted-foreground">
                          Cuenta de servicio: <strong className="text-foreground">{result.serviceAccountEmail}</strong>
                        </p>
                      )}
                      {result.spreadsheetTitle && (
                        <p className="text-sm text-muted-foreground">
                          Hoja: <strong className="text-foreground">{result.spreadsheetTitle}</strong>
                        </p>
                      )}
                      {result.availableSheets && result.availableSheets.length > 0 && (
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Pestanas encontradas:</p>
                          <div className="flex flex-wrap gap-1">
                            {result.availableSheets.map((s) => {
                              const isExpected = Object.values(SHEET_NAMES).includes(s as string);
                              return (
                                <span
                                  key={s}
                                  className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs ${
                                    isExpected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                                  }`}
                                >
                                  {isExpected && <CheckCircle2 className="h-3 w-3" />}
                                  {s}
                                </span>
                              );
                            })}
                          </div>
                          {(() => {
                            const missingSheets = Object.values(SHEET_NAMES).filter(
                              (name) => !result.availableSheets?.includes(name)
                            );
                            if (missingSheets.length > 0) {
                              return (
                                <div className="mt-2">
                                  <p className="text-sm text-amber-600">Pestanas faltantes (crealas en tu Sheet):</p>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {missingSheets.map((s) => (
                                      <span key={s} className="inline-block rounded bg-amber-100 px-2 py-1 text-xs text-amber-700">
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

                  {result.configInfo && (
                    <div className="rounded bg-muted p-2 text-xs space-y-1">
                      <p className="font-semibold text-foreground">Estado de las variables:</p>
                      <p>GOOGLE_SERVICE_ACCOUNT_JSON: {result.configInfo.hasJson ? `Configurada (${result.configInfo.jsonLength} chars)` : "No configurada"}</p>
                      <p>GOOGLE_SERVICE_ACCOUNT_EMAIL: {result.configInfo.hasEmail ? "Configurada" : "No configurada"}</p>
                      <p>GOOGLE_PRIVATE_KEY: {result.configInfo.hasKey ? "Configurada" : "No configurada"}</p>
                    </div>
                  )}

                  {result.detail && result.status !== "connected" && (
                    <details className="text-xs text-muted-foreground">
                      <summary className="cursor-pointer hover:text-foreground">Ver detalle tecnico</summary>
                      <pre className="mt-1 whitespace-pre-wrap rounded bg-muted p-2 font-mono">{result.detail}</pre>
                    </details>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Guia */}
      <Card>
        <CardHeader>
          <CardTitle>Guia de Configuracion</CardTitle>
          <CardDescription>Segui estos pasos para conectar tu hoja de calculo</CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full" defaultValue="step3">
            <AccordionItem value="step1">
              <AccordionTrigger>Paso 1: Crear cuenta de servicio en Google Cloud</AccordionTrigger>
              <AccordionContent className="space-y-3">
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                  <li>
                    Anda a{" "}
                    <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="text-primary underline inline-flex items-center gap-1">
                      Google Cloud Console <ExternalLink className="h-3 w-3" />
                    </a>
                  </li>
                  <li>Crea un proyecto nuevo o usa uno existente</li>
                  <li>Busca <strong>Google Sheets API</strong> y habilitala</li>
                  <li>Anda a <strong>Credenciales</strong> {">"} <strong>Crear credenciales</strong> {">"} <strong>Cuenta de servicio</strong></li>
                  <li>Crea la cuenta, anda a <strong>Claves</strong> {">"} <strong>Agregar clave</strong> {">"} <strong>JSON</strong></li>
                  <li>Se descarga un archivo JSON. Guardalo bien.</li>
                </ol>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="step2">
              <AccordionTrigger>Paso 2: Compartir tu hoja de calculo</AccordionTrigger>
              <AccordionContent className="space-y-3">
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                  <li>Abri tu hoja de Google Sheets</li>
                  <li>Click en <strong>Compartir</strong></li>
                  <li>
                    Pega el email de la cuenta de servicio (del JSON, campo <code className="rounded bg-muted px-1 text-xs text-foreground">client_email</code>)
                  </li>
                  <li>Dale permisos de <strong>Editor</strong></li>
                </ol>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="step3">
              <AccordionTrigger>Paso 3: Configurar variables de entorno (IMPORTANTE)</AccordionTrigger>
              <AccordionContent className="space-y-4">
                <Alert className="border-primary bg-primary/5">
                  <Info className="h-4 w-4" />
                  <AlertTitle>Metodo recomendado (evita problemas con la clave privada)</AlertTitle>
                  <AlertDescription>
                    Solo necesitas <strong>2 variables</strong>. Agregalas en el sidebar {">"} <strong>Vars</strong>.
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="font-mono text-sm font-bold text-foreground">GOOGLE_SPREADSHEET_ID</Label>
                      <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => copyToClipboard("GOOGLE_SPREADSHEET_ID")}>
                        {copied === "GOOGLE_SPREADSHEET_ID" ? <><Check className="h-3 w-3" /> Copiado</> : <><Copy className="h-3 w-3" /> Copiar</>}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      El ID de tu hoja. Esta en la URL de Google Sheets:
                    </p>
                    <code className="block rounded bg-muted p-2 text-xs text-foreground break-all">
                      {'https://docs.google.com/spreadsheets/d/'}
                      <strong className="text-primary">{'ESTE_ES_EL_ID'}</strong>
                      {'/edit'}
                    </code>
                  </div>

                  <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="font-mono text-sm font-bold text-foreground">GOOGLE_SERVICE_ACCOUNT_JSON</Label>
                      <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => copyToClipboard("GOOGLE_SERVICE_ACCOUNT_JSON")}>
                        {copied === "GOOGLE_SERVICE_ACCOUNT_JSON" ? <><Check className="h-3 w-3" /> Copiado</> : <><Copy className="h-3 w-3" /> Copiar</>}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Abri el archivo JSON que descargaste de Google Cloud y <strong>pega TODO el contenido</strong> como valor de esta variable.
                    </p>
                    <div className="rounded bg-muted p-2 text-xs font-mono text-muted-foreground">
                      <p>{'{'}</p>
                      <p className="pl-4">{'"type": "service_account",'}</p>
                      <p className="pl-4">{'"project_id": "...",'}</p>
                      <p className="pl-4">{'"private_key": "-----BEGIN...",'}</p>
                      <p className="pl-4">{'"client_email": "...@....iam.gserviceaccount.com",'}</p>
                      <p className="pl-4">{'...'}</p>
                      <p>{'}'}</p>
                    </div>
                    <p className="text-xs text-amber-600 font-medium">
                      Copia TODO el JSON completo, desde la llave de apertura hasta la llave de cierre.
                    </p>
                  </div>
                </div>

                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer hover:text-foreground font-medium">
                    Metodo alternativo (3 variables separadas)
                  </summary>
                  <div className="mt-2 space-y-2">
                    <p>Si preferis usar variables separadas en vez del JSON completo:</p>
                    {[
                      { name: "GOOGLE_SPREADSHEET_ID", desc: "ID de la hoja (de la URL)" },
                      { name: "GOOGLE_SERVICE_ACCOUNT_EMAIL", desc: 'Campo "client_email" del JSON' },
                      { name: "GOOGLE_PRIVATE_KEY", desc: 'Campo "private_key" del JSON, sin comillas externas' },
                    ].map((v) => (
                      <div key={v.name} className="rounded border p-2">
                        <code className="font-mono text-xs font-semibold text-foreground">{v.name}</code>
                        <p className="text-xs text-muted-foreground">{v.desc}</p>
                      </div>
                    ))}
                  </div>
                </details>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="step4">
              <AccordionTrigger>Paso 4: Verificar las pestanas de tu hoja</AccordionTrigger>
              <AccordionContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Tu hoja necesita estas pestanas con los encabezados en la fila 1:
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {Object.entries(SHEET_NAMES).map(([key, name]) => (
                    <div key={key} className="rounded-lg border p-3">
                      <h4 className="font-semibold text-sm text-foreground mb-2">{name}</h4>
                      <p className="text-xs text-muted-foreground mb-2">Columnas en fila 1:</p>
                      <div className="flex flex-wrap gap-1">
                        {SHEET_COLUMNS[key as keyof typeof SHEET_COLUMNS]?.map((col, idx) => (
                          <span key={idx} className="inline-block rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">{col}</span>
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
