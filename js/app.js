/* =============================== */
/* MOTEUR EM AREA V3.0 (CORRIGÉ)   */
/* =============================== */

const ADMIN_WHATSAPP = "22870901801"; // TON NUMÉRO

let allProducts = [];
let allShops = [];
let viewedProducts = JSON.parse(localStorage.getItem('em_history')) || [];
let cart = JSON.parse(localStorage.getItem('em_cart')) || [];

document.addEventListener('DOMContentLoaded', () => {
    checkDarkMode();
    updateCartCount();

    // Splash
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        if(splash) {
            splash.style.opacity = '0';
            setTimeout(() => splash.style.visibility = 'hidden', 500);
        }
    }, 1500);

    // Routing
    if(document.getElementById('products-container')) {
        initApp();
        renderHistory();
    } 
    else if(document.getElementById('jobs-container')) {
        loadJobs();
    }
    else if(document.getElementById('shops-container')) {
        loadShopsOnly(); // Pour page secondaire si besoin
    }

    // Listener Panier
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('cart-modal');
        if (e.target === modal) toggleCart();
    });
});

async function initApp() {
    showSkeletonLoader();
    try {
        const res = await fetch('shops.json?t=' + Date.now());
        const rawShops = await res.json();
        allShops = rawShops.filter(s => s.subscription === 'active');
        allShops.sort((a, b) => (b.boost_level || 0) - (a.boost_level || 0));

        renderShops(); // Boutiques en bas
        
        const promises = allShops.map(shop => fetchShopProducts(shop));
        const results = await Promise.allSettled(promises);
        
        let promoItems = [];
        let standardItems = [];

        results.forEach(result => {
            if (result.status === 'fulfilled') {
                result.value.forEach(p => {
                    if (p.is_star || p.boost_level > 0 || (p.prix_original > p.prix)) promoItems.push(p);
                    else standardItems.push(p);
                });
            }
        });

        allProducts = [...promoItems, ...standardItems];

        // UI
        const loader = document.getElementById('loader');
        if(loader) loader.style.display = 'none';
        
        renderCategories(); // Barre filtres
        renderPromos(promoItems);
        renderProducts(standardItems); // Affiche tout par défaut
        setupSearch();

    } catch (e) { console.error(e); }
}

async function fetchShopProducts(shop) {
    if (!shop.url || shop.url === '#') return [];
    try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 6000);
        const jsonUrl = shop.url.endsWith('/') ? `${shop.url}data/produits.json` : `${shop.url}/data/produits.json`;
        const res = await fetch(jsonUrl, { signal: controller.signal });
        clearTimeout(id);
        if(!res.ok) return [];
        const data = await res.json();
        const items = data.items ? data.items : data;
        
        return items.map(p => {
            let imgSrc = p.image;
            if (imgSrc && !imgSrc.startsWith('http')) {
                if (imgSrc.startsWith('/')) imgSrc = imgSrc.substring(1);
                const baseUrl = shop.url.endsWith('/') ? shop.url : `${shop.url}/`;
                imgSrc = baseUrl + imgSrc;
            }
            return {
                id: p.id, nom: p.nom, category: p.category || "Divers",
                prix: p.prix, prix_original: p.prix_original,
                wholesale_price: p.wholesale_price, min_qty: p.min_qty,
                stock_status: p.stock_status || 'stock', video_url: p.video_url,
                negotiable: p.negotiable, image: imgSrc,
                shopName: shop.name, shopUrl: shop.url, shopBoost: shop.boost_level || 0,
                isVerified: shop.verified, is_star: p.is_star
            };
        });
    } catch { return []; }
}

// --- RENDU UI ---

function renderCategories() {
    // Style "Pill Scroll" esthétique
    const cats = ['Tout', ...new Set(allProducts.map(p => p.category))];
    const container = document.getElementById('cat-bar-container');
    if(!container) return;

    let html = `<div class="shops-slider" style="padding: 0 0 10px; margin-top:-10px;">`;
    cats.forEach(c => {
        // "Tout" est actif par défaut
        const activeStyle = c === 'Tout' ? 'background:var(--dark); color:white; border-color:var(--dark);' : 'background:white; color:#555; border-color:#ddd;';
        html += `
            <button onclick="filterCategory('${c}', this)" 
            class="cat-pill"
            style="border:1px solid; padding:6px 16px; border-radius:50px; font-size:0.85rem; white-space:nowrap; cursor:pointer; margin-right:8px; ${activeStyle}">
            ${c}
            </button>`;
    });
    html += `</div>`;
    container.innerHTML = html;
}

function filterCategory(cat, btn) {
    // Gestion visuelle
    document.querySelectorAll('.cat-pill').forEach(b => {
        b.style.background='white'; b.style.color='#555'; b.style.borderColor='#ddd';
    });
    btn.style.background = 'var(--dark)'; btn.style.color='white'; btn.style.borderColor='var(--dark)';

    if(cat === 'Tout') renderProducts(allProducts);
    else renderProducts(allProducts.filter(p => p.category === cat));
}

function renderProducts(products) {
    const container = document.getElementById('products-container');
    if(!container) return; 
    container.innerHTML = ''; 

    if(products.length === 0) {
        container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:40px;">Aucun produit trouvé.</div>`;
        return;
    }

    products.slice(0, 40).forEach(p => {
        const priceDisplay = Number(p.prix).toLocaleString() + ' F';
        let badgesHTML = '';
        if(p.stock_status === 'order') badgesHTML += `<div class="badge-new" style="background:#3498db;">COMMANDE</div>`;
        else if(p.is_new) badgesHTML += `<div class="badge-new">NOUVEAU</div>`;

        const targetUrl = `${p.shopUrl}/index.html?id=${p.id}`;
        const safeName = p.nom.replace(/'/g, "\\'");
        const safeShop = p.shopName.replace(/'/g, "\\'");

        container.innerHTML += `
            <div class="product-card" data-aos="fade-up">
                ${badgesHTML}
                <div style="position:relative;">
                    <a href="${targetUrl}" target="_blank" onclick="addToHistory('${p.id}', '${safeName}', '${p.image}', '${p.shopUrl}')">
                        <img src="${p.image}" class="product-img" loading="lazy" onerror="this.src='https://via.placeholder.com/150'">
                    </a>
                    <button onclick="addToCart('${p.id}', '${safeName}', ${p.prix}, '${p.image}', '${safeShop}')" 
                        style="position:absolute; bottom:10px; right:10px; width:35px; height:35px; border-radius:50%; border:none; background:white; color:var(--primary); font-weight:bold; box-shadow:0 3px 10px rgba(0,0,0,0.2); cursor:pointer; font-size:1.2rem;">
                        +
                    </button>
                </div>
                <div class="product-info">
                    <div class="product-shop">${p.shopName}</div>
                    <div class="product-title">${p.nom}</div>
                    <div class="product-price">${priceDisplay}</div>
                </div>
            </div>`;
    });
}

function renderPromos(promos) {
    const c = document.getElementById('promo-container');
    if(!c) return;
    if(promos.length===0) { c.style.display='none'; return; }
    
    c.innerHTML = '';
    promos.forEach(p => {
        const priceDisplay = Number(p.prix).toLocaleString() + ' F';
        const oldPrice = p.prix_original ? `<span class="old-price">${Number(p.prix_original).toLocaleString()} F</span>` : '';
        const safeName = p.nom.replace(/'/g, "\\'");
        const safeShop = p.shopName.replace(/'/g, "\\'");
        
        c.innerHTML += `
            <div class="promo-card">
                <img src="${p.image}" onclick="window.open('${p.shopUrl}/index.html?id=${p.id}')">
                <div class="promo-info">
                    <div class="product-shop" style="color:#e67e22;">🔥 FLASH</div>
                    <div class="promo-title">${p.nom}</div>
                    <div>${oldPrice}<span class="promo-price">${priceDisplay}</span></div>
                    <button onclick="addToCart('${p.id}', '${safeName}', ${p.prix}, '${p.image}', '${safeShop}')" 
                        class="btn btn-primary" style="font-size:0.75rem; padding:6px 15px; margin-top:8px; width:100%;">
                        Ajouter
                    </button>
                </div>
            </div>`;
    });
}

function renderShops() {
    const c = document.getElementById('shops-container');
    const countLabel = document.getElementById('shop-count');
    if(c && countLabel) {
        countLabel.textContent = `${allShops.length} actifs`;
        c.innerHTML = '';
        
        // Récupération du thème actuel
        const currentTheme = localStorage.getItem('em_theme') || 'light';

        allShops.forEach(s => {
            // CONSTRUCTION INTELLIGENTE DU LIEN
            const separator = s.url.includes('?') ? '&' : '?';
            // On ajoute le paramètre theme=dark ou light
            const linkWithTheme = `${s.url}${separator}theme=${currentTheme}`;
            
            let sponsorBadge = s.boost_level > 0 ? `<div class="badge-sponsored">SPONSORISÉ</div>` : '';
            
            // On utilise linkWithTheme dans le href
            c.innerHTML += `
            <a href="${linkWithTheme}" class="shop-card" target="_blank">
                <div style="position:relative;">
                    <img src="${s.logo}" class="shop-logo" style="${s.boost_level > 0 ? "border:2px solid #FFD700" : ""}" onerror="this.src='https://via.placeholder.com/70'">
                    ${sponsorBadge}
                </div>
                <div class="shop-name">${s.name}</div>
            </a>`;
        });
    }
}

// --- JOBS ---
function loadJobs() {
    const container = document.getElementById('jobs-container');
    if(!container) return;
    
    // Essayer de charger depuis jobs.json, sinon afficher placeholder
    fetch('jobs.json')
        .then(res => res.json())
        .then(jobs => {
            container.innerHTML = ''; 
            if(jobs.length === 0) { container.innerHTML = '<div style="text-align:center; padding:20px;">Aucune offre disponible.</div>'; return; }
            jobs.forEach(job => {
                container.innerHTML += `
                <div class="job-card" data-aos="fade-up">
                    <div class="job-header">
                        <div class="job-avatar" style="background:#e3f2fd; color:#1565c0;">${job.company.charAt(0)}</div>
                        <div class="job-main-info"><h3>${job.title}</h3><div class="job-company"><span>🏢 ${job.company}</span></div></div>
                    </div>
                    <p class="job-desc">${job.desc}</p>
                    <div class="job-footer"><span class="job-salary">${job.salary}</span><a href="https://wa.me/${job.whatsapp}" class="btn btn-primary" style="font-size:0.8rem; padding:8px 20px;">Postuler</a></div>
                </div>`;
            });
        })
        .catch(() => container.innerHTML = '<div style="text-align:center; padding:20px;">Aucune offre trouvée.</div>');
}

// --- PANIER & LOGISTIQUE (CORRIGÉ) ---
function toggleCart() {
    const modal = document.getElementById('cart-modal');
    if(modal) {
        if(modal.classList.contains('active')) modal.classList.remove('active');
        else { renderCart(); modal.classList.add('active'); }
    }
}

function addToCart(id, name, price, image, shop) {
    if(navigator.vibrate) navigator.vibrate(50);
    cart.push({ id, name, price, image, shop });
    localStorage.setItem('em_cart', JSON.stringify(cart));
    updateCartCount();
    const btn = event.currentTarget; 
    const originalText = btn.innerHTML;
    btn.innerHTML = '✓'; btn.style.background = '#27ae60'; btn.style.color='white';
    setTimeout(() => { btn.style.background = 'white'; btn.style.color='var(--primary)'; btn.innerHTML = originalText; }, 1000);
}

function removeFromCart(index) {
    cart.splice(index, 1);
    localStorage.setItem('em_cart', JSON.stringify(cart));
    renderCart();
    updateCartCount();
}

function updateCartCount() {
    const badge = document.getElementById('cart-count');
    if(badge) {
        badge.innerText = cart.length;
        badge.style.display = cart.length > 0 ? 'inline-block' : 'none';
    }
}

function renderCart() {
    const list = document.getElementById('cart-items');
    const footer = document.getElementById('cart-footer');
    const totalEl = document.getElementById('cart-total-amount');
    
    if(!list) return;
    if(cart.length === 0) {
        list.innerHTML = `<div style="text-align:center; padding:40px; color:#ccc;"><p>Votre panier est vide</p></div>`;
        if(footer) footer.style.display = 'none';
        return;
    }

    list.innerHTML = '';
    let subTotal = 0;

    cart.forEach((item, index) => {
        subTotal += Number(item.price);
        list.innerHTML += `
        <div class="cart-item">
            <img src="${item.image}" onerror="this.src='https://via.placeholder.com/50'">
            <div class="cart-item-info">
                <div class="cart-title">${item.name}</div>
                <div style="font-size:0.7rem; color:#888;">${item.shop}</div>
                <div class="cart-price">${Number(item.price).toLocaleString()} F</div>
            </div>
            <button class="btn-remove" onclick="removeFromCart(${index})">&times;</button>
        </div>`;
    });

    // ZONE LOGISTIQUE : Pas de prix fixe
    list.innerHTML += `
        <div style="margin-top:20px; padding:15px; background:#f8f9fa; border-radius:12px;">
            <div style="font-weight:bold; margin-bottom:10px;">Mode de réception :</div>
            
            <label style="display:flex; align-items:center; gap:10px; margin-bottom:10px; cursor:pointer;">
                <input type="radio" name="delivery-mode" value="boutique" checked onchange="toggleZoneInput(false)">
                <span>🏃 Retrait en Boutique (Gratuit)</span>
            </label>
            
            <label style="display:flex; align-items:center; gap:10px; cursor:pointer;">
                <input type="radio" name="delivery-mode" value="livraison" onchange="toggleZoneInput(true)">
                <span>🛵 Livraison (Prix selon zone)</span>
            </label>
            
            <input type="text" id="delivery-zone" placeholder="Votre Quartier (ex: Agoè)" 
                style="width:100%; padding:8px; border:1px solid #ddd; border-radius:8px; margin-top:10px; display:none;">
        </div>
    `;

    // Le total affiché est uniquement celui des produits
    totalEl.innerText = subTotal.toLocaleString() + ' F';
    if(footer) footer.style.display = 'block';
}

function toggleZoneInput(show) {
    const input = document.getElementById('delivery-zone');
    if(input) input.style.display = show ? 'block' : 'none';
}

function checkoutWhatsApp() {
    if(cart.length === 0) return;
    
    const mode = document.querySelector('input[name="delivery-mode"]:checked').value;
    const zone = document.getElementById('delivery-zone').value;
    
    if(mode === 'livraison' && !zone) {
        alert("Veuillez indiquer votre quartier.");
        return;
    }

    let msg = `*NOUVELLE COMMANDE (${mode === 'livraison' ? 'LIVRAISON' : 'RETRAIT'})* 📦\n`;
    if(mode === 'livraison') msg += `📍 Quartier : ${zone}\n`;
    msg += `---------------------------\n`;

    let total = 0;
    const grouped = {};
    cart.forEach(item => {
        if(!grouped[item.shop]) grouped[item.shop] = [];
        grouped[item.shop].push(item);
        total += Number(item.price);
    });

    for (const [shopName, items] of Object.entries(grouped)) {
        msg += `🏪 *${shopName}*\n`;
        items.forEach(i => msg += `- ${i.name} (${Number(i.price).toLocaleString()} F)\n`);
    }

    msg += `---------------------------\n`;
    msg += `💰 *SOUS-TOTAL PRODUITS : ${total.toLocaleString()} F*\n`;
    if(mode === 'livraison') msg += `⚠️ Frais de livraison à définir selon le quartier.`;

    window.open(`https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(msg)}`, '_blank');
}

function showSkeletonLoader() {
    const prodC = document.getElementById('products-container');
    if(prodC) { prodC.innerHTML = ''; for(let i=0;i<4;i++) prodC.innerHTML += `<div class="skeleton-card skeleton"><div class="skeleton-img skeleton"></div><div class="skeleton-line skeleton"></div></div>`; }
}
async function loadShopsOnly() { /* Code existant */ }
function setupSearch() { /* Code existant */ }
window.clearSearch = function() { const i = document.getElementById('search-input'); if(i){ i.value=''; i.dispatchEvent(new Event('input')); i.focus(); } };
function toggleDarkMode() { document.body.classList.toggle('dark-mode'); localStorage.setItem('em_theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light'); }
function checkDarkMode() { if(localStorage.getItem('em_theme') === 'dark') document.body.classList.add('dark-mode'); }
window.copyLink = (url) => { if (navigator.vibrate) navigator.vibrate(50); navigator.clipboard.writeText(url).then(() => alert("Lien copié !")); };
window.addToHistory = (id, n, i, u) => { viewedProducts = viewedProducts.filter(p => p.id !== id); viewedProducts.unshift({ id, name: n, img: i, url: u }); if(viewedProducts.length > 10) viewedProducts.pop(); localStorage.setItem('em_history', JSON.stringify(viewedProducts)); };
function renderHistory() { const c = document.getElementById('history-container'); const s = document.getElementById('history-section'); if(!c || !s || viewedProducts.length===0) return; s.style.display = 'block'; c.innerHTML = ''; viewedProducts.forEach(p => c.innerHTML += `<a href="${p.url}/index.html?id=${p.id}" class="history-card"><img src="${p.img}"><div style="font-size:0.7rem;">${p.name}</div></a>`); }
