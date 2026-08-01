export function NotFoundPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-[#050d1a] px-4">
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="relative w-7 h-7">
            <div className="absolute inset-0 rounded-full bg-[#C8F135]" />
            <div className="absolute inset-[2px] rounded-full border-2 border-[#040c1a]/40" />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-px h-full bg-[#040c1a]/30 rotate-45" />
            </div>
          </div>
          <span className="text-white font-bold text-base tracking-tight">
            myTenni<span className="text-[#C8F135]">Stats</span>
          </span>
        </div>
        <p className="text-5xl font-black text-[#C8F135] mb-3">404</p>
        <p className="text-xl font-semibold text-white mb-2">Page introuvable</p>
        <p className="text-gray-400 mb-8">Cette page n'existe pas ou l'adresse est incorrecte.</p>
        <a
          href="/"
          className="inline-block bg-[#C8F135] text-[#060e1b] font-bold py-3 px-8 rounded-full hover:bg-white transition-all duration-300 hover:scale-105 shadow-lg shadow-[#C8F135]/20"
        >
          Retour à l'accueil
        </a>
      </div>
    </div>
  );
}
