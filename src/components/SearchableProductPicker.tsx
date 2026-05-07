import React, { useState } from 'react';
import { Search, Package, CheckCircle2 } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  sku?: string;
  price: number;
  stockQty: number;
  status: string;
  visibility: string;
  images?: string[];
  category?: string;
  sector?: string;
}

interface SearchableProductPickerProps {
  products: Product[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onSelectAll: () => void;
}

export const SearchableProductPicker: React.FC<SearchableProductPickerProps> = ({
  products,
  selectedIds,
  onToggle,
  onSelectAll,
}) => {
  const [search, setSearch] = useState('');

  const filtered = products.filter((p) => {
    const searchStr =
      `${p.name} ${p.sku || ''} ${p.category || ''} ${p.sector || ''}`.toLowerCase();
    return search
      .toLowerCase()
      .split(' ')
      .every((term) => searchStr.includes(term));
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="relative flex-grow mr-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input
            type="text"
            placeholder="SEARCH BY NAME, SKU, CATEGORY, SECTOR..."
            className="w-full p-3 pl-10 industrial-border rounded outline-none focus:ring-1 focus:ring-orange-itred bg-slate-50 text-[10px] font-bold uppercase tracking-widest"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={onSelectAll}
          className="text-[8px] text-slate-400 hover:text-orange-itred uppercase font-bold tracking-widest whitespace-nowrap"
        >
          Select All Visible
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2 max-h-[440px] overflow-y-auto pr-2 no-scrollbar border border-slate-100 rounded-lg p-2 bg-slate-50/30">
        {products.length === 0 ? (
          <p className="text-[9px] text-slate-300 italic p-10 text-center border-2 border-dashed rounded-lg font-bold uppercase">
            No inventory found in merchant node.
          </p>
        ) : filtered.length === 0 ? (
          <p className="text-[9px] text-slate-300 italic p-10 text-center uppercase">
            No products match search criteria.
          </p>
        ) : (
          filtered.map((p) => {
            const isSelected = selectedIds.includes(p.id);
            const isReady = p.status === 'published' && p.visibility === 'public' && p.stockQty > 0;

            return (
              <div
                key={p.id}
                onClick={() => onToggle(p.id)}
                className={`p-3 industrial-border rounded cursor-pointer transition-all flex gap-4 ${isSelected ? 'bg-orange-50 border-orange-itred/40' : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'}`}
              >
                <div className="w-10 h-10 bg-white industrial-border rounded overflow-hidden flex-shrink-0 shadow-sm border border-slate-100">
                  {p.images?.[0] ? (
                    <img src={p.images[0]} className="w-full h-full object-cover" />
                  ) : (
                    <Package className="w-full h-full p-2 text-slate-200" />
                  )}
                </div>
                <div className="flex-grow flex flex-col justify-between overflow-hidden">
                  <div className="flex justify-between items-start gap-2">
                    <h4
                      className={`font-bold uppercase tracking-tight truncate text-[10px] ${isSelected ? 'text-slate-900' : 'text-slate-600'}`}
                    >
                      {p.name}
                    </h4>
                    {isSelected ? (
                      <CheckCircle2 size={14} className="text-orange-itred flex-shrink-0" />
                    ) : (
                      <div className="w-3.5 h-3.5 border border-slate-200 rounded-full flex-shrink-0"></div>
                    )}
                  </div>
                  <div className="flex justify-between items-baseline mt-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[7px] font-mono text-slate-400">
                        {p.sku || 'NO_SKU'}
                      </span>
                      <span className="text-slate-900 font-bold text-[9px]">
                        $ {Number(p.price).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {!isReady && (
                        <span className="text-[7px] text-red-400 font-black uppercase tracking-tighter bg-red-50 px-1 rounded">
                          OFFLINE
                        </span>
                      )}
                      <span
                        className={`text-[7px] font-black uppercase tracking-tighter ${p.stockQty > 0 ? 'text-emerald-500' : 'text-red-500'}`}
                      >
                        {p.stockQty} UNITS
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
