import Link from 'next/link'

export default function PendingPage() {
  return (
    <div className="min-h-screen bg-go-light flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <img
          src="https://mmhsulgcowhqimypglul.supabase.co/storage/v1/object/public/PGLOGOS/PapayaGo-Sun-Orange-39.png"
          alt=""
          className="w-24 h-24 mx-auto mb-4"
        />
        <h1 className="font-syne font-bold text-2xl text-go-dark mb-2">
          Pronto serás parte de Papaya GO 🧡
        </h1>
        <p className="font-dm text-gray-500 text-sm mb-6">
          Tu cuenta está pendiente de aprobación.
        </p>
        <Link href="/" className="font-dm text-sm text-go-orange hover:underline">
          ← Volver al inicio
        </Link>
      </div>
    </div>
  )
}
