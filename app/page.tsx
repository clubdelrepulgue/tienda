import Image from "next/image"
import Link from "next/link"

export default function ComingSoonPage() {
  return (
    <main className="flex-1 bg-white flex flex-col items-center justify-center px-6">
      <div className="flex flex-col items-center gap-8 max-w-sm w-full text-center">

        <div className="relative w-56 h-56 rounded-full overflow-hidden shadow-lg">
          <Image
            src="/assets/brand/logo.jpeg"
            alt="El Club del Repulge"
            fill
            className="object-cover"
            priority
          />
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            El Club del Repulge
          </h1>
          <p className="text-[oklch(0.59_0.27_24)] text-sm font-semibold uppercase tracking-widest">
            Próximamente
          </p>
        </div>

        <div className="w-12 h-px bg-gray-200" />

        <p className="text-gray-500 text-sm leading-relaxed">
          Estamos preparando algo delicioso para vos. Volvé pronto.
        </p>

        <Link
          href="/admin/login"
          className="mt-6 text-xs text-gray-300 hover:text-gray-500 transition-colors"
        >
          Acceso administrador
        </Link>
      </div>
    </main>
  )
}
