export default function PendingPage() {
  return (
    <div className="min-h-screen bg-go-light flex items-center justify-center px-4">
      <div className="bg-white rounded-3xl border border-go-border p-10 max-w-md w-full text-center">
        <p className="text-5xl mb-4">⏳</p>
        <h1 className="font-syne font-bold text-2xl text-go-dark mb-2">Tu cuenta está pendiente</h1>
        <p className="font-dm text-gray-500 text-sm mb-6">
          Tu cuenta está pendiente de aprobación. Te notificaremos por email cuando sea activada.
        </p>
        <a href="/" className="font-dm text-sm text-go-orange hover:underline">← Volver al inicio</a>
      </div>
    </div>
  )
}
