/* --- START OF FILE js/map.js --- */

let map;
let allShops = [];
let userPos = null;
let routingControl = null;

// Icônes personnalisées
const iconUser = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

const iconShop = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

document.addEventListener('DOMContentLoaded', async () => {
    // Chargement des données
    try {
        const res = await fetch('shops.json');
        allShops = await res.json();
        initMap();
    } catch (e) {
        console.error("Erreur chargement map:", e);
    }
});

function initMap() {
    // 1. Initialisation centrée sur Lomé
    map = L.map('map').setView([6.172, 1.23], 13);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap | EM AREA'
    }).addTo(map);

    // 2. IDÉE 5.4 : HEATMAP (Zones Chaudes)
    // On simule des zones d'activité intense (ex: Grand Marché, Déckon)
    const hotZones = [
        { lat: 6.1328, lng: 1.2246, radius: 800 }, // Zone Déckon
        { lat: 6.1866, lng: 1.1884, radius: 600 }  // Zone Agoè
    ];

    hotZones.forEach(zone => {
        L.circle([zone.lat, zone.lng], {
            color: 'red',
            fillColor: '#f03',
            fillOpacity: 0.1, // Très léger pour ne pas gêner
            radius: zone.radius,
            stroke: false
        }).addTo(map);
    });

    // 3. Placement des boutiques
    allShops.forEach(shop => {
        if(shop.lat && shop.lng) {
            // IDÉE 2 (Carte) : Photo de devanture dans la Popup
            // On utilise une image placeholder si pas de photo définie
            const shopImg = shop.cover || "https://via.placeholder.com/300x150?text=Façade+Boutique";
            
            const popupContent = `
                <div style="text-align:center; min-width:200px;">
                    <img src="${shopImg}" style="width:100%; height:100px; object-fit:cover; border-radius:8px; margin-bottom:5px;">
                    <h3 style="margin:0; font-size:1rem;">${shop.name}</h3>
                    <p style="margin:5px 0; font-size:0.8rem; color:#666;">${shop.location}</p>
                    ${shop.verified ? '<span style="color:#2ecc71; font-weight:bold; font-size:0.7rem;">✓ Vérifié</span>' : ''}
                    <br>
                    <button onclick="drawRoute(${shop.lat}, ${shop.lng})" 
                        style="background:#FF9F1C; color:white; border:none; padding:8px 15px; border-radius:20px; margin-top:8px; cursor:pointer; font-weight:bold;">
                        🏍️ Y aller
                    </button>
                </div>
            `;
            
            L.marker([shop.lat, shop.lng], {icon: iconShop})
             .addTo(map)
             .bindPopup(popupContent);
        }
    });

    // 4. IDÉE 5.5 : BOUTON BOUSSOLE / RADAR
    addCompassControl();
}

// Fonction GPS Utilisateur
window.locateUser = () => {
    if (!navigator.geolocation) return alert("GPS non supporté");

    const btn = document.querySelector('.btn-primary');
    btn.textContent = "⏳ Localisation...";

    navigator.geolocation.getCurrentPosition(
        (position) => {
            userPos = [position.coords.latitude, position.coords.longitude];
            
            // Zoom sur l'utilisateur
            map.setView(userPos, 14);
            L.marker(userPos, {icon: iconUser}).addTo(map).bindPopup("<b>Vous êtes ici</b>").openPopup();
            
            btn.textContent = "📍 Ma Position (Mise à jour)";
            
            // Calculer les distances et Prix Zem
            renderDistanceList(userPos);
        },
        () => {
            alert("Impossible de vous localiser. Vérifiez votre GPS.");
            btn.textContent = "📍 Activer mon GPS";
        },
        { enableHighAccuracy: true }
    );
};

// Fonction Tracé Itinéraire
window.drawRoute = (destLat, destLng) => {
    if (!userPos) {
        // Si on ne sait pas où est l'utilisateur, on essaie de le localiser d'abord
        locateUser();
        setTimeout(() => {
            if(userPos) drawRoute(destLat, destLng);
        }, 2000);
        return;
    }

    // Nettoyage ancien tracé
    if (routingControl) {
        map.removeControl(routingControl);
    }

    // Création du tracé (Routing Machine)
    if (typeof L.Routing !== 'undefined') {
        routingControl = L.Routing.control({
            waypoints: [
                L.latLng(userPos[0], userPos[1]),
                L.latLng(destLat, destLng)
            ],
            routeWhileDragging: false,
            show: false, // Cache les instructions textuelles (moches)
            lineOptions: {
                styles: [{color: '#2EC4B6', opacity: 0.8, weight: 6}] // Ligne Turquoise
            },
            createMarker: function() { return null; } // Pas de nouveaux marqueurs
        }).addTo(map);
        
        // Ferme la popup pour voir le chemin
        map.closePopup();
    } else {
        alert("Erreur: Module de carte non chargé.");
    }
};

// Calcul des distances et Prix Zem (Idée 1 Carte)
function renderDistanceList(user) {
    const list = document.getElementById('distance-list');
    list.innerHTML = '';
    
    // Calcul distances
    allShops.forEach(s => {
        if(s.lat) s.dist = getDist(user[0], user[1], s.lat, s.lng);
        else s.dist = 9999;
    });
    
    // Tri du plus proche au plus loin
    allShops.sort((a,b) => a.dist - b.dist);

    allShops.forEach(s => {
        if(s.dist < 50) { // Rayon max 50km
            // Formule Prix Zem : Base 150F + 75F/km (Arrondi à 50F près)
            let priceZem = 150 + (s.dist * 75);
            priceZem = Math.ceil(priceZem / 50) * 50; 
            if(priceZem < 200) priceZem = 200; // Minimum syndical

            list.innerHTML += `
                <div class="distance-item" onclick="map.setView([${s.lat}, ${s.lng}], 16)">
                    <img src="${s.logo}" style="width:40px;height:40px;border-radius:50%;margin-right:10px;border:1px solid #eee;">
                    <div style="flex:1;">
                        <div style="font-weight:bold">${s.name}</div>
                        <div style="font-size:0.7rem; color:#666;">${s.location}</div>
                        <div style="font-size:0.7rem; color:#e67e22; font-weight:bold;">🏍️ Zem: env. ${priceZem} F</div>
                    </div>
                    <div class="dist-val">${s.dist.toFixed(1)} km</div>
                </div>`;
        }
    });
}

// Ajout du contrôle Boussole (Idée 5.5)
function addCompassControl() {
    const CompassControl = L.Control.extend({
        options: { position: 'topright' },
        onAdd: function (map) {
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control compass-ctrl');
            container.innerHTML = '🧭';
            container.style.backgroundColor = 'white';
            container.style.width = '35px';
            container.style.height = '35px';
            container.style.lineHeight = '35px';
            container.style.textAlign = 'center';
            container.style.cursor = 'pointer';
            container.style.fontSize = '20px';
            container.title = "Recentrer / Nord";
            
            container.onclick = function(){
                map.setBearing(0); // Nécessite plugin rotate, sinon fait juste un reset vue
                if(userPos) map.setView(userPos, 14);
                else map.setView([6.172, 1.23], 13);
            }
            return container;
        }
    });
    map.addControl(new CompassControl());
}

// Formule mathématique distance (Haversine)
function getDist(lat1,lon1,lat2,lon2) {
  var R = 6371; // Rayon terre km
  var dLat = (lat2-lat1)*(Math.PI/180); 
  var dLon = (lon2-lon1)*(Math.PI/180); 
  var a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1*(Math.PI/180))*Math.cos(lat2*(Math.PI/180))*Math.sin(dLon/2)*Math.sin(dLon/2); 
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))); 
}
