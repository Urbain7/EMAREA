/* =============================== */
/* LOGIQUE DE LA CARTE (LEAFLET)   */
/* =============================== */

let map;
let allShops = [];

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Récupérer les boutiques
    const res = await fetch('shops.json');
    allShops = await res.json();
    
    initMap();
    renderDistanceList(null); // Liste vide au début
});

function initMap() {
    // Centrer sur Lomé par défaut
    map = L.map('map').setView([6.172, 1.23], 12);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    // Ajouter les marqueurs des boutiques
    allShops.forEach(shop => {
        if(shop.lat && shop.lng) {
            const popup = `<b>${shop.name}</b><br>${shop.location}<br><a href="${shop.url}" target="_blank">Visiter</a>`;
            L.marker([shop.lat, shop.lng]).addTo(map).bindPopup(popup);
        }
    });
}

// Fonction appelée par le bouton "Autour de moi"
window.locateUser = () => {
    if (!navigator.geolocation) {
        alert("La géolocalisation n'est pas supportée par votre navigateur.");
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const userLat = position.coords.latitude;
            const userLng = position.coords.longitude;
            
            // Zoom sur l'utilisateur
            map.setView([userLat, userLng], 14);
            
            // Marqueur Utilisateur (Rouge)
            L.marker([userLat, userLng], {icon: redIcon()}).addTo(map).bindPopup("Vous êtes ici").openPopup();
            
            // Calcul des distances
            calculateDistances(userLat, userLng);
        },
        () => {
            alert("Impossible de vous localiser. Vérifiez vos paramètres GPS.");
        }
    );
};

function calculateDistances(lat, lng) {
    // Formule de Haversine pour la distance
    allShops.forEach(shop => {
        if(shop.lat) {
            shop.distance = getDistanceFromLatLonInKm(lat, lng, shop.lat, shop.lng);
        } else {
            shop.distance = 9999; // Loin (Boutique en ligne)
        }
    });

    // Trier du plus proche au plus loin
    allShops.sort((a, b) => a.distance - b.distance);

    renderDistanceList(true);
}

function renderDistanceList(hasLocation) {
    const container = document.getElementById('distance-list');
    container.innerHTML = '';

    if(!hasLocation) {
        container.innerHTML = '<p style="text-align:center;color:#888;">Cliquez sur "Autour de moi" pour voir les distances.</p>';
        return;
    }

    allShops.forEach(shop => {
        // Si distance infinie (boutique en ligne), on ne l'affiche pas dans le tri kilométrique
        if(shop.distance < 9000) {
            container.innerHTML += `
                <div class="distance-item">
                    <img src="${shop.logo}" style="width:40px; height:40px; border-radius:50%; margin-right:10px;">
                    <div>
                        <div style="font-weight:bold;">${shop.name}</div>
                        <div style="font-size:0.8rem; color:#666;">${shop.location}</div>
                    </div>
                    <div class="dist-val">${shop.distance.toFixed(1)} km</div>
                </div>
            `;
        }
    });
}

// Maths (Haversine)
function getDistanceFromLatLonInKm(lat1,lon1,lat2,lon2) {
  var R = 6371; // Rayon de la terre en km
  var dLat = deg2rad(lat2-lat1); 
  var dLon = deg2rad(lon2-lon1); 
  var a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2); 
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c; 
}
function deg2rad(deg) { return deg * (Math.PI/180) }

// Petite icône rouge pour l'user
function redIcon() {
    return new L.Icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
    });
}
