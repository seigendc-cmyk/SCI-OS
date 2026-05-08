import { useMemo, useState } from 'react';
import ItredCatalogueHeader from '../components/itred/ItredCatalogueHeader';
import ItredSearchBar from '../components/itred/ItredSearchBar';
import ItredProductCard from '../components/itred/ItredProductCard';
import ItredCartDrawer from '../components/itred/ItredCartDrawer';
import ItredInfoModal from '../components/itred/ItredInfoModal';
import ItredFooter from '../components/itred/ItredFooter';
import {
  type DemoProduct,
  type DemoCartItem,
  type InfoModalKind,
  itredCatalogueOffersToWhatsApp,
  itredCatalogueJoinCommunityUrl,
  itredDemoData,
} from '../services/itredCatalogueDemoService';

export default function ItredCataloguePage() {
  const [query, setQuery] = useState({
    vendor: '',
    product: '',
    priceText: '',
    priceMin: '',
    priceMax: '',
    location: '',
    deliveryAvailable: 'all' as 'all' | 'yes' | 'no',
    sector: 'all',
    category: 'all',
    datePublished: '',
  });

  const [cartOpen, setCartOpen] = useState(false);
  const [cart, setCart] = useState<DemoCartItem[]>([]);

  const [modalKind, setModalKind] = useState<InfoModalKind | null>(null);

  const dataset = useMemo(() => itredDemoData(), []);

  const sectors = useMemo(() => {
    const s = new Set(dataset.products.map((p) => p.sector));
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [dataset.products]);

  const categories = useMemo(() => {
    const filtered =
      query.sector === 'all'
        ? dataset.products
        : dataset.products.filter((p) => p.sector === query.sector);
    const c = new Set(filtered.map((p) => p.category));
    return Array.from(c).sort((a, b) => a.localeCompare(b));
  }, [dataset.products, query.sector]);

  const filteredProducts = useMemo(() => {
    const qVendor = query.vendor.trim().toLowerCase();
    const qProduct = query.product.trim().toLowerCase();
    const qLocation = query.location.trim().toLowerCase();

    const priceMin = query.priceMin === '' ? null : Number(query.priceMin);
    const priceMax = query.priceMax === '' ? null : Number(query.priceMax);

    const datePublishedFrom = query.datePublished ? new Date(query.datePublished) : null;

    return dataset.products.filter((p) => {
      if (query.sector !== 'all' && p.sector !== query.sector) return false;
      if (query.category !== 'all' && p.category !== query.category) return false;

      if (qVendor) {
        if (!p.vendorName.toLowerCase().includes(qVendor)) return false;
      }

      if (qProduct) {
        if (!p.productName.toLowerCase().includes(qProduct)) return false;
      }

      if (query.priceText.trim()) {
        // supports "$100" / "100" style by extracting a number
        const match = query.priceText.match(/(\d+(?:\.\d+)?)/);
        if (match) {
          const v = Number(match[1]);
          if (Number.isFinite(v) && Math.abs(p.price - v) > 0.00001) return false;
        }
      }

      if (priceMin !== null && Number.isFinite(priceMin)) {
        if (p.price < priceMin) return false;
      }
      if (priceMax !== null && Number.isFinite(priceMax)) {
        if (p.price > priceMax) return false;
      }

      if (qLocation) {
        if (!p.location.toLowerCase().includes(qLocation)) return false;
      }

      if (query.deliveryAvailable === 'yes' && !p.deliveryAvailable) return false;
      if (query.deliveryAvailable === 'no' && p.deliveryAvailable) return false;

      if (datePublishedFrom) {
        const dp = new Date(p.datePublished);
        if (Number.isNaN(dp.getTime())) return false;
        if (dp < datePublishedFrom) return false;
      }

      return true;
    });
  }, [dataset.products, query]);

  const cartTotals = useMemo(() => {
    const totalQty = cart.reduce((s, i) => s + i.quantity, 0);
    const total = cart.reduce((s, i) => s + i.quantity * i.product.price, 0);
    return { totalQty, total };
  }, [cart]);

  const onAddToCart = (product: DemoProduct) => {
    setCart((prev) => {
      const existing = prev.find(
        (x) =>
          x.product.productId === product.productId && x.product.vendorName === product.vendorName,
      );
      if (existing) {
        return prev.map((x) => (x === existing ? { ...x, quantity: x.quantity + 1 } : x));
      }
      return [...prev, { product, quantity: 1 }];
    });
    setCartOpen(true);
  };

  const onRemoveFromCart = (productId: string, vendorName: string) => {
    setCart((prev) =>
      prev.filter(
        (x) => !(x.product.productId === productId && x.product.vendorName === vendorName),
      ),
    );
  };

  const onClearCart = () => setCart([]);

  const vendorWhatsAppCheckoutLinks = useMemo(() => {
    // direct WhatsApp message per vendor from cart contents
    const byVendor = new Map<string, DemoCartItem[]>();
    for (const item of cart) {
      const arr = byVendor.get(item.product.vendorName) ?? [];
      arr.push(item);
      byVendor.set(item.product.vendorName, arr);
    }
    return Array.from(byVendor.entries()).map(([vendorName, items]) => {
      const first = items[0].product;
      const message = itredCatalogueOffersToWhatsApp({
        vendorName,
        items,
        customerName: '',
      });
      const url = first.vendorWhatsApp
        ? `https://wa.me/${first.vendorWhatsApp}?text=${encodeURIComponent(message)}`
        : null;
      return {
        vendorName,
        url,
        vendorPhone: first.vendorPhone,
        vendorWhatsApp: first.vendorWhatsApp,
      };
    });
  }, [cart]);

  return (
    <div className="min-h-screen bg-white text-zinc-800">
      <ItredCatalogueHeader
        onMenu={(k) => setModalKind(k)}
        communityUrl={itredCatalogueJoinCommunityUrl()}
      />

      <main className="px-3 pb-24">
        <section className="mt-3">
          <div className="rounded-none border border-zinc-200 bg-white p-3 shadow-sm">
            <div className="text-sm text-zinc-600">iTred Catalogue</div>
            <div className="mt-1 font-bold text-zinc-900">
              iTred helps customers find vendors, products, prices, locations and delivery options
              from one phone-first catalogue powered by seiGEN Commerce.
            </div>
            <div className="mt-3 text-xs text-zinc-600">
              Deployed by {query.sector === 'all' ? 'Sector' : query.sector} |{' '}
              {query.category === 'all' ? 'Category' : query.category} | 07 May 2026
            </div>
          </div>
        </section>

        <div className="sticky top-0 z-10 mt-3">
          <ItredSearchBar
            query={query}
            setQuery={setQuery}
            sectors={['all', ...sectors]}
            categories={['all', ...categories]}
            onCart={() => setCartOpen(true)}
            cartCount={cartTotals.totalQty}
          />
        </div>

        <section className="mt-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center border border-zinc-200 px-2 py-1 text-xs">
              powered by <span className="text-orange-600 font-semibold ml-1">seiGEN Commerce</span>
            </span>
            <a
              className="text-xs text-orange-700 underline"
              href={itredCatalogueJoinCommunityUrl()}
              target="_blank"
              rel="noreferrer"
            >
              Join WhatsApp Community
            </a>
          </div>
        </section>

        {/* Product list */}
        <section className="mt-3 space-y-3">
          {filteredProducts.length === 0 ? (
            <div className="border border-zinc-200 p-3 text-sm">
              No products match your filters.
            </div>
          ) : (
            filteredProducts.map((p) => (
              <ItredProductCard
                key={p.productId}
                product={p}
                onAddToCart={() => onAddToCart(p)}
                onMakeOffer={(payload) => {
                  // payload is used by card to create a WhatsApp link; open it here so the card stays dumb.
                  const msg = `Hello, I found this product on iTred powered by seiGEN Commerce. Product: ${payload.productName}. Listed Price: ${payload.priceText}. My Offer: ${payload.offerAmount}. Location: ${payload.location || payload.customerLocation}. Is this acceptable?`;
                  const url = p.vendorWhatsApp
                    ? `https://wa.me/${p.vendorWhatsApp}?text=${encodeURIComponent(msg)}`
                    : p.vendorPhone
                      ? `https://wa.me/${p.vendorPhone}?text=${encodeURIComponent(msg)}`
                      : null;
                  if (url) window.open(url, '_blank', 'noopener,noreferrer');
                }}
              />
            ))
          )}
        </section>

        {/* Pricing teaser */}
        <section className="mt-5">
          <div className="border border-zinc-200 p-3">
            <div className="font-semibold">Vendor listing plans</div>
            <div className="mt-1 text-sm text-zinc-600">
              Vendor listing plans are based on the number of products you want to list.
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="border border-zinc-200 p-3">
                <div className="font-semibold">Starter</div>
                <div className="text-sm text-zinc-600">5 products</div>
              </div>
              <div className="border border-zinc-200 p-3">
                <div className="font-semibold">Growth</div>
                <div className="text-sm text-zinc-600">20 products</div>
              </div>
              <div className="border border-zinc-200 p-3">
                <div className="font-semibold">Business</div>
                <div className="text-sm text-zinc-600">100 products</div>
              </div>
              <div className="border border-zinc-200 p-3">
                <div className="font-semibold">Unlimited</div>
                <div className="text-sm text-zinc-600">unlimited products</div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <ItredCartDrawer
        open={cartOpen}
        onOpenChange={setCartOpen}
        cart={cart}
        total={cartTotals.total}
        onRemove={onRemoveFromCart}
        onClear={onClearCart}
        vendorWhatsAppCheckoutLinks={vendorWhatsAppCheckoutLinks}
      />

      <ItredInfoModal kind={modalKind} onClose={() => setModalKind(null)} />

      <ItredFooter onMenu={(k) => setModalKind(k)} />
    </div>
  );
}
