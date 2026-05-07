export function escapeCatalogueText(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function buildCatalogueContactMenu(): string {
  return `
    <!-- Exported catalogue floating contact menu -->
    <section class="sc-footer-menu">
      <button class="sc-dot-menu-button" onclick="openFooterMenu()" type="button">
        <span>⋯</span>
        <small>More vendor contacts</small>
      </button>
    </section>

    <div id="sc-contact-modal" class="sc-contact-modal" onclick="if(event.target === this) closeFooterMenu()">
      <div class="sc-contact-sheet">
        <div class="sc-contact-header">
          <div>
            <div class="sc-contact-kicker">Vendor Contact Desk</div>
            <h3>Branches, Staff &amp; iDeliver</h3>
          </div>

          <button type="button" class="sc-contact-close" onclick="closeFooterMenu()">×</button>
        </div>

        <div class="sc-contact-tabs">
          <button type="button" id="sc-tab-branches" class="sc-tab-btn active" onclick="showFooterMenuTab('branches')">
            Branches
          </button>

          <button type="button" id="sc-tab-staff" class="sc-tab-btn" onclick="showFooterMenuTab('staff')">
            Staff
          </button>

          <button type="button" id="sc-tab-ideliver" class="sc-tab-btn" onclick="showFooterMenuTab('ideliver')">
            iDeliver
          </button>
        </div>

        <div id="sc-contact-list" class="sc-contact-list"></div>
      </div>
    </div>
  `;
}

export function buildCatalogueLegalFooter(vendorName?: string): string {
  const year = new Date().getFullYear();
  const safeVendorName = escapeCatalogueText(vendorName || 'registered vendor');

  return `
    <!-- Exported catalogue legal footer -->
    <!-- Do not remove: compliance and platform attribution notice -->
    <footer class="sc-footer">
      <div class="sc-powered">powered by seiGEN Commerce</div>

      <div class="sc-legal">
        <strong>Warranties &amp; Indemnity Notice</strong>

        <p>
          This catalogue is published by the vendor for product discovery and order initiation.
          Product descriptions, prices, stock availability, delivery terms, warranties and after-sales
          obligations remain the responsibility of the vendor.
        </p>

        <p>
          seiGEN Commerce provides the digital commerce infrastructure used to generate and display
          this catalogue, but does not manufacture, own, inspect, warrant, sell, deliver, or guarantee
          the listed goods or services unless expressly stated in a separate written agreement.
        </p>

        <p>
          Buyers should confirm final price, stock availability, payment terms, delivery arrangements,
          refund conditions, statutory obligations, and product suitability directly with the vendor
          before completing a transaction.
        </p>

        <p>
          By using this catalogue, the vendor indemnifies seiGEN Commerce, Digital Commerce, and their
          operators from claims arising from inaccurate listings, product defects, failed fulfilment,
          unlawful goods, tax non-compliance, customer disputes, or misuse of the catalogue.
        </p>
      </div>

      <div class="sc-copy">
        © ${year} seiGEN Commerce Infrastructure. Catalogue generated for ${safeVendorName}.
      </div>
    </footer>
  `;
}

export const catalogueFooterStyles = `
  .sc-footer {
    margin-top: 48px;
    padding: 28px 18px 34px;
    text-align: center;
    border-top: 1px solid rgba(15, 23, 42, 0.08);
    background: linear-gradient(180deg, rgba(255,255,255,0.72), rgba(248,250,252,0.92));
    color: rgba(15, 23, 42, 0.58);
  }

  .sc-powered {
    margin-bottom: 14px;
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: rgba(234, 88, 12, 0.42);
  }

  .sc-legal {
    max-width: 860px;
    margin: 0 auto;
    font-size: 10px;
    line-height: 1.65;
    color: rgba(15, 23, 42, 0.56);
  }

  .sc-legal strong {
    display: block;
    margin-bottom: 8px;
    font-size: 10px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: rgba(15, 23, 42, 0.72);
  }

  .sc-legal p {
    margin: 6px 0;
  }

  .sc-copy {
    margin-top: 16px;
    font-size: 9px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: rgba(15, 23, 42, 0.42);
  }

  .sc-footer-menu {
    position: fixed;
    right: 18px;
    bottom: 92px;
    z-index: 450;
    margin: 0;
    padding: 0;
    text-align: right;
  }

  .sc-dot-menu-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    min-width: 210px;
    border: 1px solid rgba(234, 88, 12, 0.34);
    background: rgba(15, 23, 42, 0.94);
    color: white;
    border-radius: 999px;
    padding: 12px 16px;
    cursor: pointer;
    box-shadow: 0 18px 45px rgba(15, 23, 42, 0.28);
  }

  .sc-dot-menu-button span {
    width: 30px;
    height: 30px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: rgba(234, 88, 12, 0.22);
    color: #fb923c;
    border-radius: 999px;
    font-size: 22px;
    line-height: 1;
    font-weight: 900;
  }

  .sc-dot-menu-button small {
    font-size: 10px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: white;
  }

  .sc-contact-modal {
    position: fixed;
    inset: 0;
    z-index: 500;
    display: none;
    align-items: flex-end;
    justify-content: center;
    padding: 18px;
    background: rgba(15, 23, 42, 0.62);
    backdrop-filter: blur(8px);
  }

  .sc-contact-modal.active {
    display: flex;
  }

  .sc-contact-sheet {
    width: min(960px, 100%);
    max-height: 84vh;
    overflow-y: auto;
    border-radius: 24px;
    border: 1px solid rgba(226, 232, 240, 0.24);
    background: #ffffff;
    box-shadow: 0 28px 80px rgba(15, 23, 42, 0.34);
  }

  .sc-contact-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 18px;
    padding: 22px;
    border-bottom: 1px solid rgba(226, 232, 240, 0.9);
    background: linear-gradient(135deg, #0f172a, #1e293b);
    color: white;
  }

  .sc-contact-kicker {
    margin-bottom: 6px;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: #fb923c;
  }

  .sc-contact-header h3 {
    margin: 0;
    font-size: 20px;
    font-weight: 900;
    letter-spacing: -0.02em;
  }

  .sc-contact-close {
    width: 36px;
    height: 36px;
    border: 1px solid rgba(255, 255, 255, 0.24);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.1);
    color: white;
    font-size: 24px;
    line-height: 1;
    cursor: pointer;
  }

  .sc-contact-tabs {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    padding: 14px;
    border-bottom: 1px solid rgba(226, 232, 240, 0.9);
    background: #f8fafc;
  }

  .sc-tab-btn {
    border: 1px solid rgba(226, 232, 240, 1);
    background: white;
    color: #475569;
    border-radius: 14px;
    padding: 12px 10px;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    cursor: pointer;
  }

  .sc-tab-btn.active {
    border-color: rgba(234, 88, 12, 0.45);
    background: rgba(234, 88, 12, 0.1);
    color: #ea580c;
  }

  .sc-contact-list {
    display: grid;
    gap: 12px;
    padding: 16px;
  }

  .sc-contact-card {
    display: grid;
    grid-template-columns: 52px 1fr auto;
    align-items: center;
    gap: 14px;
    padding: 14px;
    border: 1px solid rgba(226, 232, 240, 1);
    border-radius: 18px;
    background: white;
  }

  .sc-contact-avatar {
    width: 52px;
    height: 52px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    border-radius: 16px;
    background: linear-gradient(135deg, rgba(234, 88, 12, 0.16), rgba(15, 23, 42, 0.08));
    color: #ea580c;
    font-size: 14px;
    font-weight: 900;
  }

  .sc-contact-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .sc-contact-name {
    margin-bottom: 4px;
    font-size: 13px;
    font-weight: 900;
    color: #0f172a;
    text-transform: uppercase;
  }

  .sc-contact-meta {
    margin-top: 2px;
    font-size: 11px;
    font-weight: 700;
    color: #64748b;
  }

  .sc-contact-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .sc-call-btn,
  .sc-whatsapp-btn {
    border: none;
    border-radius: 999px;
    padding: 10px 14px;
    font-size: 10px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    cursor: pointer;
  }

  .sc-call-btn {
    background: #0f172a;
    color: white;
  }

  .sc-whatsapp-btn {
    background: #10b981;
    color: white;
  }

  .sc-empty-contacts {
    padding: 26px 18px;
    border: 1px dashed rgba(148, 163, 184, 0.72);
    border-radius: 18px;
    background: #f8fafc;
    color: #64748b;
    font-size: 12px;
    font-weight: 800;
    text-align: center;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  @media (max-width: 640px) {
    .sc-footer-menu {
      right: 12px;
      left: 12px;
      bottom: 88px;
      text-align: center;
    }

    .sc-dot-menu-button {
      width: 100%;
      min-width: 0;
    }

    .sc-contact-modal {
      padding: 10px;
    }

    .sc-contact-sheet {
      max-height: 88vh;
      border-radius: 20px;
    }

    .sc-contact-header {
      padding: 18px;
    }

    .sc-contact-tabs {
      grid-template-columns: 1fr;
    }

    .sc-contact-card {
      grid-template-columns: 48px 1fr;
      align-items: flex-start;
    }

    .sc-contact-actions {
      grid-column: 1 / -1;
      width: 100%;
      justify-content: stretch;
    }

    .sc-call-btn,
    .sc-whatsapp-btn {
      flex: 1;
    }
  }

  @media print {
    .sc-footer {
      page-break-inside: avoid;
      background: #fff;
      border-top: 1px solid #ddd;
    }

    .sc-powered {
      color: rgba(234, 88, 12, 0.5);
    }

    .sc-legal {
      color: #555;
    }

    .sc-footer-menu,
    .sc-contact-modal {
      display: none !important;
    }
  }
`;