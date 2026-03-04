import Link from 'next/link'

export default function AdminHomePage() {
  return (
    <div className="flex flex-col items-center">
      <h1 className="text-2xl font-bold text-[#EBFFEE] mb-2">
        Tableau de bord
      </h1>
      <p className="text-[#EBFFEE] mb-8">
        Bienvenue dans l&apos;espace admin du restaurant.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl">
        <Link
          href="/admin/reservations"
          className="group bg-[#EBFFEE] border border-neutral-200 rounded-2xl p-8 hover:border-neutral-400 hover:shadow-md transition-all flex flex-col gap-3"
        >
          <div>
            <h2 className="text-lg text-center font-semibold text-neutral-900 group-hover:underline">
              Réservations
            </h2>
            <p className="text-sm text-center text-neutral-500 mt-1">
              Gérer les demandes de réservation, confirmer ou refuser, bloquer
              des créneaux.
            </p>
          </div>
        </Link>

        <Link
          href="/admin/menu"
          className="group bg-[#EBFFEE] border border-neutral-200 rounded-2xl p-8 hover:border-neutral-400 hover:shadow-md transition-all flex flex-col gap-3"
        >
          <div>
            <h2 className="text-lg text-center font-semibold text-neutral-900 group-hover:underline">
              Menus
            </h2>
            <p className="text-sm text-center text-neutral-500 mt-1">
              Importer et gérer les menus PDF affichés sur le site.
            </p>
          </div>
        </Link>
      </div>
    </div>
  )
}
