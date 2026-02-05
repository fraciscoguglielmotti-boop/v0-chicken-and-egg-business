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
  KeyRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  method?: string;
}

export function SheetsContent() {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<DiagnoseResult | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Base64 converter state
  const [jsonInput, setJsonInput] = useState("");
  const [base64Output, setBase64Output] = useState("");
  const [convertError, setConvertError] = useState("");
  const [convertedEmail, setConvertedEmail] = useState("");

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

  const handleConvertToBase64 = () => {
    setConvertError("");
    setBase64Output("");
    setConvertedEmail("");

    if (!jsonInput.trim()) {
      setConvertError("Pega el contenido del archivo JSON primero.");
      return;
    }

    try {
      const parsed = JSON.parse(jsonInput.trim());
      if (!parsed.client_email || !parsed.private_key) {
        setConvertError(
          "El JSON no contiene los campos 'client_email' o 'private_key'. Verifica que sea el archivo correcto de cuenta de servicio de Google."
        );
        return;
      }
      const encoded = btoa(jsonInput.trim());
      setBase64Output(encoded);
      setConvertedEmail(parsed.client_email);
    } catch {
      setConvertError(
        "El texto ingresado no es un JSON valido. Asegurate de copiar TODO el contenido del archivo, desde la primera { hasta la ultima }."
      );
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
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
      {/* Herramienta de conversion */}
      <Card className="border-2 border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            Generador de Credenciales
          </CardTitle>
          <CardDescription>
            Pega tu JSON de Google Cloud aca y te damos el valor listo para
            copiar a Vars. Esto se procesa en tu navegador, no se envia a
            ningun servidor.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="json-input">
              1. Pega el contenido completo del archivo JSON:
            </Label>
            <Textarea
              id="json-input"
              placeholder={'{\n  "type": "service_account",\n  "project_id": "...",\n  ...todo el contenido...\n}'}
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              className="min-h-[160px] font-mono text-xs"
            />
          </div>

          <Button onClick={handleConvertToBase64} className="w-full">
            Generar Credencial
          </Button>

          {convertError && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{convertError}</AlertDescription>
            </Alert>
          )}

          {base64Output && (
            <div className="space-y-4 rounded-lg border-2 border-primary bg-primary/5 p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <p className="font-semibold text-foreground">
                  Credencial generada correctamente
                </p>
              </div>

              {convertedEmail && (
                <p className="text-sm text-muted-foreground">
                  Cuenta de servicio:{" "}
                  <strong className="text-foreground">
                    {convertedEmail}
                  </strong>
                </p>
              )}

              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">
                    2. Anda al sidebar {">"} Vars y crea esta variable:
                  </Label>
                  <div className="mt-1 flex items-center gap-2 rounded bg-card p-2 border">
                    <code className="flex-1 text-sm font-mono font-bold text-foreground">
                      GOOGLE_CREDENTIALS_BASE64
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1 text-xs bg-transparent"
                      onClick={() =>
                        copyToClipboard(
                          "GOOGLE_CREDENTIALS_BASE64",
                          "var-name"
                        )
                      }
                    >
                      {copied === "var-name" ? (
                        <>
                          <Check className="h-3 w-3" /> Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" /> Nombre
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">
                    3. Copia este valor y pegalo en la variable:
                  </Label>
                  <div className="mt-1 flex items-start gap-2 rounded bg-card p-2 border">
                    <code className="flex-1 text-xs font-mono text-foreground break-all max-h-20 overflow-y-auto">
                      {base64Output.substring(0, 200)}...
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1 text-xs shrink-0 bg-transparent"
                      onClick={() =>
                        copyToClipboard(base64Output, "var-value")
                      }
                    >
                      {copied === "var-value" ? (
                        <>
                          <Check className="h-3 w-3" /> Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" /> Valor
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>No olvides</AlertTitle>
                  <AlertDescription className="text-xs">
                    Tambien necesitas la variable{" "}
                    <strong>GOOGLE_SPREADSHEET_ID</strong> con el ID de tu
                    hoja (el texto largo de la URL entre /d/ y /edit).
                    {convertedEmail && (
                      <>
                        {" "}Y comparti tu hoja de Google Sheets con{" "}
                        <strong>{convertedEmail}</strong> como Editor.
                      </>
                    )}
                  </AlertDescription>
                </Alert>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diagnostico */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Diagnostico de Conexion
          </CardTitle>
          <CardDescription>
            Una vez que configures las variables, proba la conexion
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
                  <p className="font-medium text-foreground">
                    {result.message}
                  </p>

                  {result.status === "connected" && (
                    <div className="space-y-2">
                      {result.method && (
                        <p className="text-xs text-muted-foreground">
                          Metodo de conexion: {result.method}
                        </p>
                      )}
                      {result.serviceAccountEmail && (
                        <p className="text-sm text-muted-foreground">
                          Cuenta:{" "}
                          <strong className="text-foreground">
                            {result.serviceAccountEmail}
                          </strong>
                        </p>
                      )}
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
                                      Pestanas faltantes (crealas en tu
                                      Sheet):
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

                  {result.detail &&
                    result.status !== "connected" && (
                      <details className="text-xs text-muted-foreground">
                        <summary className="cursor-pointer hover:text-foreground">
                          Ver detalle tecnico
                        </summary>
                        <pre className="mt-1 whitespace-pre-wrap rounded bg-muted p-2 font-mono">
                          {result.detail}
                        </pre>
                      </details>
                    )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Guia resumida */}
      <Card>
        <CardHeader>
          <CardTitle>Guia Rapida</CardTitle>
          <CardDescription>
            Si aun no tenes una cuenta de servicio de Google
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="step1">
              <AccordionTrigger>
                Paso 1: Crear cuenta de servicio
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
                      Google Cloud Console{" "}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </li>
                  <li>Crea un proyecto o usa uno existente</li>
                  <li>
                    Busca <strong>Google Sheets API</strong> y habilitala
                  </li>
                  <li>
                    Anda a <strong>Credenciales</strong> {">"}{" "}
                    <strong>Crear credenciales</strong> {">"}{" "}
                    <strong>Cuenta de servicio</strong>
                  </li>
                  <li>
                    Crea la cuenta, anda a <strong>Claves</strong> {">"}{" "}
                    <strong>Agregar clave</strong> {">"}{" "}
                    <strong>JSON</strong>
                  </li>
                  <li>Se descarga un archivo JSON -- pegalo arriba</li>
                </ol>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="step2">
              <AccordionTrigger>
                Paso 2: Compartir la hoja
              </AccordionTrigger>
              <AccordionContent className="space-y-3">
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                  <li>Abri tu hoja de Google Sheets</li>
                  <li>
                    Click en <strong>Compartir</strong>
                  </li>
                  <li>
                    Pega el email de la cuenta de servicio (aparece en el
                    campo{" "}
                    <code className="rounded bg-muted px-1 text-xs text-foreground">
                      client_email
                    </code>{" "}
                    del JSON)
                  </li>
                  <li>
                    Dale permisos de <strong>Editor</strong>
                  </li>
                </ol>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="step3">
              <AccordionTrigger>
                Paso 3: Estructura de pestanas
              </AccordionTrigger>
              <AccordionContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Tu hoja necesita estas pestanas con encabezados en la fila
                  1:
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {Object.entries(SHEET_NAMES).map(([key, name]) => (
                    <div key={key} className="rounded-lg border p-3">
                      <h4 className="font-semibold text-sm text-foreground mb-2">
                        {name}
                      </h4>
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
