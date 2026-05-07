import {
  buildCatalogueContactMenu,
  buildCatalogueLegalFooter,
  catalogueFooterStyles,
} from './catalogueFooterService';

export function generateOfflineCatalogueHtml({
  vendor,
  catalogue,
  products,
  branch,
  branches = [],
  staffMembers = [],
  deliveryServices = [],
}: {
  vendor: any;
  catalogue: any;
  products: any[];
  branch: any;
  branches?: any[];
  staffMembers?: any[];
  deliveryServices?: any[];
}) {
  console.log('HTML EXPORT INPUT vendor', vendor);
  console.log('HTML EXPORT INPUT catalogue', catalogue);
  console.log('HTML EXPORT INPUT products count', products?.length);

  const safeVendor = {
    businessName: vendor?.businessName || vendor?.name || 'Independent Vendor',
    description: vendor?.description || 'No description available.',
    city: vendor?.city || 'N/A',
    phone: vendor?.phone || '',
    whatsapp: vendor?.whatsapp || vendor?.phone || '',
  };

  const safeCatalogue = {
    title: catalogue?.title || 'Product Catalogue',
    description: catalogue?.description || '',
    expiresAt: catalogue?.expiresAt
      ? catalogue.expiresAt.seconds
        ? new Date(catalogue.expiresAt.seconds * 1000).toISOString()
        : new Date(catalogue.expiresAt).toISOString()
      : null,
    whatsappNumber: catalogue?.whatsappNumber || safeVendor.whatsapp,
  };

  const safeProducts = Array.isArray(products)
    ? products.map((p) => ({
        productId: p.productId || p.id || '',
        name: p.name || 'Unnamed Product',
        description: p.description || '',
        sku: p.sku || '',
        brand: p.brand || '',
        category: p.category || 'Uncategorized',
        categoryCode: p.categoryCode || '',
        categoryLabel: p.categoryLabel || '',
        sectorCode: p.sectorCode || '',
        attributes: p.attributes || {},
        unit: p.unit || 'each',
        price: Number(p.price || 0),
        stockQty: Number(p.stockQty || 0),
        images: Array.isArray(p.images) ? p.images : [],
      }))
    : [];

  const safeBranch = branch
    ? {
        name: branch.name || branch.branchName || 'Main Location',
        address: branch.address || '',
        city: branch.city || '',
      }
    : null;

  const safeBranches =
    Array.isArray(branches) && branches.length > 0
      ? branches.map((b) => ({
          branchId: b.branchId || b.id || '',
          name: b.name || b.branchName || 'Branch',
          branchName: b.branchName || b.name || 'Branch',
          phone: b.phone || '',
          whatsapp: b.whatsapp || b.phone || '',
          address: b.address || '',
          city: b.city || '',
          district: b.district || '',
          suburb: b.suburb || '',
          status: b.status || 'active',
        }))
      : safeBranch
        ? [
            {
              branchId: 'main',
              name: safeBranch.name || 'Main Location',
              branchName: safeBranch.name || 'Main Location',
              phone: safeVendor.phone,
              whatsapp: safeVendor.whatsapp,
              address: safeBranch.address || '',
              city: safeBranch.city || safeVendor.city,
              district: '',
              suburb: '',
              status: 'active',
            },
          ]
        : [];

  const safeStaff = Array.isArray(staffMembers)
    ? staffMembers.map((s) => ({
        staffId: s.staffId || s.id || '',
        fullName: s.fullName || s.name || 'Staff Member',
        role: s.role || 'staff',
        phone: s.phone || '',
        whatsapp: s.whatsapp || s.phone || '',
        imageUrl: s.imageUrl || s.photoUrl || s.avatarUrl || '',
        status: s.status || 'profile_created',
        loginStatus: s.loginStatus || 'not_connected',
      }))
    : [];

  const safeDelivery = Array.isArray(deliveryServices)
    ? deliveryServices.map((d) => ({
        deliveryId: d.deliveryId || d.id || '',
        name: d.name || d.fullName || 'iDeliver Personnel',
        fullName: d.fullName || d.name || 'iDeliver Personnel',
        phone: d.phone || '',
        whatsapp: d.whatsapp || d.phone || '',
        imageUrl: d.imageUrl || d.photoUrl || d.avatarUrl || '',
        vehicleType: d.vehicleType || '',
        vehicleRegistration: d.vehicleRegistration || '',
        serviceArea: d.serviceArea || d.coverageArea || '',
        coverageArea: d.coverageArea || d.serviceArea || '',
        baseFee: Number(d.baseFee || 0),
        status: d.status || 'active',
      }))
    : [];

  const safeIDeliver = safeDelivery;

  const PRODUCTS_JSON = JSON.stringify(safeProducts).replace(/</g, '\\u003c');
  const VENDOR_JSON = JSON.stringify(safeVendor).replace(/</g, '\\u003c');
  const CATALOGUE_JSON = JSON.stringify(safeCatalogue).replace(/</g, '\\u003c');
  const BRANCH_JSON = JSON.stringify(safeBranch).replace(/</g, '\\u003c');
  const DELIVERY_JSON = JSON.stringify(safeDelivery).replace(/</g, '\\u003c');
  const BRANCHES_JSON = JSON.stringify(safeBranches).replace(/</g, '\\u003c');
  const STAFF_JSON = JSON.stringify(safeStaff).replace(/</g, '\\u003c');
  const IDELIVER_JSON = JSON.stringify(safeIDeliver).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeCatalogue.title} - ${safeVendor.businessName}</title>

  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

    :root {
      --orange: #f57c00;
      --charcoal: #1e293b;
      --slate-50: #f8fafc;
      --slate-100: #f1f5f9;
      --slate-200: #e2e8f0;
      --slate-400: #94a3b8;
      --slate-500: #64748b;
      --slate-900: #0f172a;
      --emerald: #10b981;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Inter', sans-serif;
      background: var(--slate-50);
      color: var(--slate-900);
      line-height: 1.5;
      padding-bottom: 120px;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 20px;
    }

    header {
      background: var(--charcoal);
      color: white;
      padding: 40px 0;
      margin-bottom: 40px;
      border-bottom: 4px solid var(--orange);
    }

    .branding {
      font-size: 10px;
      font-weight: 900;
      color: var(--orange);
      text-transform: uppercase;
      letter-spacing: 0.2em;
      margin-bottom: 8px;
    }

    h1 {
      font-size: 32px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: -0.02em;
      margin-bottom: 12px;
    }

    .metadata {
      font-size: 10px;
      font-weight: 700;
      color: var(--slate-400);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
    }

    .vendor-info {
      background: white;
      padding: 30px;
      border-radius: 8px;
      margin-bottom: 40px;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
      border: 1px solid var(--slate-200);
      display: grid;
      grid-template-columns: 1fr;
      gap: 20px;
    }

    @media (min-width: 768px) {
      .vendor-info {
        grid-template-columns: 2fr 1fr;
      }
    }

    .v-title {
      font-size: 18px;
      font-weight: 800;
      text-transform: uppercase;
      margin-bottom: 8px;
      color: var(--orange);
    }

    .v-desc {
      font-size: 13px;
      color: var(--slate-500);
    }

    .v-meta-item {
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      color: var(--slate-400);
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .search-nav {
      position: sticky;
      top: 0;
      background: white;
      padding: 20px 0;
      z-index: 100;
      border-bottom: 1px solid var(--slate-200);
      margin-bottom: 40px;
      box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.05);
    }

    .search-box {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .search-row {
      display: flex;
      gap: 10px;
    }

    .search-helper {
      font-size: 9px;
      font-weight: 700;
      color: var(--slate-400);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    input,
    select {
      padding: 12px 16px;
      border: 2px solid var(--slate-200);
      border-radius: 4px;
      font-family: inherit;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      outline: none;
    }

    input:focus {
      border-color: var(--orange);
    }

    input {
      flex-grow: 1;
    }

    .btn-clear {
      background: var(--slate-100);
      color: var(--slate-500);
      border: none;
      padding: 0 15px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-clear:hover {
      background: var(--slate-200);
      color: var(--slate-900);
    }

    .product-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 24px;
    }

    .product-card {
      background: white;
      border: 1px solid var(--slate-200);
      border-radius: 8px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      transition: transform 0.2s;
    }

    .product-card:hover {
      transform: translateY(-4px);
    }

    .p-image {
      height: 200px;
      background: var(--slate-100);
      background-size: cover;
      background-position: center;
      border-bottom: 1px solid var(--slate-100);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--slate-200);
      font-weight: 900;
      text-transform: uppercase;
      font-size: 40px;
    }

    .p-content {
      padding: 20px;
      flex-grow: 1;
      display: flex;
      flex-direction: column;
    }

    .p-name {
      font-size: 14px;
      font-weight: 800;
      text-transform: uppercase;
      margin-bottom: 4px;
    }

    .p-sku {
      font-size: 9px;
      font-weight: 600;
      font-family: monospace;
      color: var(--slate-400);
      text-transform: uppercase;
      margin-bottom: 12px;
    }

    .p-price {
      font-size: 20px;
      font-weight: 900;
      margin-bottom: 16px;
      color: var(--charcoal);
    }

    .btn-add {
      background: var(--orange);
      color: white;
      border: none;
      padding: 12px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      cursor: pointer;
      margin-top: auto;
      transition: background 0.2s;
    }

    .btn-add:hover {
      background: #d96a1a;
    }

    .btn-add.in-cart {
      background: var(--charcoal);
    }

    .cart-bar {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: var(--charcoal);
      color: white;
      padding: 20px 0;
      z-index: 200;
      border-top: 4px solid var(--orange);
      display: none;
    }

    .cart-bar.active {
      display: block;
    }

    .cart-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .cart-summary {
      display: flex;
      flex-direction: column;
    }

    .cart-count {
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      color: var(--orange);
    }

    .cart-total {
      font-size: 18px;
      font-weight: 900;
    }

    .btn-order {
      background: var(--emerald);
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      cursor: pointer;
      transition: background 0.2s;
    }

    .btn-order:hover {
      background: #059669;
    }

    .cart-modal {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.8);
      z-index: 300;
      display: none;
      padding: 20px;
      justify-content: center;
      align-items: center;
    }

    .cart-modal.active {
      display: flex;
    }

    .modal-content {
      background: white;
      width: 100%;
      max-width: 600px;
      max-height: 80vh;
      border-radius: 8px;
      overflow-y: auto;
      padding: 30px;
      position: relative;
    }

    .modal-close {
      position: absolute;
      top: 10px;
      right: 10px;
      border: none;
      background: none;
      font-size: 24px;
      cursor: pointer;
    }

    .modal-h2 {
      font-size: 20px;
      font-weight: 900;
      text-transform: uppercase;
      margin-bottom: 20px;
      border-bottom: 2px solid var(--slate-100);
      padding-bottom: 10px;
    }

    .cart-items {
      margin-bottom: 30px;
    }

    .cart-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 0;
      border-bottom: 1px solid var(--slate-100);
    }

    .item-info {
      flex-grow: 1;
    }

    .item-name {
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
    }

    .item-price {
      font-size: 11px;
      color: var(--slate-400);
    }

    .qty-ctrl {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .qty-btn {
      width: 24px;
      height: 24px;
      background: var(--slate-100);
      border: none;
      border-radius: 4px;
      font-weight: 900;
      cursor: pointer;
    }

    .qty-val {
      font-size: 12px;
      font-weight: 800;
      min-width: 20px;
      text-align: center;
    }

    .expiry-warning {
      background: #fee2e2;
      border: 1px solid #fecaca;
      color: #b91c1c;
      padding: 10px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      margin-bottom: 20px;
      text-align: center;
      display: none;
    }

    .empty-state {
      grid-column: 1 / -1;
      padding: 80px 40px;
      text-align: center;
      border: 2px dashed var(--slate-200);
      border-radius: 8px;
      color: var(--slate-500);
      font-weight: 700;
      text-transform: uppercase;
      font-size: 13px;
      line-height: 1.6;
    }

    ${catalogueFooterStyles}
  </style>
</head>

<body>
  <header>
    <div class="container">
      <div class="branding">iTred Powered by seiGEN Commerce</div>
      <h1 id="cat-title">${safeCatalogue.title}</h1>
      <div class="metadata" id="cat-meta">
        <span>Loaded products: <span id="p-count">${safeProducts.length}</span></span>
        <span>Visible products: <span id="v-count">0</span></span>
        <span>Generated: <span id="gen-date">${new Date().toLocaleDateString()}</span></span>
      </div>
    </div>
  </header>

  <div class="container">
    <div id="expiry-msg" class="expiry-warning">
      This catalogue reached its expiry date. Contact vendor to confirm availability.
    </div>

    <section class="vendor-info">
      <div>
        <h2 class="v-title" id="vendor-name">${safeVendor.businessName}</h2>
        <div class="v-desc" id="vendor-desc">${safeVendor.description}</div>
      </div>

      <div style="border-left: 2px solid var(--slate-50); padding-left: 20px;">
        <div class="v-meta-item">LOCATION: <span id="vendor-city">${safeVendor.city}</span></div>
        <div class="v-meta-item">CONTACT: <span id="vendor-contact">${safeVendor.whatsapp || safeVendor.phone}</span></div>
        ${
          safeBranch
            ? `
        <div id="branch-info" style="margin-top: 15px; border-top: 1px solid var(--slate-100); padding-top: 10px;">
          <div class="v-meta-item" style="color: var(--orange)">PICKUP POINT</div>
          <div style="font-size: 11px; font-weight: 800;">${safeBranch.name}</div>
          <div style="font-size: 10px; color: var(--slate-500);">${safeBranch.address}, ${safeBranch.city}</div>
        </div>
        `
            : ''
        }
      </div>
    </section>

    <div class="search-nav">
      <div class="container search-box">
        <div class="search-row">
          <input type="text" id="search-input" placeholder="SEARCH INVENTORY...">
          <select id="category-filter">
            <option value="">ALL CATEGORIES</option>
          </select>
          <button class="btn-clear" onclick="clearSearch()" title="Clear Search">Clear</button>
        </div>
        <div class="search-helper">
          Search by any words in any order: name, SKU, brand, category, or description.
        </div>
      </div>
    </div>

    <div class="product-grid" id="product-grid">
      <!-- Products injected here -->
    </div>
  </div>

  <div class="cart-bar" id="cart-bar">
    <div class="container cart-content">
      <div class="cart-summary">
        <div class="cart-count"><span id="cart-qty-total">0</span> ITEMS SELECTED</div>
        <div class="cart-total">$ <span id="cart-price-total">0.00</span></div>
      </div>
      <button class="btn-order" onclick="openCart()">Review & Send Enquiry</button>
    </div>
  </div>

  <div class="cart-modal" id="cart-modal" onclick="if(event.target === this) closeCart()">
    <div class="modal-content">
      <button class="modal-close" onclick="closeCart()">&times;</button>
      <h2 class="modal-h2">Your Enquiry Cart</h2>

      <div class="cart-items" id="cart-items-list"></div>

      <div style="margin: 20px 0; display: flex; flex-direction: column; gap: 8px;">
        <input type="text" id="cust-name" placeholder="YOUR NAME (REQUIRED)" style="width: 100%; box-sizing: border-box;">
        <input type="text" id="cust-location" placeholder="YOUR LOCATION" style="width: 100%; box-sizing: border-box;">
        <textarea id="cust-notes" placeholder="ANY SPECIAL NOTES..." style="width: 100%; height: 60px; padding: 12px; border: 2px solid var(--slate-200); border-radius: 4px; font-family: inherit; font-size: 12px; font-weight: 700; text-transform: uppercase; resize: none; box-sizing: border-box; outline: none;"></textarea>
      </div>

      <div style="margin-bottom: 20px; font-size: 11px; font-weight: 700; color: var(--slate-500); text-transform: uppercase;">
        Note: Total is an estimate. Final pricing may vary.
      </div>

      <button class="btn-order" style="width: 100%; padding: 18px;" onclick="sendWhatsApp()">🚀 Send Inquiry via WhatsApp</button>
    </div>
  </div>

  ${buildCatalogueContactMenu()}

  ${buildCatalogueLegalFooter(safeVendor.businessName)}

  <script>
    const VENDOR = ${VENDOR_JSON};
    const CATALOGUE = ${CATALOGUE_JSON};
    const PRODUCTS = ${PRODUCTS_JSON};
    const BRANCH = ${BRANCH_JSON};
    const DELIVERY = ${DELIVERY_JSON};
    const BRANCHES = ${BRANCHES_JSON};
    const STAFF = ${STAFF_JSON};
    const IDELIVER = ${IDELIVER_JSON};

    let CURRENT_CONTACT_TAB = 'branches';
    let cart = JSON.parse(localStorage.getItem('itred_cart_' + CATALOGUE.title) || '{}');

    function normalizeText(value) {
      return String(value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\\u0300-\\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
    }

    function getProductSearchText(product) {
      return normalizeText([
        product.name,
        product.description,
        product.sku,
        product.brand,
        product.category,
        product.unit
      ].join(" "));
    }

    function flexibleMatch(product, query) {
      const normalizedQuery = normalizeText(query);
      if (!normalizedQuery) return true;

      const productText = getProductSearchText(product);
      const terms = normalizedQuery.split(" ").filter(Boolean);

      return terms.every(function(term) {
        return productText.includes(term);
      });
    }

    function init() {
      try {
        if (CATALOGUE.expiresAt) {
          const now = new Date();
          const exp = new Date(CATALOGUE.expiresAt);

          if (now > exp) {
            const expMsg = document.getElementById('expiry-msg');
            if (expMsg) expMsg.style.display = 'block';
          }
        }

        const categories = [...new Set(PRODUCTS.map(p => p.category).filter(Boolean))];
        const filter = document.getElementById('category-filter');

        if (filter) {
          categories.sort().forEach(c => {
            const opt = document.createElement('option');
            opt.value = c;
            opt.innerText = c.toUpperCase();
            filter.appendChild(opt);
          });
        }

        renderProducts();
        updateCartUI();

        document.getElementById('search-input').addEventListener('input', renderProducts);
        document.getElementById('category-filter').addEventListener('change', renderProducts);
      } catch (err) {
        console.error("Initialization failed:", err);
      }
    }

    function clearSearch() {
      document.getElementById('search-input').value = '';
      document.getElementById('category-filter').value = '';
      renderProducts();
    }

    function renderProducts() {
      try {
        const query = document.getElementById('search-input').value;
        const catFilter = document.getElementById('category-filter').value;
        const grid = document.getElementById('product-grid');

        if (!grid) return;

        grid.innerHTML = '';

        const filtered = PRODUCTS.filter(p => {
          const matchesSearch = flexibleMatch(p, query);
          const matchesCat = !catFilter || p.category === catFilter;
          return matchesSearch && matchesCat;
        });

        const vCount = document.getElementById('v-count');
        if (vCount) vCount.innerText = filtered.length;

        if (filtered.length === 0) {
          grid.innerHTML = '<div class="empty-state">No matching products found. Try fewer words or search by SKU, brand, category, or product name.</div>';
          return;
        }

        filtered.forEach(p => {
          const inCart = !!cart[p.productId];
          const card = document.createElement('div');
          card.className = 'product-card';

          card.innerHTML =
            '<div class="p-image" ' + (p.images[0] ? 'style="background-image: url(' + p.images[0] + ')"' : '') + '>' +
              (!p.images[0] ? '<span style="font-size: 14px; color: #cbd5e1;">NO IMAGE</span>' : '') +
            '</div>' +
            '<div class="p-content">' +
              '<div class="p-name">' + escapeHtml(p.name) + '</div>' +
              (p.brand ? '<div style="font-size: 10px; font-weight: 700; color: var(--orange); text-transform: uppercase; margin-bottom: 4px;">' + escapeHtml(p.brand) + '</div>' : '') +
              '<div class="p-sku">SKU: ' + escapeHtml(p.sku || 'N/A') + ' | ' + escapeHtml(p.categoryLabel || p.category || 'GENERAL') + '</div>' +
              '<div style="font-size: 11px; color: var(--slate-500); margin-bottom: 8px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">' +
                escapeHtml(p.description || 'No description available') +
              '</div>' +
              renderProductAttributes(p.attributes) +
              '<div class="p-price">$' + Number(p.price).toFixed(2) + ' <span style="font-size: 10px; color: var(--slate-400); font-weight: 500;">/ ' + escapeHtml(p.unit) + '</span></div>' +
              '<div style="font-size: 9px; font-weight: 700; color: ' + (p.stockQty > 0 ? 'var(--emerald)' : '#ef4444') + '; text-transform: uppercase; margin-bottom: 12px;">' +
                (p.stockQty > 0 ? 'IN STOCK: ' + p.stockQty : 'OUT OF STOCK') +
              '</div>' +
              '<button class="btn-add ' + (inCart ? 'in-cart' : '') + '" onclick="toggleCart(\\'' + escapeJs(p.productId) + '\\')">' +
                (inCart ? 'SELECTED' : 'ADD TO ENQUIRY') +
              '</button>' +
            '</div>';

          grid.appendChild(card);
        });
      } catch (err) {
        console.error("Render failed:", err);
        const grid = document.getElementById('product-grid');
        if (grid) {
          grid.innerHTML = '<div class="empty-state" style="color: #ef4444;">Product rendering failed: ' + escapeHtml(err.message) + '</div>';
        }
      }
    }

    function renderProductAttributes(attributes) {
      if (!attributes || Object.keys(attributes).length === 0) {
        return '';
      }

      const rows = Object.entries(attributes)
        .slice(0, 6)
        .map(function(entry) {
          const key = entry[0];
          const value = entry[1];

          return (
            '<div style="overflow: hidden;">' +
              '<div style="color: grey; font-weight: 700; text-transform: uppercase;">' + escapeHtml(key) + '</div>' +
              '<div style="font-weight: 800; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' + escapeHtml(value) + '</div>' +
            '</div>'
          );
        })
        .join('');

      return (
        '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-bottom: 12px; font-size: 9px; background: whitesmoke; padding: 6px; border-radius: 4px;">' +
          rows +
        '</div>'
      );
    }

    function toggleCart(id) {
      if (cart[id]) {
        delete cart[id];
      } else {
        cart[id] = (cart[id] || 0) + 1;
      }

      saveCart();
      renderProducts();
      updateCartUI();
    }

    function updateCartQty(id, delta) {
      if (cart[id]) {
        cart[id] = Math.max(1, (cart[id] || 1) + delta);
        saveCart();
        updateCartUI();

        if (document.getElementById('cart-modal').classList.contains('active')) {
          renderCartList();
        }
      }
    }

    function saveCart() {
      localStorage.setItem('itred_cart_' + CATALOGUE.title, JSON.stringify(cart));
    }

    function updateCartUI() {
      const ids = Object.keys(cart);
      const bar = document.getElementById('cart-bar');

      if (!bar) return;

      if (ids.length > 0) {
        bar.classList.add('active');

        let total = 0;
        let qty = 0;

        ids.forEach(id => {
          const p = PRODUCTS.find(prod => prod.productId === id);

          if (p) {
            qty += cart[id];
            total += p.price * cart[id];
          }
        });

        document.getElementById('cart-qty-total').innerText = qty;
        document.getElementById('cart-price-total').innerText = total.toFixed(2);
      } else {
        bar.classList.remove('active');
      }
    }

    function openCart() {
      document.getElementById('cart-modal').classList.add('active');
      renderCartList();
    }

    function closeCart() {
      document.getElementById('cart-modal').classList.remove('active');
    }

    function renderCartList() {
      const list = document.getElementById('cart-items-list');
      if (!list) return;

      list.innerHTML = '';
      const ids = Object.keys(cart);

      if (ids.length === 0) {
        list.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--slate-400); font-weight: 700; text-transform: uppercase;">Cart is empty.</div>';
        return;
      }

      ids.forEach(id => {
        const p = PRODUCTS.find(prod => prod.productId === id);
        if (!p) return;

        const item = document.createElement('div');
        item.className = 'cart-item';

        item.innerHTML =
          '<div class="item-info">' +
            '<div class="item-name">' + escapeHtml(p.name) + '</div>' +
            '<div class="item-price">$' + Number(p.price).toFixed(2) + '</div>' +
          '</div>' +
          '<div class="qty-ctrl">' +
            '<button class="qty-btn" onclick="updateCartQty(\\'' + escapeJs(id) + '\\', -1)">-</button>' +
            '<span class="qty-val">' + cart[id] + '</span>' +
            '<button class="qty-btn" onclick="updateCartQty(\\'' + escapeJs(id) + '\\', 1)">+</button>' +
            '<button class="qty-btn" style="background:#fee2e2; color:#b91c1c; margin-left:10px;" onclick="toggleCart(\\'' + escapeJs(id) + '\\')">&times;</button>' +
          '</div>';

        list.appendChild(item);
      });
    }

    function sendWhatsApp() {
      const nameEl = document.getElementById('cust-name');

      if (nameEl && !nameEl.value.trim()) {
        alert("PLEASE ENTER YOUR NAME TO PROCEED.");
        nameEl.focus();
        return;
      }

      const customerName = nameEl?.value || 'Guest';
      const customerLocation = document.getElementById('cust-location')?.value || 'Not specified';
      const customerNotes = document.getElementById('cust-notes')?.value || '';

      const ids = Object.keys(cart);
      if (ids.length === 0) return;

      let message = "*📦 NEW ORDER ENQUIRY*\\n";
      message += "----------------------------\\n";
      message += "*Source:* Offline Catalogue\\n";
      message += "*Catalogue:* " + CATALOGUE.title + "\\n";
      message += "*Merchant:* " + VENDOR.businessName + "\\n";
      message += "----------------------------\\n\\n";

      message += "*[CUSTOMER DETAILS]*\\n";
      message += "• *Name:* " + customerName + "\\n";
      message += "• *Location:* " + customerLocation + "\\n";

      if (customerNotes) {
        message += "• *Notes:* " + customerNotes + "\\n";
      }

      message += "\\n*[ITEMS]*\\n";

      let total = 0;

      ids.forEach((id) => {
        const p = PRODUCTS.find(prod => prod.productId === id);

        if (p) {
          const subtotal = p.price * cart[id];
          total += subtotal;
          message += "• " + p.name + " (" + cart[id] + " " + p.unit + ") - $" + p.price.toFixed(2) + " | Sub: $" + subtotal.toFixed(2) + "\\n";
        }
      });

      message += "\\n*---------------------------*\\n";
      message += "*ESTIMATED TOTAL: $" + total.toFixed(2) + "*\\n";
      message += "*---------------------------*\\n\\n";

      if (BRANCH) {
        message += "*Pickup Local:* " + BRANCH.name + " (" + BRANCH.city + ")\\n";
      }

      message += "Please confirm stock availability and payment details.";

      const phone = CATALOGUE.whatsappNumber || VENDOR.whatsapp || VENDOR.phone || '';

      if (!phone) {
        alert("Vendor contact number not available.");
        return;
      }

      const cleanPhoneValue = cleanPhone(phone);
      const url = "https://wa.me/" + cleanPhoneValue + "?text=" + encodeURIComponent(message);

      window.open(url, '_blank');
    }

    function cleanPhone(phone) {
      return String(phone || '').replace(/\\D/g, '');
    }

    function getInitials(name) {
      return String(name || 'NA')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map(function(part) { return part[0]; })
        .join('')
        .toUpperCase() || 'NA';
    }

    function escapeHtml(value) {
      return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    function escapeJs(value) {
      return String(value || '')
        .replace(/\\\\/g, '\\\\\\\\')
        .replace(/'/g, "\\\\'")
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }

    function openFooterMenu() {
      const modal = document.getElementById('sc-contact-modal');

      if (modal) {
        modal.classList.add('active');
      }

      showFooterMenuTab(CURRENT_CONTACT_TAB || 'branches');
    }

    function closeFooterMenu() {
      const modal = document.getElementById('sc-contact-modal');

      if (modal) {
        modal.classList.remove('active');
      }
    }

    function showFooterMenuTab(tabName) {
      CURRENT_CONTACT_TAB = tabName;

      ['branches', 'staff', 'ideliver'].forEach(function(tab) {
        const button = document.getElementById('sc-tab-' + tab);

        if (button) {
          if (tab === tabName) {
            button.classList.add('active');
          } else {
            button.classList.remove('active');
          }
        }
      });

      renderFooterMenuSection(tabName);
    }

    function makeCall(phone) {
      const cleaned = cleanPhone(phone);

      if (!cleaned) {
        alert('Phone number not available.');
        return;
      }

      window.location.href = 'tel:+' + cleaned;
    }

    function sendContactWhatsApp(type, index) {
      let record = null;
      let message = '';

      if (type === 'branch') {
        record = BRANCHES[index];
        message =
          'Hello, I found your branch contact in the offline catalogue for ' +
          VENDOR.businessName +
          '. I need assistance with an order or product enquiry.';
      }

      if (type === 'staff') {
        record = STAFF[index];
        message =
          'Hello ' +
          (record?.fullName || 'Staff') +
          ', I found your staff contact in the offline catalogue for ' +
          VENDOR.businessName +
          '. I need assistance to close a sale/order.';
      }

      if (type === 'ideliver') {
        record = IDELIVER[index];
        message =
          'Hello ' +
          (record?.fullName || record?.name || 'iDeliver') +
          ', I found your iDeliver contact in the offline catalogue for ' +
          VENDOR.businessName +
          '. I need delivery service and would like to negotiate a delivery fare.';
      }

      const phone = cleanPhone(record?.whatsapp || record?.phone);

      if (!phone) {
        alert('WhatsApp number not available.');
        return;
      }

      window.open(
        'https://wa.me/' + phone + '?text=' + encodeURIComponent(message),
        '_blank'
      );
    }

    function renderAvatar(name, imageUrl) {
      if (imageUrl) {
        return (
          '<div class="sc-contact-avatar">' +
          '<img src="' +
          escapeHtml(imageUrl) +
          '" alt="' +
          escapeHtml(name) +
          '">' +
          '</div>'
        );
      }

      return '<div class="sc-contact-avatar">' + escapeHtml(getInitials(name)) + '</div>';
    }

    function renderFooterMenuSection(tabName) {
      const list = document.getElementById('sc-contact-list');

      if (!list) {
        return;
      }

      list.innerHTML = '';

      if (tabName === 'branches') {
        if (!BRANCHES || BRANCHES.length === 0) {
          list.innerHTML =
            '<div class="sc-empty-contacts">No records available for this section. Contact the vendor directly.</div>';
          return;
        }

        BRANCHES.forEach(function(branch, index) {
          const name = branch.branchName || branch.name || 'Branch';
          const location = [
            branch.address,
            branch.suburb,
            branch.district,
            branch.city,
          ]
            .filter(Boolean)
            .join(', ');

          const callPhone = escapeJs(branch.phone || branch.whatsapp || '');

          const card = document.createElement('div');
          card.className = 'sc-contact-card';

          card.innerHTML =
            renderAvatar(name, '') +
            '<div>' +
            '<div class="sc-contact-name">' +
            escapeHtml(name) +
            '</div>' +
            '<div class="sc-contact-meta">' +
            escapeHtml(location || 'Location not provided') +
            '</div>' +
            '<div class="sc-contact-meta">Status: ' +
            escapeHtml(branch.status || 'active') +
            '</div>' +
            '</div>' +
            '<div class="sc-contact-actions">' +
            '<button class="sc-call-btn" onclick="makeCall(\\'' +
            callPhone +
            '\\')">Call</button>' +
            '<button class="sc-whatsapp-btn" onclick="sendContactWhatsApp(\\'branch\\',' +
            index +
            ')">WhatsApp</button>' +
            '</div>';

          list.appendChild(card);
        });

        return;
      }

      if (tabName === 'staff') {
        if (!STAFF || STAFF.length === 0) {
          list.innerHTML =
            '<div class="sc-empty-contacts">No records available for this section. Contact the vendor directly.</div>';
          return;
        }

        STAFF.forEach(function(staff, index) {
          const name = staff.fullName || 'Staff Member';
          const callPhone = escapeJs(staff.phone || staff.whatsapp || '');

          const card = document.createElement('div');
          card.className = 'sc-contact-card';

          card.innerHTML =
            renderAvatar(name, staff.imageUrl) +
            '<div>' +
            '<div class="sc-contact-name">' +
            escapeHtml(name) +
            '</div>' +
            '<div class="sc-contact-meta">Role: ' +
            escapeHtml(staff.role || 'staff') +
            '</div>' +
            '<div class="sc-contact-meta">Status: ' +
            escapeHtml(staff.status || 'profile_created') +
            '</div>' +
            '</div>' +
            '<div class="sc-contact-actions">' +
            '<button class="sc-call-btn" onclick="makeCall(\\'' +
            callPhone +
            '\\')">Call</button>' +
            '<button class="sc-whatsapp-btn" onclick="sendContactWhatsApp(\\'staff\\',' +
            index +
            ')">WhatsApp</button>' +
            '</div>';

          list.appendChild(card);
        });

        return;
      }

      if (tabName === 'ideliver') {
        if (!IDELIVER || IDELIVER.length === 0) {
          list.innerHTML =
            '<div class="sc-empty-contacts">No records available for this section. Contact the vendor directly.</div>';
          return;
        }

        IDELIVER.forEach(function(delivery, index) {
          const name = delivery.fullName || delivery.name || 'iDeliver Personnel';
          const service = [
            delivery.vehicleType,
            delivery.vehicleRegistration,
            delivery.serviceArea || delivery.coverageArea,
          ]
            .filter(Boolean)
            .join(' • ');

          const callPhone = escapeJs(delivery.phone || delivery.whatsapp || '');

          const card = document.createElement('div');
          card.className = 'sc-contact-card';

          card.innerHTML =
            renderAvatar(name, delivery.imageUrl) +
            '<div>' +
            '<div class="sc-contact-name">' +
            escapeHtml(name) +
            '</div>' +
            '<div class="sc-contact-meta">' +
            escapeHtml(service || 'Delivery service details not provided') +
            '</div>' +
            '<div class="sc-contact-meta">Base Fee: $' +
            Number(delivery.baseFee || 0).toFixed(2) +
            '</div>' +
            '</div>' +
            '<div class="sc-contact-actions">' +
            '<button class="sc-call-btn" onclick="makeCall(\\'' +
            callPhone +
            '\\')">Call</button>' +
            '<button class="sc-whatsapp-btn" onclick="sendContactWhatsApp(\\'ideliver\\',' +
            index +
            ')">WhatsApp</button>' +
            '</div>';

          list.appendChild(card);
        });
      }
    }

    document.addEventListener("DOMContentLoaded", init);
  </script>
</body>
</html>`;
}