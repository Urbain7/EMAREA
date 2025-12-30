/* --- START OF FILE js/map.js (FINAL V2) --- */

let myMap = null;
let allShopsData = []; 
let userPos = null;
let routingControl = null;
let markersLayer = new L.LayerGroup(); // Groupe pour gérer les filtres

// Icônes
const iconUser = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

const iconShop = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

const iconGold = L.icon({ // Pour les boutiques boostées
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

// Initialisation
window.addEventListener('load', () => {
    if(document.getElementById('map')) {
        initMap();
        loadMapData();
    }
});

function initMap() {
    if (myMap !== null) myMap.remove();
    
    // Centré sur Lomé par défaut
    myMap = L.map('map').setView([6.172, 1.23], 13);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: 'EM AREA',
        maxZoom: 19
    }).addTo(myMap);

    markersLayer.addTo(myMap); // Calque vide pour les marqueurs

    // Bouton de recentrage
    const d = L.Control.extend({
        options: { position: 'topright' },
        onAdd: function () {
            const c = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
            c.innerHTML = '🧭';
            c.style.cssText = 'background:white;width:35px;height:35px;line-height:35px;text-align:center;font-size:20px;cursor:pointer;';
            c.onclick = () => { if(userPos) myMap.setView(userPos, 15); else locateUser(); };
            return c;
        }
    });
    myMap.addControl(new d());

    // Injecter la barre de filtres SUR la carte
    injectMapFilters();
}

function injectMapFilters() {
    // Création d'une div flottante pour les filtres
    const filterContainer = document.createElement('div');
    filterContainer.id = 'map-filters';
    filterContainer.className = 'shops-slider'; // Réutilise le style slider horizontal
    filterContainer.style.cssText = "position:absolute; top:10px; left:50px; right:10px; z-index:1000; overflow-x:auto; display:flex; gap:5px; padding-bottom:5px;";
    
    // Empêcher le clic de traverser vers la carte
    L.DomEvent.disableClickPropagation(filterContainer);
    
    document.getElementById('map').appendChild(filterContainer);
}

async function loadMapData() {
    try {
        const res = await fetch('shops.json?t=' + Date.now());
        const rawData = await res.json();
        
        // FILTRAGE : Uniquement les abonnés actifs
        allShopsData = rawData.filter(s => s.subscription === 'active');

        // Générer les boutons de filtre
        renderFilters(allShopsData);
        
        // Afficher tout par défaut
        renderMarkers(allShopsData);
        updateMapList(userPos, allShopsData);

    } catch (e) { console.error("Erreur Map Data:", e); }
}

function renderFilters(shops) {
    const container = document.getElementById('map-filters');
    if(!container) return;
    
    const categories = ['Tout', ...new Set(shops.map(s => s.category || 'Divers'))];
    
    container.innerHTML = '';
    categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.innerText = cat;
        btn.style.cssText = "border:none; background:white; padding:5px 12px; border-radius:20px; font-size:0.75rem; font-weight:600; box-shadow:0 2px 5px rgba(0,0,0,0.2); cursor:pointer; white-space:nowrap; color:#333;";
        
        if(cat === 'Tout') { btn.style.background = 'var(--dark)'; btn.style.color='white'; }

        btn.onclick = () => {
            // Visuel Actif
            Array.from(container.children).forEach(b => { b.style.background='white'; b.style.color='#333'; });
            btn.style.background = 'var(--dark)'; btn.style.color='white';
            
            // Logique Filtre
            const filtered = cat === 'Tout' ? shops : shops.filter(s => s.category === cat);
            renderMarkers(filtered);
            updateMapList(userPos, filtered);
        };
        container.appendChild(btn);
    });
}

function renderMarkers(shopsToDisplay) {
    markersLayer.clearLayers(); // On vide la carte
    
    shopsToDisplay.forEach(shop => {
        if(shop.lat && shop.lng) {
            const imgUrl = shop.logo || "https://via.placeholder.com/50";
            
            // Popup Style Alibaba
            const popupHTML = `
                <div style="text-align:center; min-width:160px;">
                    <img src="${imgUrl}" style="width:50px; height:50px; border-radius:50%; margin: 0 auto 5px auto; display:block; object-fit:cover; border:2px solid ${shop.boost_level > 0 ? '#FFD700' : '#eee'};">
                    <h3 style="margin:0; font-size:0.9rem;">${shop.name}</h3>
                    <p style="margin:0; font-size:0.7rem; color:#666;">${shop.category || 'Boutique'}</p>
                    <button onclick="drawRoute(${shop.lat}, ${shop.lng})" 
                        style="background:#FF9F1C; color:white; border:none; padding:6px 15px; border-radius:15px; margin-top:8px; cursor:pointer; font-size:0.8rem; font-weight:bold;">
                        🏍️ Y aller
                    </button>
                </div>`;
            
            // Icône Dorée si boosté
            const icon = shop.boost_level > 0 ? iconGold : iconShop;
            
            L.marker([shop.lat, shop.lng], {icon: icon})
             .addTo(markersLayer)
             .bindPopup(popupHTML);
        }
    });
}

// GPS Utilisateur
window.locateUser = function() {
    const btn = document.getElementById('loc-btn');
    if(btn) btn.innerHTML = '⏳';

    if (!navigator.geolocation) {
        alert("GPS non supporté");
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (pos) => {
            userPos = [pos.coords.latitude, pos.coords.longitude];
            myMap.setView(userPos, 15);
            
            // Supprimer ancien marker user s'il existe
            markersLayer.eachLayer(layer => {
                if(layer.options.icon === iconUser) markersLayer.removeLayer(layer);
            });

            L.marker(userPos, {icon: iconUser}).addTo(myMap)
             .bindPopup("<b>📍 Vous êtes ici</b>").openPopup();
            
            // Met à jour la liste avec les distances
            updateMapList(userPos, allShopsData); // On garde tous les shops ou filtrés ? Ici tous par défaut

            if(btn) btn.innerHTML = '📍 Ma position';
        },
        () => {
            alert("Impossible de vous localiser.");
            if(btn) btn.innerHTML = '📍 Ma position';
        },
        { enableHighAccuracy: true }
    );
};

// Itinéraire
window.drawRoute = function(lat, lng) {
    if (!userPos) {
        // Si on ne sait pas où est l'user, on le cherche d'abord
        const btn = document.getElementById('loc-btn');
        if(btn) btn.innerHTML = '⏳';
        
        navigator.geolocation.getCurrentPosition((pos) => {
            userPos = [pos.coords.latitude, pos.coords.longitude];
            L.marker(userPos, {icon: iconUser}).addTo(myMap);
            calculateRoute(userPos[0], userPos[1], lat, lng);
            if(btn) btn.innerHTML = '📍 Ma position';
        }, () => alert("Activez votre GPS pour voir l'itinéraire !"));
    } else {
        calculateRoute(userPos[0], userPos[1], lat, lng);
    }
};

function calculateRoute(lat1, lng1, lat2, lng2) {
    if (routingControl) myMap.removeControl(routingControl);

    if (typeof L.Routing !== 'undefined') {
        routingControl = L.Routing.control({
            waypoints: [L.latLng(lat1, lng1), L.latLng(lat2, lng2)],
            routeWhileDragging: false,
            show: false, // Cache les instructions textuelles
            lineOptions: { styles: [{color: '#2EC4B6', opacity: 0.8, weight: 6}] },
            createMarker: () => null
        }).addTo(myMap);
        myMap.closePopup();
    }
}

// Liste sous la carte
function updateMapList(user, shops) {
    const list = document.getElementById('distance-list');
    if(!list) return;
    list.innerHTML = '';
    
    // Calcul distance si user présent
    let displayShops = [...shops];
    if (user) {
        displayShops.forEach(s => { s.dist = s.lat ? getDist(user[0], user[1], s.lat, s.lng) : 9999; });
        displayShops.sort((a,b) => a.dist - b.dist);
    }

    displayShops.forEach(s => {
        let metaInfo = `<div style="font-size:0.75rem;color:#999;">📍 ${s.location}</div>`;
        let distInfo = '';

        if (user && s.dist < 50) {
            let m = Math.round((s.dist / 30) * 60); // Est. Moto
            let t = m >= 60 ? `${Math.floor(m/60)}h ${m%60}m` : `${m} min`;
            metaInfo = `<div style="font-size:0.75rem;color:#27ae60;">⏱️ ${t} (Moto)</div>`;
            distInfo = `<div class="dist-val">${s.dist.toFixed(1)} km</div>`;
        }

        list.innerHTML += `
            <div class="distance-item" onclick="window.scrollTo(0,0); myMap.setView([${s.lat}, ${s.lng}], 16); renderMarkers([allShopsData.find(x=>x.id==='${s.id}')]);">
                <img src="${s.logo}" style="width:40px;height:40px;border-radius:50%;margin-right:10px;object-fit:cover;border:1px solid #eee;">
                <div style="flex:1;">
                    <div style="font-weight:bold">${s.name}</div>
                    ${metaInfo}
                </div>
                ${distInfo}
            </div>`;
    });
}

function getDist(lat1,lon1,lat2,lon2) {
  var R = 6371, dLat = (lat2-lat1)*(Math.PI/180), dLon = (lon2-lon1)*(Math.PI/180); 
  var a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1*(Math.PI/180))*Math.cos(lat2*(Math.PI/180))*Math.sin(dLon/2)*Math.sin(dLon/2); 
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))); 
}
