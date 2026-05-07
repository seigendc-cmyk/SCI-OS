You are working inside my React/Vite/Firebase iTred by seiGEN Commerce codebase.

TASK:
Upgrade the exported offline catalogue HTML so that the footer includes a three-dot menu. The three-dot menu must open a clean mobile-first panel with pages/sections for:

1. Branches
2. Staff
3. iDeliver

The exported catalogue is a standalone offline HTML file, so do not depend on live Firestore reads inside the exported file. All required branch, staff, and iDeliver data must be embedded into the exported HTML at catalogue generation time.

IMPORTANT:
Do not alter Firebase rules, login logic, staff invite logic, POS logic, vendor registration, console logic, or routing for this task.

SEARCH FIRST:
Search the codebase for:
- generateOfflineCatalogueHtml
- exportService.ts
- catalogue export
- deliveryServices
- branch
- staff
- iDeliver
- text/html
- Blob
- download

Primary file likely:
src/services/exportService.ts

Existing footer helper likely:
src/services/catalogueFooterService.ts

CURRENT GOAL:
In the exported catalogue footer, add a floating or footer-based three-dot menu button. When clicked, it opens an overlay/panel with three tabs or sections:
- Branches
- Staff
- iDeliver

DATA REQUIREMENTS:
The export function should support these inputs:

vendor
catalogue
products
branch
deliveryServices
staffMembers or staff
branches

If staff/branches are not already passed into generateOfflineCatalogueHtml, update the caller to fetch and pass them before export.

Expected embedded data shapes:

branches:
[
  {
    branchId: string,
    name: string,
    branchName: string,
    phone: string,
    whatsapp: string,
    address: string,
    city: string,
    district: string,
    suburb: string,
    status: string
  }
]

staff:
[
  {
    staffId: string,
    fullName: string,
    role: string,
    phone: string,
    whatsapp: string,
    imageUrl: string,
    status: string,
    loginStatus: string
  }
]

iDeliver / deliveryServices:
[
  {
    deliveryId: string,
    name: string,
    fullName: string,
    phone: string,
    whatsapp: string,
    imageUrl: string,
    vehicleType: string,
    vehicleRegistration: string,
    serviceArea: string,
    coverageArea: string,
    baseFee: number,
    status: string
  }
]

OFFLINE RULE:
Do not call Firestore from inside the exported HTML. Use embedded JSON constants:
const BRANCHES = ...
const STAFF = ...
const IDELIVER = ...

If imageUrl is missing, show initials/avatar placeholder. Do not break export when images are missing.

UI REQUIREMENTS:
Add footer menu UI to exported catalogue HTML:

1. A subtle footer three-dot button labelled:
   "More vendor contacts"

2. When clicked, open a bottom-sheet or centered modal.

3. Modal has tabs/buttons:
   Branches | Staff | iDeliver

4. Branches section:
   - Show branch name
   - Address/city/district/suburb
   - Direct Call button using tel:
   - WhatsApp Message button using wa.me
   - Message should say customer is contacting from offline catalogue and wants assistance/order closure.

5. Staff section:
   - Show staff image or initials placeholder
   - Full name
   - Role
   - Direct Call button
   - WhatsApp Message button
   - Message should say customer wants assistance to close a sale/order from the offline catalogue.

6. iDeliver section:
   - Show delivery personnel image or initials placeholder
   - Name
   - Vehicle type / registration if available
   - Service area / coverage area
   - Direct Call button
   - WhatsApp Message button
   - Message should say customer needs delivery service, wants to negotiate fare, and is contacting from the vendor offline catalogue.

7. If no records exist for a section, show:
   "No records available for this section. Contact the vendor directly."

8. The modal must work without external libraries.

9. The existing product search, cart, WhatsApp order enquiry, and catalogue legal footer must continue working.

10. The legal footer "powered by seiGEN Commerce" and warranties/indemnity notice must remain below or near this menu.

CSS REQUIREMENTS:
Add mobile-first CSS into the exported HTML style block:
- .sc-footer-menu
- .sc-dot-menu-button
- .sc-contact-modal
- .sc-contact-modal.active
- .sc-contact-card
- .sc-contact-avatar
- .sc-contact-actions
- .sc-call-btn
- .sc-whatsapp-btn
- .sc-tab-btn
- .sc-tab-btn.active

Use professional iTred styling:
- orange accents
- deep charcoal/slate background
- rounded cards
- small uppercase labels
- mobile-friendly buttons

FUNCTIONAL REQUIREMENTS INSIDE EXPORTED HTML SCRIPT:
Add JavaScript functions:
- openFooterMenu()
- closeFooterMenu()
- showFooterMenuTab(tabName)
- renderFooterMenuSection(tabName)
- makeCall(phone)
- sendContactWhatsApp(type, record)

WhatsApp URL format:
https://wa.me/{cleanPhone}?text={encodedMessage}

Phone cleaning:
String(phone || '').replace(/\D/g, '')

Messages:
Branch message:
"Hello, I found your branch contact in the offline catalogue for {vendorName}. I need assistance with an order or product enquiry."

Staff message:
"Hello {staffName}, I found your staff contact in the offline catalogue for {vendorName}. I need assistance to close a sale/order."

iDeliver message:
"Hello {deliveryName}, I found your iDeliver contact in the offline catalogue for {vendorName}. I need delivery service and would like to negotiate a delivery fare."

IMPLEMENTATION STEPS:
1. Update generateOfflineCatalogueHtml input typing to include:
   branches?: any[];
   staffMembers?: any[];
   deliveryServices?: any[];

2. Create safe arrays:
   safeBranches
   safeStaff
   safeIDeliver

3. JSON stringify them safely:
   const BRANCHES_JSON = JSON.stringify(safeBranches).replace(/</g, '\\u003c');
   const STAFF_JSON = JSON.stringify(safeStaff).replace(/</g, '\\u003c');
   const IDELIVER_JSON = JSON.stringify(safeIDeliver).replace(/</g, '\\u003c');

4. Embed:
   const BRANCHES = ${BRANCHES_JSON};
   const STAFF = ${STAFF_JSON};
   const IDELIVER = ${IDELIVER_JSON};

5. Add HTML before legal footer:
   - footer menu button
   - contact modal

6. Add CSS inside the exported catalogue style block.

7. Add JavaScript functions inside the exported HTML script.

8. Update the caller of generateOfflineCatalogueHtml to pass branches and staff members if available. If no staff/branches data is currently fetched, do not break the export. Pass empty arrays until fetch logic is added.

9. Run:
   npm run build

10. Fix TypeScript errors without changing unrelated modules.

EXPECTED RESULT:
The exported offline catalogue should have:
- Product catalogue as before
- Working cart and WhatsApp ordering as before
- Three-dot footer menu
- Branches tab with call/WhatsApp
- Staff tab with personnel images/placeholders and call/WhatsApp
- iDeliver tab with personnel images/placeholders and call/WhatsApp
- Legal footer with "powered by seiGEN Commerce" and warranties/indemnity
- No Firestore dependency inside exported HTML
