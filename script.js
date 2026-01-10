// 1. INITIALISATION & VARIABLES GLOBALES
let currentUser = null;
let tempExistingImages = [];
let deletedImages = [];
let currentImages = [];
let currentIndex = 0;
let geocoder = null;
let tousLesMarqueurs = {}; // { id_edifice: { element, categorie } }

const categorieLabels = {
    'culte': 'Lieu de culte',
    'chateaux': 'Châteaux, palais et monuments',
    'historique': 'Sites archéologiques ou historiques',
    'panorama': 'Panorama et paysages',
    'plages': 'Plages',
    'autres': 'Autres'
};

console.log("🚀 Début script.js v2.0");

if (typeof mapboxgl === "undefined") {
    console.error("❌ mapboxgl NON CHARGÉ ! Vérifie index.html");
} else {
    console.log("✅ mapboxgl chargé");

    const roles = {
        ADMIN: "admin",
        USER: "user"
    };
    const authorizedUsers = ["admin@test.com"];
    const supabaseUrl = "https://ihqktukhfgkdorlkksaj.supabase.co";
    const supabaseKey = "sb_publishable_K_gW-qcTXs3xq1l8jbQJgg_VgihdQ7l";
    const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

    // 🗑️ SUPPRESSION FICHIER SUPABASE (extraire nom depuis URL)
    async function deleteImageFromStorage(imageUrl) {
        try {
            // Extrait le nom du fichier depuis l'URL publique
            const urlParts = imageUrl.split('/');
            const fileName = urlParts[urlParts.length - 1];

            const {
                error
            } = await supabaseClient.storage
                .from('images-edifices')
                .remove([fileName]);

            if (error) throw error;
            console.log(`✅ Fichier supprimé: ${fileName}`);
            return true;
        } catch (err) {
            console.error('❌ Erreur suppression storage:', err);
            return false;
        }
    }


    async function checkUserSession() {
        console.log("🔍 checkUserSession appelé");
        const {
            data: {
                session
            }
        } = await supabaseClient.auth.getSession();
        if (session) {
            console.log("✅ Session trouvée", session.user.id);
            currentUser = session.user;

            const {
                data: roleRows,
                error: roleError
            } = await supabaseClient
                .from('user_roles')
                .select('role')
                .eq('user_id', currentUser.id)
                .maybeSingle();

            if (!roleError && roleRows && roleRows.role) {
                currentUser.role = roleRows.role;
                console.log("✅ Rôle récupéré :", currentUser.role);
            } else {
                currentUser.role = roles.USER;
                console.log("ℹ️ Rôle par défaut USER");
            }
        } else {
            console.log("ℹ️ Pas de session");
            currentUser = null;
        }

        console.log("🎯 Appel de updateUIForRole avec", currentUser);
        updateUIForRole();
    }

    checkUserSession();

    // 2. CARTE MAPBOX
    mapboxgl.accessToken =
        "pk.eyJ1Ijoib21hcmtvdyIsImEiOiJjbWpuaDd5ejUxYmE4M2VzZDRiNjU0dWIzIn0.1MkpX6vH8AytjKHfBAwvWQ";

    const map = new mapboxgl.Map({
        container: "map-container",
        style: "mapbox://styles/mapbox/light-v11",
        center: [2.3522, 48.8566],
        zoom: 4.5,
    });

    console.log("🗺️ Map créée");

    map.on("load", () => {
        console.log("✅ Carte chargée - load event OK");

        geocoder = new MapboxGeocoder({
            accessToken: mapboxgl.accessToken,
            mapboxgl: mapboxgl,
            placeholder: "Rajouter un édifice...",
            marker: false,
        });

        geocoder.on("result", (e) => {
            if (!currentUser || currentUser.role !== roles.ADMIN) {
                alert(
                    "Vous devez être connecté en tant qu'administrateur pour ajouter un édifice."
                );
                return;
            }

            console.log("Résultat geocoder :", e.result);
            const coords = e.result.geometry.coordinates;

            ouvrirFormulaireEdition(coords[0], coords[1]);

            setTimeout(() => {
                const addrInput = document.getElementById("edit-adresse");
                if (addrInput) {
                    addrInput.value = e.result.place_name || "";
                }
            }, 100);
        });

        // if (currentUser && currentUser.role === roles.ADMIN) {
        //     map.addControl(geocoder, "top-left");
        //     console.log("✅ Geocoder visible pour l'admin");
        // } else {
        //    console.log(
        //        "🔒 Geocoder non visible (utilisateur non-admin ou déconnecté)"
        //    );
        //}

        loadEdifices();
        updateUIForRole();

        // ======== ZOOM CONTROLS ========
        const zoomInBtn = document.getElementById("zoom-in-btn");
        const zoomOutBtn = document.getElementById("zoom-out-btn");

        if (zoomInBtn) {
            zoomInBtn.addEventListener("click", () => {
                map.zoomIn();
            });
        }

        if (zoomOutBtn) {
            zoomOutBtn.addEventListener("click", () => {
                map.zoomOut();
            });
        }
        // ======== FIN ZOOM CONTROLS ========

    });

    map.on("error", (e) => {
        console.error("❌ Erreur Mapbox:", e);
    });

    // 3. CHARGEMENT & MARQUEURS
    async function loadEdifices() {
        const {
            data,
            error
        } = await supabaseClient
            .from("edifices")
            .select("*");
        if (error) {
            console.error(error);
            return;
        }

        document.querySelectorAll(".marker").forEach((m) => m.remove());
        tousLesMarqueurs = {};

        data.forEach((edifice) => {
            console.log(
                `Chargement de ${edifice.nom}, photos:`,
                edifice.images
            );
            if (edifice.lng && edifice.lat) {
                creerMarqueur({
                    ...edifice,
                    images: Array.isArray(edifice.images) ?
                        edifice.images : [],
                    coords: {
                        lng: parseFloat(edifice.lng),
                        lat: parseFloat(edifice.lat),
                    },
                });
            }
        });
    }

    function creerMarqueur(edifice) {
        const el = document.createElement('div');
        el.className = 'marker';
        el.style.cursor = 'pointer';
        const categorie = edifice.categorie || 'autres';
        el.dataset.categorie = categorie;
        el.classList.add('marker--' + categorie);

        // Fonction pour compter les superposés (appelée après tous les marqueurs créés)
        function compterSuperposes(lng, lat) {
            let count = 0;
            const tolerance = map.getZoom() < 14 ? 0.0005 : 0.0001;
            Object.values(tousLesMarqueurs).forEach(({
                element
            }) => {
                if (!element._map) return; // Marqueur non ajouté
                const markerLng = parseFloat(element._lngLat.lng.toFixed(6));
                const markerLat = parseFloat(element._lngLat.lat.toFixed(6));
                if (Math.abs(markerLng - lng) < tolerance && Math.abs(markerLat - lat) < tolerance) {
                    count++;
                }
            });
            return count;
        }

        const lng = parseFloat(edifice.lng);
        const lat = parseFloat(edifice.lat);
        if (isNaN(lng) || isNaN(lat)) {
            console.warn('Coordonnées invalides pour', edifice.nom);
            return;
        }

        const popup = new mapboxgl.Popup({
            closeButton: false,
            offset: 25
        });

        const marker = new mapboxgl.Marker(el)
            .setLngLat([lng, lat])
            .addTo(map);

        if (edifice.id != null) {
            tousLesMarqueurs[edifice.id] = {
                element: marker._element || el,
                categorie
            }; // Corrige l'assignation
        }

        el.addEventListener('mouseenter', () => {
            const nbSuperposes = compterSuperposes(lng, lat);
            const estSuperpose = nbSuperposes > 1;
            popup
                .setLngLat([lng, lat])
                .setHTML(`
        <strong>${edifice.nom}</strong>
        ${estSuperpose ? `<br><small><em>${nbSuperposes} édifices superposés. Zoomez pour les voir tous !</em></small>` : ''}
      `)
                .addTo(map);
        });

        el.addEventListener('mouseleave', () => {
            popup.remove();
        });

        el.addEventListener('click', (e) => {
            e.stopPropagation();
            console.log('Clic sur marqueur:', edifice);
            afficherDetails(edifice);
        });
    }


    // 4. STORAGE & COMPRESSION
    async function uploadImage(file) {
        if (typeof imageCompression === "undefined") {
            alert(
                "Erreur : La bibliothèque de compression n'est pas chargée !"
            );
            return null;
        }

        const options = {
            maxSizeMB: 0.3,
            maxWidthOrHeight: 1200,
            useWebWorker: true,
        };

        try {
            console.log("Compression de :", file.name);
            const compressedFile = await imageCompression(file, options);
            const fileName = `${Date.now()}_${file.name}`;

            const {
                data,
                error
            } = await supabaseClient.storage
                .from("images-edifices")
                .upload(fileName, compressedFile);

            if (error) throw error;

            const {
                data: urlData
            } = supabaseClient.storage
                .from("images-edifices")
                .getPublicUrl(fileName);

            console.log("URL générée avec succès :", urlData.publicUrl);
            return urlData.publicUrl;
        } catch (err) {
            console.error("Erreur upload/compression :", err);
            alert("Erreur lors de l'envoi de l'image : " + err.message);
            return null;
        }
    }

    function populateFormFields(edificeData) {
        if (!edificeData) {
            console.log('Pas de données à peupler (nouveau édifice)');
            return;
        }

        document.getElementById('edit-lng').value = edificeData.lng || '';
        document.getElementById('edit-lat').value = edificeData.lat || '';

        console.log('Peuplement des champs avec:', edificeData);

        const nomInput = document.getElementById('edit-nom');
        if (nomInput) nomInput.value = edificeData.nom || '';

        const addrInput = document.getElementById('edit-adresse');
        if (addrInput) addrInput.value = edificeData.adresse || '';

        const cityInput = document.getElementById('edit-city');
        if (cityInput) cityInput.value = edificeData.ville || '';

        const descInput = document.getElementById('edit-desc');
        if (descInput) descInput.value = edificeData.description || '';

        const catSelect = document.getElementById('edit-categorie');
        if (catSelect) catSelect.value = edificeData.categorie || 'autres';
    }


    // 5. GESTION DES ÉDIFICES (FORMULAIRE + PANEL)
    function ouvrirFormulaireEdition(
        lng = null,
        lat = null,
        imagesExistantes = [],
        id = null,
        edificeData = null //
    ) {
        console.log("🎯 ouvrirFormulaireEdition reçu :");
        console.log("   imagesExistantes :", imagesExistantes);
        console.log("   id :", id);

        tempExistingImages = Array.isArray(imagesExistantes) ? [...imagesExistantes] : [];
        console.log(
            "   → tempExistingImages initialisé :",
            tempExistingImages
        );

        const sidePanel = document.getElementById("side-panel");

        const finalLng =
            lng !== null && lng !== undefined ? lng : map.getCenter().lng;
        const finalLat =
            lat !== null && lat !== undefined ? lat : map.getCenter().lat;

        const isEdit = id !== null;

        document.getElementById(
            "panel-title"
        ).innerHTML = `<div style="margin-bottom: 20px;">
            <h2 style="margin: 0; font-size: 28px; font-weight: 600; color: var(--accent-color);">
                ${isEdit ? "Modifier l'édifice" : "Nouvel édifice"}
            </h2>
            <div style="width: 50px; height: 3px; background: var(--accent-color); margin-top: 8px; border-radius: 2px;"></div>
        </div>`;

        document.getElementById(
            "panel-city"
        ).innerHTML = `<div style="display: grid; gap: 20px;">
        <div>
            <label style="display: block; margin-bottom: 8px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-color); opacity: 0.7;">Nom de l'édifice</label>
            <input type="text" id="edit-nom" placeholder="Nom" class="form-input" style="width: 100%; padding: 12px 14px; border: 1px solid rgba(184, 134, 11, 0.2); border-radius: 6px; background: var(--bg-color); color: var(--text-color); font-size: 14px;">
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
                <label style="display: block; margin-bottom: 8px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-color); opacity: 0.7;">Adresse</label>
                <input type="text" id="edit-adresse" placeholder="Rue et numéro" class="form-input" style="width: 100%; padding: 12px 14px; border: 1px solid rgba(184, 134, 11, 0.2); border-radius: 6px; background: var(--bg-color); color: var(--text-color); font-size: 14px;">
            </div>
            <div>
                <label style="display: block; margin-bottom: 8px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-color); opacity: 0.7;">Ville</label>
                <input type="text" id="edit-city" placeholder="Ville" class="form-input" style="width: 100%; padding: 12px 14px; border: 1px solid rgba(184, 134, 11, 0.2); border-radius: 6px; background: var(--bg-color); color: var(--text-color); font-size: 14px;">
            </div>
            <div>
    <label style="display: block; margin-bottom: 8px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-color); opacity: 0.7;">Catégorie</label>
    <select id="edit-categorie" class="form-input" style="width: 100%; padding: 12px 14px; border: 1px solid rgba(184, 134, 11, 0.2); border-radius: 6px; background: var(--bg-color); color: var(--text-color); font-size: 14px;">
        <option value="culte">Lieu de culte</option>
        <option value="chateaux">Châteaux, palais et monuments</option>
        <option value="historique">Sites archéologiques ou historiques</option>
        <option value="panorama">Panorama et paysages</option>
        <option value="plages">Plages</option>
        <option value="autres">Autres</option>
    </select>
</div>
        </div>
        <input type="hidden" id="edit-lng" value="${finalLng}">
        <input type="hidden" id="edit-lat" value="${finalLat}">
    </div>`;

        document.getElementById(
            "panel-description"
        ).innerHTML = `<div style="margin-top: 20px;">
        <label style="display: block; margin-bottom: 8px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-color); opacity: 0.7;">Description</label>
        <textarea id="edit-desc" placeholder="Décrivez l'édifice (histoire, caractéristiques, etc.)" class="form-input" style="width: 100%; padding: 12px 14px; border: 1px solid rgba(184, 134, 11, 0.2); border-radius: 6px; background: var(--bg-color); color: var(--text-color); font-size: 14px; min-height: 100px; resize: vertical; font-family: inherit;"></textarea>
    </div>`;

        document.getElementById(
            "panel-image-container"
        ).innerHTML = `<div style="margin-top: 20px;">
        <label style="display: block; margin-bottom: 12px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-color); opacity: 0.7;">Photos</label>
        <label class="custom-file-upload" id="file-label" style="display: inline-block; padding: 12px 16px; background: rgba(184, 134, 11, 0.1); color: var(--accent-color); border: 1px dashed var(--accent-color); border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 14px;">
            Ajouter des photos
            <input type="file" id="file-upload" multiple accept="image/*" style="display:none;">
        </label>
        <div id="upload-status" style="margin-top: 8px; font-size: 12px; color: var(--accent-color); min-height: 18px;"></div>
        <div id="preview-thumbnails" style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px;"></div>
    </div>`;
        populateFormFields(edificeData);

        // Geocoder édition : corrige adresse → met à jour lng/lat
        if (isEdit) {
            const editGeocoderContainer = document.createElement('div');
            editGeocoderContainer.id = 'edit-geocoder';
            document.getElementById('edit-adresse').parentNode.appendChild(editGeocoderContainer);

            const editGeocoder = new MapboxGeocoder({
                accessToken: mapboxgl.accessToken,
                mapboxgl: mapboxgl,
                placeholder: "Corriger adresse (GPS auto)",
                marker: false,
            });
            editGeocoderContainer.appendChild(editGeocoder.onAdd(map));

            editGeocoder.on("result", (e) => {
                const coords = e.result.geometry.coordinates;
                document.getElementById("edit-lng").value = coords[0];
                document.getElementById("edit-lat").value = coords[1];
            });
        }

        // 📸 SUPPRESSION PHOTOS EXISTANTES
        const previewContainer = document.getElementById('preview-thumbnails');
        
        if (previewContainer && tempExistingImages.length > 0) {
            previewContainer.innerHTML = ''; // Vider

            tempExistingImages.forEach((url, index) => {
                const imgWrapper = document.createElement('div');

                imgWrapper.className = 'photo-preview-wrapper';  
                const img = document.createElement('img');
                img.src = url;
                const deleteBtn = document.createElement('button');
                deleteBtn.innerHTML = '×';
                deleteBtn.className = 'photo-delete-btn';
                deleteBtn.title = 'Supprimer cette photo';
                deleteBtn.onclick = async (e) => {
                  e.stopPropagation();
                  if (confirm('Supprimer cette photo ?')) {
                    deletedImages.push(url);  // Track pour DB
                    await deleteImageFromStorage(url);  // Efface storage MAINTENANT
                    imgWrapper.remove();  // Visuel
                  }
                };
        }

        const previewThumbs = document.getElementById('preview-thumbnails');
        previewThumbs.classList.add('edit-mode');  // Active styles CSS forts
        deletedImages = [];  // Reset suppressions pour cette édition

        const fileLabel = document.getElementById("file-label");
        fileLabel.onmouseenter = () => {
            fileLabel.style.background = "rgba(184, 134, 11, 0.15)";
            fileLabel.style.transform = "translateY(-1px)";
        };
        fileLabel.onmouseleave = () => {
            fileLabel.style.background = "rgba(184, 134, 11, 0.1)";
            fileLabel.style.transform = "translateY(0)";
        };

        const adminControls = document.getElementById("admin-controls");
        if (id) {
            adminControls.innerHTML = `<div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(184, 134, 11, 0.1);">
                <button id="btn-update-action" style="width: 100%; padding: 12px 20px; background: var(--accent-color); color: white; border: none; border-radius: 6px; font-weight: 500; cursor: pointer; font-size: 14px;">
                    Enregistrer les modifications
                </button>
            </div>`;
            document.getElementById("btn-update-action").onclick = () =>
                mettreAJourEdifice(id);
        } else {
            adminControls.innerHTML = `<div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(184, 134, 11, 0.1);">
                <button id="btn-save-action" style="width: 100%; padding: 12px 20px; background: var(--accent-color); color: white; border: none; border-radius: 6px; font-weight: 500; cursor: pointer; font-size: 14px;">
                    Créer l'édifice
                </button>
            </div>`;
            document.getElementById("btn-save-action").onclick =
                sauvegarderNouvelEdifice;
        }

        sidePanel.classList.remove("panel-hidden");
        sidePanel.style.visibility = "visible";
    }

    function afficherDetails(edifice) {
        console.log("Affichage des détails pour :", edifice.nom);

        const sidePanel = document.getElementById("side-panel");

        document.getElementById("panel-title").innerText = edifice.nom;
        document.getElementById("panel-city").innerText =
            (edifice.adresse || "") + " " + (edifice.ville || "");
        const categorieSpan = document.createElement('div');
        categorieSpan.style.marginTop = '10px';
        categorieSpan.style.fontSize = '14px';
        categorieSpan.style.color = 'var(--accent-color)';
        categorieSpan.style.fontWeight = '500';
        const categorieLabel = categorieLabels[edifice.categorie] || 'Autres';
        categorieSpan.textContent = 'Catégorie : ' + categorieLabel;
        document.getElementById('panel-city').appendChild(categorieSpan);
        document.getElementById("panel-description").innerText =
            edifice.description || "";

        const imgCont = document.getElementById("panel-image-container");
        imgCont.innerHTML = "";

        currentImages = Array.isArray(edifice.images) ? edifice.images : [];

        if (currentImages.length > 0) {
            currentImages.forEach((url, i) => {
                const img = document.createElement("img");
                img.src = url;
                img.className = "panel-img";
                img.style.width = "100%";
                img.style.marginBottom = "10px";
                img.onclick = () => openLightbox(i);
                imgCont.appendChild(img);
            });
        } else {
            imgCont.innerHTML = "<p>Aucune photo trouvée.</p>";
        }

        const adminControls = document.getElementById('admin-controls');
        adminControls.innerHTML = '';

        if (currentUser?.role === roles.ADMIN) {
            const bM = document.createElement('button');
            bM.innerText = 'Modifier';

            bM.onclick = () => {
                console.log('→ Appel édition avec edifice :', edifice); // DEBUG
                ouvrirFormulaireEdition(
                    edifice.lng,
                    edifice.lat,
                    Array.isArray(edifice.images) ? edifice.images : [],
                    edifice.id,
                    edifice // << 5e paramètre, les données complètes
                );
            };

            const bS = document.createElement('button');
            bS.innerText = 'Supprimer';
            bS.className = 'btn-danger';
            bS.onclick = () => supprimerEdifice(edifice.id);

            adminControls.append(bM, bS);
        }


        sidePanel.classList.remove("panel-hidden");
        sidePanel.style.visibility = "visible";
    }

    async function sauvegarderNouvelEdifice() {
        const status = document.getElementById("upload-status");
        const fileInput = document.getElementById("file-upload");

        const lngValue = parseFloat(
            document.getElementById("edit-lng").value
        );
        const latValue = parseFloat(
            document.getElementById("edit-lat").value
        );

        if (isNaN(lngValue) || isNaN(latValue)) {
            alert(
                "Erreur : Coordonnées GPS manquantes. Recherchez un édifice via le formulaire."
            );
            return;
        }

        let finalUrls = [];
        const files = fileInput ? fileInput.files : null;

        if (files && files.length > 0) {
            status.innerText = "⏳ Envoi des images...";
            for (let i = 0; i < files.length; i++) {
                const url = await uploadImage(files[i]);
                if (url) finalUrls.push(url);
            }
        }

        const nouvelEdifice = {
            nom: document.getElementById("edit-nom").value,
            ville: document.getElementById("edit-city").value,
            adresse: document.getElementById("edit-adresse").value,
            description: document.getElementById("edit-desc").value,
            lng: lngValue,
            lat: latValue,
            images: finalUrls,
            categorie: document.getElementById("edit-categorie")?.value || "autres",
        };

        const {
            error
        } = await supabaseClient
            .from("edifices")
            .insert(nouvelEdifice);

        if (error) {
            alert("Erreur Supabase : " + error.message);
        } else {
            alert("Édifice créé avec succès !");
            location.reload();
        }
    }

    async function mettreAJourEdifice(id) {
        const status = document.getElementById("upload-status");
        const fileInput = document.getElementById("file-upload");

        const lngValue = parseFloat(
            document.getElementById("edit-lng").value
        );
        const latValue = parseFloat(
            document.getElementById("edit-lat").value
        );

        if (isNaN(lngValue) || isNaN(latValue)) {
            alert(
                "Erreur fatale : les coordonnées de l'édifice ont été perdues."
            );
            return;
        }

        let totalImages = tempExistingImages ? [...tempExistingImages] : [];
        totalImages = totalImages.filter(img => !deletedImages.includes(img));

        if (fileInput && fileInput.files.length > 0) {
            status.innerText = "⏳ Upload des nouvelles photos...";
            for (let i = 0; i < fileInput.files.length; i++) {
                const url = await uploadImage(fileInput.files[i]);
                if (url) totalImages.push(url);
            }
        }

        status.innerText = "💾 Mise à jour en cours...";

        const {
            data,
            error
        } = await supabaseClient
            .from("edifices")
            .update({
                nom: document.getElementById("edit-nom").value,
                ville: document.getElementById("edit-city").value,
                adresse: document.getElementById("edit-adresse").value,
                description: document.getElementById("edit-desc").value,
                lng: lngValue,
                lat: latValue,
                images: totalImages,
                categorie: document.getElementById("edit-categorie")?.value || "autres",
            })
            .eq("id", id);

        if (error) {
            alert("Erreur : " + error.message);
        } else {
            if (deletedImages.length > 0) {
                console.log('📊 Session édition:', {
                    gardees: tempExistingImages.length,
                    supprimees: deletedImages.length,
                    ajoutees: totalImages.length - tempExistingImages.length
                });
            }
            alert("Succès !");
            loadEdifices();
            sidePanel.classList.add("panel-hidden");
            setTimeout(() => {
                sidePanel.style.visibility = "hidden";
            }, 400);
        }
    }

    async function supprimerEdifice(id) {
        if (!id) return;

        const confirmation = confirm(
            "Êtes-vous sûr de vouloir supprimer cet édifice définitivement ?"
        );
        if (!confirmation) return;

        const {
            error
        } = await supabaseClient
            .from("edifices")
            .delete()
            .eq("id", id);

        if (error) {
            console.error("Erreur suppression:", error);
            alert("Erreur lors de la suppression.");
        } else {
            alert("Édifice supprimé avec succès.");
            location.reload();
        }
    }

    // 6. AUTH & UI
    function updateUIForRole() {
        const loginBtn = document.querySelector(".btn-login");
        const adminAddButton = document.getElementById("admin-add-button");

        if (!currentUser) {
            loginBtn.innerText = "Connexion";
            loginBtn.onclick = () =>
                (document.getElementById("login-modal").style.display = "flex");

            if (adminAddButton) adminAddButton.classList.add("hidden");

            // Cacher le geocoder sans le supprimer
            if (geocoder) {
                const geocoderControl = document.querySelector(".mapboxgl-ctrl-geocoder");
                if (geocoderControl) geocoderControl.style.display = "none";
            }
            return;
        }

        loginBtn.innerText = "Déconnexion";
        loginBtn.onclick = logout;

        if (currentUser.role === roles.ADMIN) {
            if (adminAddButton) adminAddButton.classList.remove("hidden");

            if (geocoder) {
                // ✅ CLÉE : ajouter le geocoder UNE SEULE FOIS
                const geocoderControl = document.querySelector(".mapboxgl-ctrl-geocoder");
                if (!geocoderControl) {
                    // Le contrôle n'existe pas → on l'ajoute
                    map.addControl(geocoder, "top-left");
                    console.log("✅ Geocoder ajouté pour admin");
                } else {
                    // Le contrôle existe → on le montre juste
                    geocoderControl.style.display = "block";
                    console.log("✅ Geocoder affiché pour admin");
                }
            }
        } else {
            if (adminAddButton) adminAddButton.classList.add("hidden");

            if (geocoder) {
                const geocoderControl = document.querySelector(".mapboxgl-ctrl-geocoder");
                if (geocoderControl) {
                    geocoderControl.style.display = "none";
                    console.log("🔒 Geocoder caché (utilisateur non-admin)");
                }
            }
        }
    }

    document.getElementById("login-form").onsubmit = async (e) => {
        e.preventDefault();
        const {
            error
        } = await supabaseClient.auth.signInWithPassword({
            email: document.getElementById("email").value,
            password: document.getElementById("password").value,
        });
        if (error) alert(error.message);
        else location.reload();
    };

    async function logout() {
        await supabaseClient.auth.signOut();
        currentUser = null; // on vide l’utilisateur
        updateUIForRole(); // on met l’UI à jour
        location.reload(); // et on force un vrai reset
    }

    // 7. EVENTS (Lightbox, etc.)
    document.getElementById("close-panel").onclick = () => {
        const sidePanel = document.getElementById("side-panel");
        sidePanel.classList.add("panel-hidden");
        setTimeout(() => {
            sidePanel.style.visibility = "hidden";
        }, 400);
    };

    function openLightbox(index) {
        currentIndex = index;
        document.getElementById("lightbox-img").src =
            currentImages[currentIndex];
        document.getElementById("lightbox").style.display = "flex";
    }

    document.getElementById("lightbox-close").onclick = () => {
        document.getElementById("lightbox").style.display = "none";
    };

    document.getElementById("next-btn").onclick = (e) => {
        e.stopPropagation();
        currentIndex = (currentIndex + 1) % currentImages.length;
        document.getElementById("lightbox-img").src =
            currentImages[currentIndex];
    };

    document.getElementById("prev-btn").onclick = (e) => {
        e.stopPropagation();
        currentIndex =
            (currentIndex - 1 + currentImages.length) % currentImages.length;
        document.getElementById("lightbox-img").src =
            currentImages[currentIndex];
    };

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            document.getElementById("lightbox").style.display = "none";
            document.getElementById("side-panel").classList.add(
                "panel-hidden"
            );
        }
        if (document.getElementById("lightbox").style.display === "flex") {
            if (e.key === "ArrowRight")
                document.getElementById("next-btn").click();
            if (e.key === "ArrowLeft")
                document.getElementById("prev-btn").click();
        }
    });

    document.addEventListener('change', (e) => {
  if (e.target.id === 'file-upload') {
    const preview = document.getElementById('preview-thumbnails');
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach((file) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const imgWrapper = document.createElement('div');
          imgWrapper.className = 'photo-preview-wrapper';  // ← Classe CSS
          const img = document.createElement('img');
          img.src = event.target.result;
          img.style.opacity = '1';  // Pleine opacité
          
          const deleteBtn = document.createElement('button');
          deleteBtn.innerHTML = '×';
          deleteBtn.className = 'photo-delete-btn';
          deleteBtn.title = 'Supprimer cette photo';
          deleteBtn.onclick = (e) => {  // Même logique suppression
            e.stopPropagation();
            if (confirm('Supprimer cette photo ?')) {
              imgWrapper.remove();
            }
          };
          
          imgWrapper.appendChild(img);
          imgWrapper.appendChild(deleteBtn);
          preview.appendChild(imgWrapper);
        };
        reader.readAsDataURL(file);
      });
    }
  }
});


    // Fermeture panneau par clic sur la carte
    const mapContainer = document.getElementById('map-container');
    const sidePanel = document.getElementById('side-panel');

    mapContainer.addEventListener('click', (e) => {
        // Fermer seulement si panneau ouvert ET clic sur carte (pas sur panneau)
        if (!sidePanel.classList.contains('panel-hidden')) {
            console.log('Fermeture panneau par clic carte');
            sidePanel.classList.add('panel-hidden');
            setTimeout(() => {
                sidePanel.style.visibility = 'hidden';
            }, 400);
        }
    });

    // Empêcher la fermeture si clic DANS le panneau (évite conflits)
    sidePanel.addEventListener('click', (e) => {
        e.stopPropagation(); // Bloque l'événement map
    });

    document.getElementById("close-login").onclick = () =>
        (document.getElementById("login-modal").style.display = "none");

    // 8. FILTRES CATÉGORIES
    function appliquerFiltres() {
        const categoriesActives = Array.from(
            document.querySelectorAll(".cat-filter:checked")
        ).map((cb) => cb.value); // ex: ["culte","plages"]

        Object.values(tousLesMarqueurs).forEach(({
            element,
            categorie
        }) => {
            element.style.display = categoriesActives.includes(categorie) ?
                "block" :
                "none";
        });
    }

    // Bouton ouverture/fermeture panneau filtres
    const btnFiltersToggle = document.getElementById("btn-filters-toggle");
    if (btnFiltersToggle) {
        btnFiltersToggle.onclick = () => {
            const panel = document.getElementById("category-filters");
            if (!panel) return;
            panel.style.display =
                panel.style.display === "block" ? "none" : "block";
        };
    }

    // Bouton fermer (croix) dans le panneau
    const btnCloseFilters = document.getElementById("btn-close-filters");
    if (btnCloseFilters) {
        btnCloseFilters.onclick = () => {
            const panel = document.getElementById("category-filters");
            if (panel) panel.style.display = "none";
        };
    }

    // Fermer le panneau des filtres au chargement
    const filterPanel = document.getElementById("category-filters");
    if (filterPanel) {
        filterPanel.style.display = "none";
    }

    // Checkbox catégories
    document.querySelectorAll(".cat-filter").forEach((cb) => {
        cb.addEventListener("change", appliquerFiltres);
    });

    // Bouton "Tout voir / Tout masquer"
    const btnToggleAll = document.getElementById("btn-toggle-all");
    if (btnToggleAll) {
        btnToggleAll.onclick = () => {
            const checkboxes = document.querySelectorAll(".cat-filter");
            const toutCocher = btnToggleAll.textContent === "Tout voir";
            checkboxes.forEach((cb) => (cb.checked = toutCocher));
            btnToggleAll.textContent = toutCocher ?
                "Tout masquer" :
                "Tout voir";
            appliquerFiltres();
        };
    }
}
