/* --- START OF FILE js/map.js (UNIQUEMENT LA CARTE) --- */

// Variables spécifiques à la carte (PAS de conflit avec app.js)
let myMap = null; // Renommé pour éviter conflit
let mapShops = []; 
let userPos = null;
let routingControl = null;

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

// Initialisation
window.addEventListener('load', () => {
    // On lance la carte uniquement si la div existe
    if(document.getElementById('map')) {
        initMap();
        loadMapData();
    }
});

function initMap() {
    if (myMap !== null) myMap.remove();
    
    // Coordonnées Lomé
    myMap = L.map('map').setView([6.172, 1.23], 13);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: 'EM AREA',
        maxZoom: 19
    }).addTo(myMap);

    // Heatmap zones
    [{ lat: 6.1328, lng: 1.2246, r: 800 }, { lat: 6.1866, lng: 1.1884, r: 600 }].forEach(z => {
        L.circle([z.lat, z.lng], { color: 'red', fillColor: '#f03', fillOpacity: 0.1, radius: z.r, stroke: false }).addTo(myMap);
    });

    // Bouton Boussole
    addCompass();
    
    // Force l'affichage correct
    setTimeout(() => { myMap.invalidateSize(); }, 500);
}

async function loadMapData() {
    try {
        const res = await fetch('shops.json');
        mapShops = await res.json();
        
        mapShops.forEach(shop => {
            if(shop.lat && shop.lng) {
                const imgUrl = shop.logo || "https://via.placeholder.com/50";
                
                // CORRECTIF ICI : ajout de 'margin: 0 auto' et 'display: block'
                const popupHTML = `
                    <div style="text-align:center; min-width:150px;">
                        <img src="${imgUrl}" 
                             style="width:50px; height:50px; border-radius:50%; margin: 0 auto 5px auto; display:block; object-fit:cover; border:1px solid #eee;">
                        
                        <h3 style="margin:0; font-size:0.9rem;">${shop.name}</h3>
                        <p style="margin:0; font-size:0.7rem; color:#666;">${shop.location}</p>
                        
                        <button onclick="drawRoute(${shop.lat}, ${shop.lng})" 
                            style="background:#FF9F1C; color:white; border:none; padding:5px 10px; border-radius:15px; margin-top:5px; cursor:pointer;">
                            🏍️ Y aller
                        </button>
                    </div>`;
                
                L.marker([shop.lat, shop.lng], {icon: iconShop}).addTo(myMap).bindPopup(popupHTML);
            }
        });

        if(userPos) updateMapList(userPos);
    } catch (e) { console.error("Erreur Map Data:", e); }
}

// GPS Utilisateur
// GPS Utilisateur avec Animation de chargement
// GPS Utilisateur (Version Corrigée & Douce)
window.locateUser = function() {
    if (!navigator.geolocation) {
        showError("GPS non supporté", "Votre navigateur ne gère pas la géolocalisation.");
        return;
    }
    
    // 1. On récupère le bouton pour l'animer
    const btn = document.getElementById('loc-btn');
    const originalContent = btn ? btn.innerHTML : '';

    // 2. On met le bouton en mode "Recherche"
    if(btn) {
        btn.innerHTML = '<span class="spinning">⏳</span> <span>Recherche...</span>';
        btn.classList.add('btn-disabled');
    }

    // 3. On lance la recherche (avec un délai plus long : 20 secondes)
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            // --- SUCCÈS ---
            userPos = [pos.coords.latitude, pos.coords.longitude];
            myMap.setView(userPos, 15);
            
            L.marker(userPos, {icon: iconUser}).addTo(myMap)
             .bindPopup("<b>📍 Vous êtes ici</b>").openPopup();
            
            updateMapList(userPos);

            if(btn) {
                btn.innerHTML = '✅ <span>Trouvé !</span>';
                btn.classList.remove('btn-disabled');
                setTimeout(() => { btn.innerHTML = originalContent; }, 2000);
            }
        },
        (err) => {
            // --- GESTION DES ERREURS ---
            console.error(err);
            
            let titre = "Erreur GPS";
            let msg = "Impossible de vous localiser.";

            // On personnalise le message selon l'erreur
            if (err.code === 1) {
                titre = "Accès Refusé";
                msg = "Vous avez refusé la géolocalisation.\nPour l'activer, cliquez sur le cadenas 🔒 dans la barre d'adresse.";
            } else if (err.code === 2) {
                titre = "Position Indisponible";
                msg = "Votre GPS semble éteint ou ne capte pas de signal.";
            } else if (err.code === 3) {
                titre = "Trop long";
                msg = "La recherche a pris trop de temps. Réessayez.";
            }

            // On utilise NOTRE belle alerte (si disponible), sinon alert() classique
            if (typeof showCustomAlert === 'function') {
                showCustomAlert(titre, msg);
            } else {
                alert(msg);
            }
            
            // On remet le bouton normal
            if(btn) {
                btn.innerHTML = originalContent;
                btn.classList.remove('btn-disabled');
            }
        },
        { 
            enableHighAccuracy: true, 
            timeout: 20000, // On laisse 20 secondes à l'utilisateur pour cliquer
            maximumAge: 0 
        }
    );
};

// Petite fonction utilitaire pour éviter les erreurs si showCustomAlert n'est pas chargé
function showError(t, m) {
    if (typeof showCustomAlert === 'function') showCustomAlert(t, m);
    else alert(m);
}

// Itinéraire
window.drawRoute = function(lat, lng) {
    if (!userPos) {
        locateUser();
        setTimeout(() => { if(userPos) drawRoute(lat, lng); }, 2000);
        return;
    }

    if (routingControl) myMap.removeControl(routingControl);

    if (typeof L.Routing !== 'undefined') {
        routingControl = L.Routing.control({
            waypoints: [L.latLng(userPos[0], userPos[1]), L.latLng(lat, lng)],
            routeWhileDragging: false,
            show: false, // Cache les instructions textuelles
            lineOptions: { styles: [{color: '#2EC4B6', opacity: 0.8, weight: 6}] },
            createMarker: () => null
        }).addTo(myMap);
        myMap.closePopup();
    }
};

// Liste des distances
function updateMapList(user) {
    const list = document.getElementById('distance-list');
    if(!list) return;
    list.innerHTML = '';
    
    mapShops.forEach(s => { s.dist = s.lat ? getDist(user[0], user[1], s.lat, s.lng) : 9999; });
    mapShops.sort((a,b) => a.dist - b.dist);

    mapShops.forEach(s => {
        if(s.dist < 50) {
            let m = Math.round((s.dist / 30) * 60); // 30km/h moto
            if(m < 1) m = 1;
            let t = m >= 60 ? `${Math.floor(m/60)}h ${m%60}m` : `${m} min`;

            list.innerHTML += `
                <div class="distance-item" onclick="window.scrollTo(0,0); myMap.setView([${s.lat}, ${s.lng}], 16);">
                    <img src="${s.logo}" style="width:40px;height:40px;border-radius:50%;margin-right:10px;object-fit:cover;border:1px solid #eee;">
                    <div style="flex:1;">
                        <div style="font-weight:bold">${s.name}</div>
                        <div style="font-size:0.75rem;color:#27ae60;">⏱️ ${t} (Moto)</div>
                    </div>
                    <div class="dist-val">${s.dist.toFixed(1)} km</div>
                </div>`;
        }
    });
}

function addCompass() {
    const d = L.Control.extend({
        options: { position: 'topright' },
        onAdd: function (map) {
            const c = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
            c.innerHTML = '🧭';
            c.style.cssText = 'background:white;width:35px;height:35px;line-height:35px;text-align:center;font-size:20px;cursor:pointer;';
            c.onclick = () => map.setView(userPos || [6.172, 1.23], 13);
            return c;
        }
    });
    myMap.addControl(new d());
}

function getDist(lat1,lon1,lat2,lon2) {
  var R = 6371, dLat = (lat2-lat1)*(Math.PI/180), dLon = (lon2-lon1)*(Math.PI/180); 
  var a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1*(Math.PI/180))*Math.cos(lat2*(Math.PI/180))*Math.sin(dLon/2)*Math.sin(dLon/2); 
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))); 
}
