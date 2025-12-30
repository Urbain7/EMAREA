/* =============================== */
/* MOTEUR EM AREA V18.0 (FINAL)    */
/* =============================== */

let allProducts = [];
let allShops = [];
let viewedProducts = JSON.parse(localStorage.getItem('em_history')) || [];
let cart = JSON.parse(localStorage.getItem('em_cart')) || []; // PANIER

// --- 1. DÉMARRAGE & ROUTING ---
document.addEventListener('DOMContentLoaded', () => {
    checkDarkMode();
    updateCartCount(); // Affiche le badge panier

    // Splash Screen (Disparition)
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        if(splash) {
            splash.style.opacity = '0';
            setTimeout(() => splash.style.visibility = 'hidden', 500);
        }
    }, 1500);

    initPullToRefresh();

    // DÉTECTION DE LA PAGE
    if(document.getElementById('products-container')) {
        // --- PAGE ACCUEIL ---
        initApp();
        renderHistory();
        if(document.getElementById('market-home-container')) loadHomeMarket();
    } 
    else if(document.getElementById('jobs-container')) {
        // --- PAGE JOBS ---
        showSkeletonLoader();
        loadJobs();
    }
    else if(document.getElementById('distance-list') && !document.getElementById('map')) {
        // --- PAGE CARTE (Liste seule) ---
        showSkeletonLoader();
    }
    else if(document.getElementById('shops-container')) {
        // --- PAGE SECONDAIRE ---
        showSkeletonLoader();
        loadShopsOnly();
    }
});

// --- 2. LOGIQUE PANIER ---
function addToCart(id, name, price, img, shop) {
    // Vérifie doublon
    const exists = cart.find(item => item.id === id);
    if(exists) return showToast("Déjà dans le panier !", "error");

    cart.push({ id, name, price, img, shop });
    localStorage.setItem('em_cart', JSON.stringify(cart));
    updateCartCount();
    
    if(navigator.vibrate) navigator.vibrate(50);
    showToast("Ajouté au panier !");
}

function removeFromCart(index) {
    cart.splice(index, 1);
    localStorage.setItem('em_cart', JSON.stringify(cart));
    updateCartCount();
    renderCart(); // Rafraîchit la modale
}

function updateCartCount() {
    const badge = document.getElementById('cart-count');
    if(badge) {
        badge.innerText = cart.length;
        badge.style.display = cart.length > 0 ? 'flex' : 'none';
    }
}

// Modale Panier
function openCartModal() {
    document.getElementById('cart-modal').classList.add('active');
    renderCart();
}
function closeCartModal() { document.getElementById('cart-modal').classList.remove('active'); }

function renderCart() {
    const container = document.getElementById('cart-items');
    const totalEl = document.getElementById('cart-total');
    container.innerHTML = '';
    
    if(cart.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:30px; color:#999;">Votre panier est vide 😢</div>';
        totalEl.innerText = "0 F";
        return;
    }

    let total = 0;
    cart.forEach((item, index) => {
        total += Number(item.price);
        container.innerHTML += `
            <div class="cart-item" style="display:flex; gap:10px; align-items:center; padding:10px 0; border-bottom:1px dashed #eee;">
                <img src="${item.img}" style="width:50px; height:50px; border-radius:8px; object-fit:cover;" onerror="this.src='https://via.placeholder.com/50'">
                <div style="flex:1;">
                    <div style="font-size:0.9rem; font-weight:bold;">${item.name}</div>
                    <div style="font-size:0.7rem; color:#888;">${item.shop}</div>
                    <div style="color:var(--primary); font-weight:bold;">${Number(item.price).toLocaleString()} F</div>
                </div>
                <div onclick="removeFromCart(${index})" style="color:#e74c3c; cursor:pointer; padding:5px;"><i class="fas fa-trash"></i></div>
            </div>`;
    });
    totalEl.innerText = total.toLocaleString() + " F";
}

function sendCartOrder() {
    if(cart.length === 0) return;
    
    const adminNumber = "22890000000"; // TON NUMÉRO ICI
    
    let msg = "*NOUVELLE COMMANDE GROUPÉE* 🛒\n------------------\n";
    let total = 0;
    
    cart.forEach(item => {
        msg += `- ${item.name} (${item.price}F)\n  @ ${item.shop}\n`;
        total += Number(item.price);
    });
    
    msg += `------------------\n💰 *TOTAL ESTIMÉ : ${total.toLocaleString()} F*`;
    
    const url = `https://wa.me/${adminNumber}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
}

// --- 3. MOTEUR APP PRINCIPAL ---
async function initApp() {
    showSkeletonLoader();

    try {
        // 1. Charger les boutiques
        const res = await fetch('shops.json');
        if (!res.ok) throw new Error("Erreur Shops");
        allShops = await res.json();
        
        // 2. TRI PAR POPULARITÉ (EM SCORE)
        allShops.forEach(shop => {
            let score = 0;
            if(shop.boost_level) score += (shop.boost_level * 1000);
            if(shop.verified) score += 500;
            score += Math.random() * 10;
            shop.em_score = score;
        });
        allShops.sort((a, b) => b.em_score - a.em_score);

        // Affiche les boutiques (en bas de page maintenant)
        renderShops();
        
        // 3. Charger les produits de TOUTES les boutiques
        const promises = allShops.map(shop => fetchShopProducts(shop));
        const results = await Promise.allSettled(promises);
        
        allProducts = [];
        results.forEach(r => { if(r.status === 'fulfilled') allProducts.push(...r.value); });
        
        // Mélange pour la variété
        allProducts.sort(() => 0.5 - Math.random());

        // Nettoyage loader
        const pContainer = document.getElementById('products-container');
        if(pContainer) pContainer.innerHTML = ''; 
        
        // 4. AFFICHER
        // Marquee (Défilement en haut - prend 12 produits)
        renderMarquee(allProducts.slice(0, 12)); 
        
        // Grille principale
        renderProducts(allProducts);
        
        setupSearch();

    } catch (e) {
        console.error(e);
        const pContainer = document.getElementById('products-container');
        if(pContainer) pContainer.innerHTML = `<div style="text-align:center; padding:20px;">Erreur connexion au marché.</div>`;
    }
}

// Récupération intelligente des produits distants
async function fetchShopProducts(shop) {
    if (shop.url === '#' || !shop.url) return [];
    try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 5000); // 5 sec max
        // Gestion du slash final
        const jsonUrl = shop.url.endsWith('/') ? `${shop.url}data/produits.json` : `${shop.url}/data/produits.json`;
        
        const res = await fetch(jsonUrl, { signal: controller.signal });
        clearTimeout(id);
        
        if(!res.ok) return [];
        const data = await res.json();
        const items = data.items ? data.items : data;
        
        return items.map(p => {
            // CORRECTION DES CHEMINS D'IMAGES
            let imgSrc = p.image;
            if (imgSrc && !imgSrc.startsWith('http')) {
                if (imgSrc.startsWith('/')) imgSrc = imgSrc.substring(1);
                const baseUrl = shop.url.endsWith('/') ? shop.url : `${shop.url}/`;
                imgSrc = baseUrl + imgSrc;
            }
            
            return {
                id: p.id,
                nom: p.nom,
                prix: p.prix,
                prix_original: p.prix_original,
                image: imgSrc,
                shopName: shop.name,
                shopUrl: shop.url, // URL de base pour les liens
                isVerified: shop.verified,
                is_star: p.is_star
            };
        });
    } catch { return []; }
}

// --- 4. RENDU VISUEL ---

// Marquee (Défilement)
function renderMarquee(items) {
    const container = document.getElementById('marquee-container');
    if(!container) return;
    
    let html = '';
    const loopItems = [...items, ...items]; // Doublon pour boucle infinie
    
    loopItems.forEach(p => {
        const targetUrl = `${p.shopUrl}/index.html?id=${p.id}`;
        html += `
            <a href="${targetUrl}" class="marquee-card" target="_blank">
                <img src="${p.image}" class="marquee-img" onerror="this.src='https://via.placeholder.com/100'">
                <div style="font-size:0.75rem; font-weight:bold; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${p.nom}</div>
                <div style="color:var(--primary); font-size:0.8rem; font-weight:800;">${Number(p.prix).toLocaleString()} F</div>
            </a>`;
    });
    container.innerHTML = html;
}

// Grille Produits
function renderProducts(items) {
    const container = document.getElementById('products-container');
    if(!container) return;
    container.innerHTML = '';
    
    if(items.length === 0) {
        container.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:20px; color:#999;">Aucun produit trouvé.</div>';
        return;
    }

    items.slice(0, 40).forEach(p => {
        const price = Number(p.prix).toLocaleString() + ' F';
        const targetUrl = `${p.shopUrl}/index.html?id=${p.id}`;
        
        let badge = p.isVerified ? '<span style="position:absolute;top:5px;left:5px;background:#2980b9;color:white;font-size:0.6rem;padding:2px 6px;border-radius:4px;z-index:2;">VÉRIFIÉ</span>' : '';
        if(p.prix_original > p.prix) badge = '<span style="position:absolute;top:5px;left:5px;background:#e74c3c;color:white;font-size:0.6rem;padding:2px 6px;border-radius:4px;z-index:2;animation:heartBeat 2s infinite;">PROMO</span>';

        container.innerHTML += `
            <div class="product-card" data-aos="fade-up">
                ${badge}
                
                <!-- BOUTON AJOUT PANIER -->
                <button class="btn-copy" style="background:var(--primary); color:white; border:none;" 
                        onclick="addToCart('${p.id}', '${p.nom.replace(/'/g, "\\'")}', '${p.prix}', '${p.image}', '${p.shopName.replace(/'/g, "\\'")}')">
                    <i class="fas fa-plus"></i>
                </button>
                
                <a href="${targetUrl}" target="_blank">
                    <img src="${p.image}" class="product-img" loading="lazy" onerror="this.src='https://via.placeholder.com/150'">
                </a>
                <div class="product-info">
                    <div class="product-shop">${p.shopName}</div>
                    <div class="product-title">${p.nom}</div>
                    <div class="product-price">${price}</div>
                </div>
            </div>`;
    });
}

// Boutiques (En bas)
function renderShops() {
    const c = document.getElementById('shops-container');
    if(c) {
        c.innerHTML = '';
        const currentTheme = localStorage.getItem('em_theme') || 'light';
        
        allShops.forEach(s => {
            const separator = s.url.includes('?') ? '&' : '?';
            const linkWithTheme = `${s.url}${separator}theme=${currentTheme}`;
            
            let sponsorBadge = s.boost_level > 0 ? `<div class="badge-sponsored">SPONSORISÉ</div>` : '';
            let verifyBadge = s.verified ? `<div class="badge-verified">VÉRIFIÉ</div>` : '';
            const imgStyle = s.boost_level > 0 ? "border: 2px solid #FFD700;" : "";

            c.innerHTML += `
            <a href="${linkWithTheme}" class="shop-card" target="_blank">
                <div style="position:relative;">
                    <img src="${s.logo}" class="shop-logo" style="${imgStyle}" onerror="this.src='https://via.placeholder.com/70'">
                    ${sponsorBadge}
                </div>
                <div class="shop-name">${s.name}</div>
                ${verifyBadge}
            </a>`;
        });
    }
}

// --- 5. FILTRES & RECHERCHE ---
function setupSearch() {
    const input = document.getElementById('search-input');
    const clearBtn = document.getElementById('search-clear');
    if(!input) return;
    input.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        if(clearBtn) clearBtn.style.display = term ? 'block' : 'none';
        const f = allProducts.filter(p => p.nom.toLowerCase().includes(term));
        renderProducts(f);
    });
}
window.clearSearch = function() { const i=document.getElementById('search-input'); if(i){i.value=''; i.dispatchEvent(new Event('input'));} };

window.filterProducts = function(type, btn) {
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');

    let filtered = [];
    if(type === 'all') filtered = allProducts;
    else if(type === 'verified') filtered = allProducts.filter(p => p.isVerified);
    else if(type === 'promo') filtered = allProducts.filter(p => p.prix_original && p.prix_original > p.prix);
    
    renderProducts(filtered);
};

// --- 6. AUTRES PAGES (Jobs, Market) ---
function loadJobs() {
    const container = document.getElementById('jobs-container');
    if(!container) return;
    
    const colors = ['#ffebee', '#e3f2fd', '#e8f5e9', '#fff3e0', '#f3e5f5', '#e0f2f1'];
    const textColors = ['#c62828', '#1565c0', '#2e7d32', '#ef6c00', '#6a1b9a', '#00695c'];

    fetch('jobs.json').then(res => res.json()).then(jobs => {
        container.innerHTML = ''; 
        if(jobs.length === 0) { container.innerHTML = '<div style="text-align:center; padding:20px;">Aucune offre.</div>'; return; }
        
        jobs.forEach((job, index) => {
            const msg = `Bonjour, je souhaite postuler pour l'offre *${job.title}* chez ${job.company}.`;
            const waLink = `https://wa.me/${job.whatsapp}?text=${encodeURIComponent(msg)}`;
            const initial = job.company.charAt(0).toUpperCase();
            const colorIndex = index % colors.length;
            const bgStyle = `background:${colors[colorIndex]}; color:${textColors[colorIndex]};`;

            container.innerHTML += `
            <div class="job-card" data-aos="fade-up">
                <div class="job-header">
                    <div class="job-avatar" style="${bgStyle}">${initial}</div>
                    <div class="job-main-info"><h3>${job.title}</h3><div class="job-company"><span>🏢 ${job.company}</span><span>📍 ${job.location}</span></div></div>
                </div>
                <div class="job-tags-row"><span class="job-pill highlight">${job.tag}</span><span class="job-pill">📅 ${job.date}</span></div>
                <p class="job-desc">${job.desc}</p>
                <div class="job-footer"><span class="job-salary">${job.salary}</span><a href="${waLink}" class="btn btn-primary" style="font-size:0.8rem; padding:8px 20px;">Postuler </a></div>
            </div>`;
        });
    }).catch(e => container.innerHTML = '<div style="text-align:center; color:red;">Erreur chargement.</div>');
}

function loadHomeMarket() {
    const container = document.getElementById('market-home-container');
    if(!container) return;
    fetch('market.json').then(res => res.json()).then(ads => {
        container.innerHTML = '';
        if(ads.length === 0) { container.innerHTML = '<div style="font-size:0.8rem; padding:10px;">Aucune occasion.</div>'; return; }
        ads.forEach(ad => {
            const prix = Number(ad.prix).toLocaleString() + ' F';
            const msg = `Bonjour ${ad.vendeur}, je suis intéressé par votre annonce *${ad.titre}* vue sur EM AREA.`;
            const waLink = `https://wa.me/${ad.tel}?text=${encodeURIComponent(msg)}`;
            container.innerHTML += `<div class="promo-card" style="min-width: 240px; border-color:#eee; box-shadow:none; background:var(--white);"><img src="${ad.image}" style="width:70px; height:70px; object-fit:cover; border-radius:8px;" onerror="this.src='https://via.placeholder.com/70'"><div class="promo-info"><div style="font-size:0.65rem; color:#888; text-transform:uppercase;">Vendeur : <b>${ad.vendeur}</b></div><div class="promo-title" style="margin:2px 0;">${ad.titre}</div><div class="promo-price" style="color:#27ae60;">${prix}</div><a href="${waLink}" class="btn btn-outline" style="width:100%; margin-top:5px; padding:4px; font-size:0.75rem; border-color:#27ae60; color:#27ae60;">Contacter </a></div></div>`;
        });
    }).catch(e => { container.innerHTML = ''; });
}

// --- 7. UTILS ---
function showToast(message, type='success') {
    let toast = document.getElementById("toast-notification");
    if (!toast) return alert(message);
    const msgEl = toast.querySelector('.toast-message');
    const iconEl = toast.querySelector('.toast-icon');
    msgEl.textContent = message;
    if(type==='error'){ iconEl.textContent='⚠️'; toast.style.background='rgba(220,53,69,0.95)'; }
    else { iconEl.textContent=' '; toast.style.background='rgba(30,30,30,0.95)'; }
    toast.className = "toast show";
    setTimeout(() => { toast.className = toast.className.replace("show", ""); setTimeout(()=>toast.style.background="",300); }, 3000);
}

function toggleDarkMode() { document.body.classList.toggle('dark-mode'); localStorage.setItem('em_theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light'); }
function checkDarkMode() { if(localStorage.getItem('em_theme') === 'dark') document.body.classList.add('dark-mode'); }
window.vibratePhone = () => { if (navigator.vibrate) navigator.vibrate(50); };
window.copyLink = (url) => { navigator.clipboard.writeText(url).then(() => showToast("Lien copié !")); };
window.addToHistory = (id, n, i, u) => {
    viewedProducts = viewedProducts.filter(p => p.id !== id);
    viewedProducts.unshift({ id, name: n, img: i, url: u });
    if(viewedProducts.length > 10) viewedProducts.pop();
    localStorage.setItem('em_history', JSON.stringify(viewedProducts));
};
function renderHistory() {
    const c = document.getElementById('history-container');
    const s = document.getElementById('history-section');
    if(!c || !s || viewedProducts.length===0) return;
    s.style.display = 'block'; c.innerHTML = '';
    viewedProducts.forEach(p => c.innerHTML += `<a href="${p.url}/index.html?id=${p.id}" class="history-card"><img src="${p.img}"><div style="font-size:0.7rem;">${p.name}</div></a>`);
}

function showSkeletonLoader() {
    const shopC = document.getElementById('shops-container');
    if(shopC) { shopC.innerHTML = ''; for(let i=0;i<5;i++) shopC.innerHTML += `<div class="skeleton-shop-wrapper"><div class="skeleton-shop-circle"></div><div class="skeleton-shop-text"></div></div>`; }
    const marquee = document.getElementById('marquee-container');
    if(marquee) marquee.innerHTML = '<div style="padding:10px;">Chargement...</div>';
    const prodC = document.getElementById('products-container');
    if(prodC) { prodC.innerHTML = ''; for(let i=0;i<4;i++) prodC.innerHTML += `<div class="skeleton-card skeleton"><div class="skeleton-img skeleton"></div><div class="skeleton-line skeleton"></div></div>`; }
    const jobC = document.getElementById('jobs-container');
    if(jobC) { jobC.innerHTML = ''; for(let i=0;i<4;i++) jobC.innerHTML += `<div class="skeleton-job"><div class="skeleton-title"></div></div>`; }
    const marketHome = document.getElementById('market-home-container');
    if(marketHome) { marketHome.innerHTML = ''; for(let i=0; i<3; i++) { marketHome.innerHTML += `<div class="skeleton-promo-card" style="min-width: 240px; border:1px solid #f0f0f0;"><div class="skeleton-promo-img" style="width:70px; height:70px;"></div><div class="skeleton-promo-content"><div class="skeleton-text-sm" style="width:40%"></div><div class="skeleton-text-lg" style="width:70%"></div><div class="skeleton-text-sm" style="width:90%"></div></div></div>`; } }
}

function initPullToRefresh() { /* Code inchangé */ }
async function loadShopsOnly() {
    try {
        const res = await fetch('shops.json');
        allShops = await res.json();
        allShops.sort((a, b) => ((b.boost_level||0)*1000 + (b.verified?500:0)) - ((a.boost_level||0)*1000 + (a.verified?500:0)));
        renderShops();
    } catch(e) {}
}
