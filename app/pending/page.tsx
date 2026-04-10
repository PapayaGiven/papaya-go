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
        <br />
        <a href="https://chat.whatsapp.com/IKy0BMc8ROl55Hm4r47C2Z?mode=gi_t" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 font-dm text-sm font-semibold text-white bg-[#25D366] hover:bg-[#20BD5A] px-5 py-2.5 rounded-xl transition mt-4">
          💬 ¿Ya tienes tu código? Pregunta en WhatsApp →
        </a>
      </div>
    </div>
  )
}
