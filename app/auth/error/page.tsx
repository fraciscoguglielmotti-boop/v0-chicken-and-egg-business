export default function AuthErrorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-red-600">Error de autenticación</h1>
        <p className="mt-2 text-gray-600">Ocurrió un error al procesar tu solicitud.</p>
        <a href="/auth/login" className="mt-4 inline-block text-blue-600 hover:underline">
          Volver al inicio de sesión
        </a>
      </div>
    </div>
  )
}
