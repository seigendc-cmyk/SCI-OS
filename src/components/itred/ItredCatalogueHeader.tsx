type Props = {
  onMenu: (kind: InfoModalKind) => void;
  communityUrl: string;
};

export type InfoModalKind =
  | 'privacy'
  | 'business'
  | 'warranties'
  | 'indemnity'
  | 'about'
  | 'support';

export default function ItredCatalogueHeader({ onMenu, communityUrl }: Props) {
  return (
    <header className="border-b border-zinc-200 bg-white px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-lg font-extrabold text-zinc-900 leading-tight">iTred</div>
          <div className="text-[11px] text-orange-700 font-semibold">
            powered by seiGEN Commerce
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            className="hidden sm:inline-flex border border-zinc-200 px-2 py-1 text-xs font-semibold text-zinc-700"
            href={communityUrl}
            target="_blank"
            rel="noreferrer"
          >
            WhatsApp Community
          </a>

          <div className="group relative">
            <details className="">
              <summary className="list-none cursor-pointer select-none border border-zinc-200 px-2 py-1 bg-white">
                <span className="text-zinc-700 font-bold">⋯</span>
              </summary>
              <div className="absolute right-0 z-20 mt-2 w-56 rounded-none border border-zinc-200 bg-white p-1 shadow-sm">
                <button
                  className="w-full text-left px-2 py-2 text-sm hover:bg-zinc-50"
                  onClick={() => onMenu('privacy')}
                >
                  Privacy Policy
                </button>
                <button
                  className="w-full text-left px-2 py-2 text-sm hover:bg-zinc-50"
                  onClick={() => onMenu('business')}
                >
                  Business Terms
                </button>
                <button
                  className="w-full text-left px-2 py-2 text-sm hover:bg-zinc-50"
                  onClick={() => onMenu('warranties')}
                >
                  Warranties
                </button>
                <button
                  className="w-full text-left px-2 py-2 text-sm hover:bg-zinc-50"
                  onClick={() => onMenu('indemnity')}
                >
                  Indemnity
                </button>
                <button
                  className="w-full text-left px-2 py-2 text-sm hover:bg-zinc-50"
                  onClick={() => onMenu('about')}
                >
                  About iTred
                </button>
                <button
                  className="w-full text-left px-2 py-2 text-sm hover:bg-zinc-50"
                  onClick={() => onMenu('support')}
                >
                  Support / Contact
                </button>
                <a
                  className="block px-2 py-2 text-sm hover:bg-zinc-50"
                  href={communityUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Join WhatsApp Community
                </a>
              </div>
            </details>
          </div>
        </div>
      </div>
    </header>
  );
}
