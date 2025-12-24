/* --- START OF FILE js/map.js --- */

let map = null;
let allShops = [];
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

// --- 1. DÉMARRAGE ---
// On attend que la page soit prê pour lancer la carte (La méthode qui a marché !)
window.onload = function() {
    if(document.getElementById('map')) {
        initMap();
        loadShops();
    }
};

function initMap() {
    if (map !== null) map.remove();

    map = L.map('map').setView([6.172, 1.23], 13);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: 'EM AREA',
        maxZoom: 19
    }).addTo(map);

    // Heatmap (Zones rouges)
    const hotZones = [{ lat: 6.1328, lng: 1.2246, r: 800 }, { lat: 6.1866, lng: 1.1884, r: 600 }];
    hotZones.forEach(z => {
        L.circle([z.lat, z.lng], { color: 'red', fillColor: '#f03', fillOpacity: 0.1, radius: z.r, stroke: false }).addTo(map);
    });

    // Boussole
    addCompass();
    
    // Force l'affichage correct
    setTimeout(() => { map.invalidateSize(); }, 500);
}

// --- 2. DONNÉES ---
async function loadShops() {
    try {
        // Chargement du vrai fichier shops.json
        const res = await fetch('shops.json');
        if(!res.ok) throw new Error("Erreur JSON");
        allShops = await res.json();
        
        allShops.forEach(shop => {
            if(shop.lat && shop.lng) {
                const img = shop.cover || "https://via.placeholder.com/300x150?text=Boutique";
                const popupHTML = `
                    <div style="text-align:center; min-width:200px;">
                        <img src="${img}" style="width:100%;height:100px;object-fit:cover;border-radius:8px;margin-bottom:5px;">
                        <h3 style="margin:0;font-size:1rem;color:#333;">${shop.name}</h3>
                        <p style="margin:5px 0;font-size:0.8rem;color:#666;">${shop.location}</p>
                        <button onclick="drawRoute(${shop.lat}, ${shop.lng})" 
                            style="background:#FF9F1C;color:white;border:none;padding:8px 15px;border-radius:20px;margin-top:8px;cursor:pointer;">
                            🏍️ Y aller
                        </button>
                    </div>`;
                
                L.marker([shop.lat, shop.lng], {icon: iconShop}).addTo(map).bindPopup(popupHTML);
            }
        });

        // Si l'utilisateur est déjà localisé, on met à jour la liste
        if(userPos) updateListWithTime(userPos);

    } catch (e) {
        console.error("Erreur chargement boutiques", e);
    }
}

// --- 3. GPS & ITINÉRAIRE ---
window.locateUser = function() {
    if (!navigator.geolocation) return alert("GPS non dispo");
    const btn = document.querySelector('.btn-primary');
    if(btn) btn.textContent = "⏳ Recherche...";

    navigator.geolocation.getCurrentPosition(
        (pos) => {
            userPos = [pos.coords.latitude, pos.coords.longitude];
            
            map.setView(userPos, 14);
            L.marker(userPos, {icon: iconUser}).addTo(map).bindPopup("Vous").openPopup();
            
            if(btn) btn.textContent = "📍 Position trouvée";
            
            updateListWithTime(userPos);
        },
        () => {
            alert("Veuillez autoriser le GPS.");
            if(btn) btn.textContent = "📍 Activer";
        },
        { enableHighAccuracy: true }
    );
};

window.drawRoute = function(lat, lng) {
    if (!userPos) {
        locateUser();
        setTimeout(() => { if(userPos) drawRoute(lat, lng); }, 2500);
        return;
    }
    if (routingControl) map.removeControl(routingControl);

    if (typeof L.Routing !== 'undefined') {
        routingControl = L.Routing.control({
            waypoints: [L.latLng(userPos[0], userPos[1]), L.latLng(lat, lng)],
            routeWhileDragging: false,
            show: false,
            lineOptions: { styles: [{color: '#2EC4B6', opacity: 0.8, weight: 6}] },
            createMarker: function() { return null; }
        }).addTo(map);
        map.closePopup();
    }
};

// --- 4. LISTE AVEC TEMPS MOTO ---
function updateListWithTime(user) {
    const list = document.getElementById('distance-list');
    if(!list) return;
    list.innerHTML = '';
    
    allShops.forEach(s => { s.dist = s.lat ? getDist(user[0], user[1], s.lat, s.lng) : 9999; });
    allShops.sort((a,b) => a.dist - b.dist);

    allShops.forEach(s => {
        if(s.dist < 50) {
            // CALCUL MOTO (30 km/h)
            let minutes = Math.round((s.dist / 30) * 60);
            if(minutes < 1) minutes = 1;
            
            let timeTxt = `${minutes} min`;
            if(minutes >= 60) {
                timeTxt = `${Math.floor(minutes/60)}h ${minutes%60}min`;
            }

            list.innerHTML += `
                <div class="distance-item" onclick="window.scrollTo(0,0); map.setView([${s.lat}, ${s.lng}], 16);">
                    <img src="${s.logo}" style="width:40px;height:40px;border-radius:50%;margin-right:10px;object-fit:cover;border:1px solid #eee;">
                    <div style="flex:1;">
                        <div style="font-weight:bold">${s.name}</div>
                        <div style="font-size:0.7rem;color:#666;">${s.location}</div>
                        <div style="font-size:0.75rem;color:#27ae60;font-weight:bold;">
                            ⏱️ Env. ${timeTxt} (Moto)
                        </div>
                    </div>
                    <div class="dist-val">${s.dist.toFixed(1)} km</div>
                </div>`;
        }
    });
}

function addCompass() {
    const Compass = L.Control.extend({
        options: { position: 'topright' },
        onAdd: function (map) {
            const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
            div.innerHTML = '🧭';
            div.style.cssText = 'background:white;width:35px;height:35px;line-height:35px;text-align:center;font-size:20px;cursor:pointer;';
            div.onclick = () => map.setView(userPos || [6.172, 1.23], 13);
            return div;
        }
    });
    map.addControl(new Compass());
}

function getDist(lat1,lon1,lat2,lon2) {
  var R = 6371, dLat = (lat2-lat1)*(Math.PI/180), dLon = (lon2-lon1)*(Math.PI/180); 
  var a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1*(Math.PI/180))*Math.cos(lat2*(Math.PI/180))*Math.sin(dLon/2)*Math.sin(dLon/2); 
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))); 
}
