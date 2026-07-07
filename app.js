/* =========================================================================
   1. INIZIALIZZAZIONE UI E VARIABILI GLOBALI
   ========================================================================= */
const displayStazione = document.getElementById('stazione-vicina');
const displayKm = document.getElementById('km-attuale');
const displayTratta = document.getElementById('tratta-attiva');
const displayAccuracy = document.getElementById('gps-accuracy');
const statusText = document.getElementById('status');
const containerTratte = document.getElementById('toggles-tratte');
const displayCoords = document.getElementById('gps-coords-display');

let map, userMarker, ultimaPosizioneGps = null;
let osmLayer, railwayLayer;
let mainLayerGroup = L.featureGroup();
let tratte = []; 
let autoSelezioneFatta = false; 
let colorIndex = 0;

/* =========================================================================
   2. GESTIONE DATABASE OFFLINE (IndexedDB)
   ========================================================================= */
const DB_NAME = 'RFINavigatorDB';
const DB_VERSION = 1;

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = event => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('rfi_data')) {
                db.createObjectStore('rfi_data');
            }
        };
        request.onsuccess = event => resolve(event.target.result);
        request.onerror = event => reject(event.target.error);
    });
}

async function saveToDB(key, data) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('rfi_data', 'readwrite');
        const store = tx.objectStore('rfi_data');
        const req = store.put(data, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

async function getFromDB(key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('rfi_data', 'readonly');
        const store = tx.objectStore('rfi_data');
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function svuotaCacheRFI() {
    try {
        const db = await openDB();
        await new Promise((resolve, reject) => {
            const tx = db.transaction('rfi_data', 'readwrite');
            const store = tx.objectStore('rfi_data');
            store.clear().onsuccess = resolve;
            tx.onerror = reject;
        });
        showToast("Cache RFI svuotata correttamente. Ricarico l'app...");
        setTimeout(() => location.reload(), 1500);
    } catch (e) {
        showToast("Errore durante lo svuotamento della cache.");
        console.error(e);
    }
}
window.svuotaCacheRFI = svuotaCacheRFI;

/* =========================================================================
   3. FUNZIONI UTILI (DISTANZE, MATEMATICA, TOAST)
   ========================================================================= */
function showToast(message, isError = false) {
    const toast = document.createElement('div');
    toast.className = 'toast-error';
    if (isError) {
        toast.style.backgroundColor = '#ff3b30';
        toast.innerHTML = `⚠️ ${message}`;
    } else {
        toast.style.backgroundColor = 'var(--primary-color)';
        toast.innerHTML = `ℹ️ ${message}`;
    }
    toast.style.position = 'fixed';
    toast.style.top = '20px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.zIndex = '9999';
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function getDistanceToSegment(lat, lon, lat1, lon1, lat2, lon2) {
    const l2 = Math.pow(lat2 - lat1, 2) + Math.pow(lon2 - lon1, 2);
    if (l2 === 0) return { dist: getDistance(lat, lon, lat1, lon1), t: 0 };
    let t = ((lat - lat1) * (lat2 - lat1) + (lon - lon1) * (lon2 - lon1)) / l2;
    t = Math.max(0, Math.min(1, t)); 
    return { dist: getDistance(lat, lon, lat1 + t * (lat2 - lat1), lon1 + t * (lon2 - lon1)), t: t };
}

/* =========================================================================
   4. CALIBRAZIONE CHILOMETRICA
   ========================================================================= */
function ricalcolaSuAncore(tratta, ancore) {
    ancore.sort((a, b) => a.indice - b.indice);
    if (ancore.length > 0) {
        tratta.punti.forEach((punto, index) => {
            let ancPrec = ancore.slice().reverse().find(a => a.indice <= index);
            let ancSucc = ancore.find(a => a.indice >= index);
            
            if (ancPrec && ancSucc) {
                if (ancPrec.indice === ancSucc.indice) punto.km = ancPrec.kmReale;
                else {
                    let diffCalcolata = ancSucc.kmCalcolato - ancPrec.kmCalcolato;
                    if (diffCalcolata === 0) punto.km = ancPrec.kmReale;
                    else punto.km = ancPrec.kmReale + ((punto.km - ancPrec.kmCalcolato) / diffCalcolata) * (ancSucc.kmReale - ancPrec.kmReale);
                }
            } else if (ancPrec) {
                let sign = 1;
                let idxA = ancore.indexOf(ancPrec);
                if (idxA > 0 && ancore[idxA - 1].kmReale > ancPrec.kmReale) sign = -1;
                punto.km = ancPrec.kmReale + sign * Math.abs(punto.km - ancPrec.kmCalcolato);
            } else if (ancSucc) {
                let sign = 1;
                let idxA = ancore.indexOf(ancSucc);
                if (idxA < ancore.length - 1 && ancore[idxA + 1].kmReale < ancSucc.kmReale) sign = -1;
                punto.km = ancSucc.kmReale - sign * Math.abs(ancSucc.kmCalcolato - punto.km);
            }
        });
    }
}

function applicaCalibrazioneStazioni(tratta, dizionarioReali, stazioniReference = null) {
    let ancore = [];
    if (stazioniReference) {
        Object.keys(dizionarioReali).forEach(chiaveForzata => {
            let kmRealeForzato = dizionarioReali[chiaveForzata];
            let bestIdx = -1;
            let stazioneRFI = stazioniReference.find(st => st.nome.toUpperCase().includes(chiaveForzata) && !(chiaveForzata === "VENEZIA MESTRE" && st.nome.toUpperCase().includes("OLIMPIA")));
            if (stazioneRFI) {
                let minDist = Infinity;
                tratta.punti.forEach((punto, index) => {
                    if (punto.isStazione && punto.nome.toUpperCase().includes(stazioneRFI.nome.toUpperCase())) {
                        let d = getDistance(stazioneRFI.lat, stazioneRFI.lon, punto.lat, punto.lon);
                        if (d < minDist) { minDist = d; bestIdx = index; }
                    }
                });
            }
            if (bestIdx !== -1) ancore.push({ indice: bestIdx, kmCalcolato: tratta.punti[bestIdx].km, kmReale: kmRealeForzato });
        });
    } else {
        tratta.punti.forEach((punto, index) => {
            if (punto.isStazione && !punto.nome.toUpperCase().includes("D.E.")) {
                let chiaveTrovata = Object.keys(dizionarioReali).find(k => punto.nome.toUpperCase().includes(k));
                if (chiaveTrovata) ancore.push({ indice: index, kmCalcolato: punto.km, kmReale: dizionarioReali[chiaveTrovata] });
            }
        });
    }
    ricalcolaSuAncore(tratta, ancore);
}

function applicaCalibrazioneStazioniEGps(tratta, dizionarioReali, capisaldiGps, stazioniReference = null) {
    let ancore = [];
    if (stazioniReference) {
        Object.keys(dizionarioReali).forEach(chiaveForzata => {
            let kmRealeForzato = dizionarioReali[chiaveForzata];
            let bestIdx = -1;
            let stazioneRFI = stazioniReference.find(st => st.nome.toUpperCase().includes(chiaveForzata) && !(chiaveForzata === "VENEZIA MESTRE" && st.nome.toUpperCase().includes("OLIMPIA")));
            if (stazioneRFI) {
                let minDist = Infinity;
                tratta.punti.forEach((punto, index) => {
                    if (punto.isStazione && punto.nome.toUpperCase().includes(stazioneRFI.nome.toUpperCase())) {
                        let d = getDistance(stazioneRFI.lat, stazioneRFI.lon, punto.lat, punto.lon);
                        if (d < minDist) { minDist = d; bestIdx = index; }
                    }
                });
            }
            if (bestIdx !== -1) ancore.push({ indice: bestIdx, kmCalcolato: tratta.punti[bestIdx].km, kmReale: kmRealeForzato });
        });
    } else {
        tratta.punti.forEach((punto, index) => {
            if (punto.isStazione && !punto.nome.toUpperCase().includes("D.E.")) {
                let chiaveTrovata = Object.keys(dizionarioReali).find(k => punto.nome.toUpperCase().includes(k));
                if (chiaveTrovata) ancore.push({ indice: index, kmCalcolato: punto.km, kmReale: dizionarioReali[chiaveTrovata] });
            }
        });
    }

    capisaldiGps.forEach(caposaldo => {
        let bestIdx = -1; let minDist = Infinity;
        tratta.punti.forEach((punto, index) => {
            let d = getDistance(caposaldo.lat, caposaldo.lon, punto.lat, punto.lon);
            if (d < minDist) { minDist = d; bestIdx = index; }
        });
        if (bestIdx !== -1 && minDist < 0.15) {
            ancore = ancore.filter(a => a.indice !== bestIdx);
            ancore.push({ indice: bestIdx, kmCalcolato: tratta.punti[bestIdx].km, kmReale: caposaldo.km });
        }
    });
    ricalcolaSuAncore(tratta, ancore);
}

function applicaCalibrazioneTrieste(tratta) {
    let idxTrieste = -1, idxMiramare = -1, idxBivio = -1, idxSistiana = -1, idxMonfalcone = -1;
    tratta.punti.forEach((punto, index) => {
        if (punto.isStazione) {
            if (punto.nome.toUpperCase().includes("TRIESTE CENTRALE")) idxTrieste = index;
            if (punto.nome.toUpperCase().includes("MIRAMARE")) idxMiramare = index;
            if (punto.nome.toUpperCase().includes("AURISINA")) idxBivio = index;
            if (punto.nome.toUpperCase().includes("SISTIANA")) idxSistiana = index;
            if (punto.nome.toUpperCase().includes("MONFALCONE")) idxMonfalcone = index;
        }
    });

    if (idxBivio === -1) {
        let minDiff = Infinity;
        tratta.punti.forEach((p, i) => {
            let diff = Math.abs(p.km - 13.7);
            if (diff < minDiff) { minDiff = diff; idxBivio = i; }
        });
    }

    let ancore = [];
    if (idxTrieste !== -1) ancore.push({ indice: idxTrieste, kmCalcolato: tratta.punti[idxTrieste].km, kmReale: 0.0 });
    if (idxMiramare !== -1) ancore.push({ indice: idxMiramare, kmCalcolato: tratta.punti[idxMiramare].km, kmReale: 7.033 });
    
    if (idxBivio !== -1) {
        if (idxBivio > 0) ancore.push({ indice: idxBivio - 1, kmCalcolato: tratta.punti[idxBivio - 1].km, kmReale: 13.687 });
        ancore.push({ indice: idxBivio, kmCalcolato: tratta.punti[idxBivio].km, kmReale: 130.463 });
    }
    
    if (idxSistiana !== -1) ancore.push({ indice: idxSistiana, kmCalcolato: tratta.punti[idxSistiana].km, kmReale: 127.730 });
    if (idxMonfalcone !== -1) ancore.push({ indice: idxMonfalcone, kmCalcolato: tratta.punti[idxMonfalcone].km, kmReale: 117.746 });
    
    ancore.push({ indice: tratta.punti.length - 1, kmCalcolato: tratta.punti[tratta.punti.length - 1].km, kmReale: 116.266 });

    ricalcolaSuAncore(tratta, ancore);
}

/* =========================================================================
   5. LOGICA MAPPA E RENDER TRATTE
   ========================================================================= */
async function scaricaDatiRFI() {
    statusText.innerText = "Verifica dati in memoria...";
    const bbox_nordest = "10.5,44.8,14.0,46.7"; 
    const urlTratte = `https://services3.arcgis.com/GS5pg5GvYXCMCEen/arcgis/rest/services/SHAPE_TRATTE/FeatureServer/0/query?f=geojson&outSR=4326&outFields=*&geometry=${bbox_nordest}&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects`;
    const urlStazioni = `https://services3.arcgis.com/GS5pg5GvYXCMCEen/arcgis/rest/services/SHAPE_LOCALITA/FeatureServer/0/query?f=geojson&outSR=4326&outFields=*&geometry=${bbox_nordest}&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects`;
    
    let dataStazioni, dataTratte;
    
    try {
        const cachedStazioni = await getFromDB('stazioni');
        const cachedTratte = await getFromDB('tratte');
        
        if (cachedStazioni && cachedTratte) {
            statusText.innerText = "Caricamento dati offline (IndexedDB)...";
            dataStazioni = cachedStazioni;
            dataTratte = cachedTratte;
        } else {
            statusText.innerText = "Connessione ai server RFI in corso...";
            const resStazioni = await fetch(urlStazioni);
            dataStazioni = await resStazioni.json();
            
            const resTratte = await fetch(urlTratte);
            dataTratte = await resTratte.json();
            
            await saveToDB('stazioni', dataStazioni);
            await saveToDB('tratte', dataTratte);
        }
        
        let stazioniRFI = dataStazioni.features.map(f => ({
            nome: f.properties.NOME, lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0], 
            regione: f.properties.REGIONE || (f.properties.COD_REG === 6 ? "Friuli Venezia Giulia" : "Veneto")
        })).filter(st => {
            let nomeTuttoMaiuscolo = st.nome.toUpperCase();
            if (nomeTuttoMaiuscolo.includes("S.BIAGIO") || nomeTuttoMaiuscolo.includes("SAN BIAGIO")) return false;
            return true;
        });
        
        stazioniRFI.push({ nome: "TORVISCOSA", lat: 45.82362, lon: 13.27964, regione: "Friuli Venezia Giulia" });
        stazioniRFI.push({ nome: "RONCHI LEG. SUD", lat: 45.82348, lon: 13.50422, regione: "Friuli Venezia Giulia" });
        stazioniRFI.push({ nome: "REDIPUGLIA", lat: 45.853593, lon: 13.485993, regione: "Friuli Venezia Giulia" });

        stazioniRFI.forEach(st => {
            let nomeStazione = st.nome.toUpperCase();
            if (nomeStazione.includes("VAT") || nomeStazione.includes("LEVATA")) {
                st.nome = "P.M. VAT"; st.lat = 46.092902; st.lon = 13.247471;
            } else if (nomeStazione.includes("PONTEBBA")) {
                st.lat = 46.508552; st.lon = 13.311574;
            } else if (nomeStazione.includes("UGOVIZZA")) {
                st.lat = 46.502853; st.lon = 13.494918;
            } else if (nomeStazione.includes("LIBERALE")) {
                st.nome = "S.LIBERALE";
            } else if (nomeStazione.includes("GIOVANNI DI CASARSA")) {
                st.nome = "S.GIOVANNI DI C.";
            }
        });

        const featuresByTratta = {};
        dataTratte.features.forEach(f => {
            const nome = f.properties.TRATTA ? f.properties.TRATTA.trim() : "Tratta Ignota";
            if (!featuresByTratta[nome]) featuresByTratta[nome] = [];
            featuresByTratta[nome].push(f);
        });

        FUSIONI.forEach(f => {
            featuresByTratta[f.nuovoNome] = [];
            f.segmenti.forEach(seg => {
                let segTrimmed = seg.trim();
                let matchingKeys = Object.keys(featuresByTratta).filter(k => k.trim() === segTrimmed);
                if (matchingKeys.length === 0) matchingKeys = Object.keys(featuresByTratta).filter(k => k.includes(segTrimmed));
                matchingKeys.forEach(k => {
                    featuresByTratta[f.nuovoNome].push(...featuresByTratta[k]);
                    delete featuresByTratta[k];
                });
            });
        });

        const tratteMap = new Map();
        Object.keys(featuresByTratta).forEach(nomeTratta => {
            if (!TRATTE_AMMESSE.includes(nomeTratta)) return;
            let coloreAssegnato = COLORI_FISSI[nomeTratta];
            if (!coloreAssegnato) {
                coloreAssegnato = PALETTE_EXTRA[colorIndex % PALETTE_EXTRA.length];
                colorIndex++;
            }
            tratteMap.set(nomeTratta, { nome: nomeTratta, coloreLinea: coloreAssegnato, coloreStazione: "#000", attiva: false, punti: [], stazioniDaInserire: [], regioniTrovate: new Set() });
            let tObj = tratteMap.get(nomeTratta);

            let segmentiUnici = [];
            let puntiAccettati = [];
            featuresByTratta[nomeTratta].forEach(f => {
                let coords = f.geometry.type === "MultiLineString" ? f.geometry.coordinates.flat(1) : f.geometry.coordinates;
                let sovrapposizioni = 0;
                coords.forEach(c => { if (puntiAccettati.some(ap => getDistance(c[1], c[0], ap[1], ap[0]) < 0.04)) sovrapposizioni++; });
                if (sovrapposizioni / coords.length < 0.4) { segmentiUnici.push(coords); puntiAccettati.push(...coords); }
            });

            if (segmentiUnici.length === 0) return;

            let nomePartenza = nomeTratta.split('-')[0].trim().toUpperCase();
            let stazionePartenza = stazioniRFI.find(s => s.nome.toUpperCase().includes(nomePartenza) || nomePartenza.includes(s.nome.toUpperCase()));
            let idxStart = 0;
            let reverseFirst = false;

            if (stazionePartenza) {
                let bestStartDist = Infinity;
                for (let i = 0; i < segmentiUnici.length; i++) {
                    let seg = segmentiUnici[i];
                    let dStart = getDistance(stazionePartenza.lat, stazionePartenza.lon, seg[0][1], seg[0][0]);
                    let dEnd = getDistance(stazionePartenza.lat, stazionePartenza.lon, seg[seg.length-1][1], seg[seg.length-1][0]);
                    if (dStart < bestStartDist) { bestStartDist = dStart; idxStart = i; reverseFirst = false; }
                    if (dEnd < bestStartDist) { bestStartDist = dEnd; idxStart = i; reverseFirst = true; }
                }
            }

            let chained = [];
            let firstSeg = segmentiUnici.splice(idxStart, 1)[0];
            if (reverseFirst) firstSeg.reverse();
            chained.push(...firstSeg);

            while (segmentiUnici.length > 0) {
                let lastPt = chained[chained.length - 1];
                let bestIdx = -1, bestDist = Infinity, rev = false;
                for (let i = 0; i < segmentiUnici.length; i++) {
                    let dStart = getDistance(lastPt[1], lastPt[0], segmentiUnici[i][0][1], segmentiUnici[i][0][0]);
                    let dEnd = getDistance(lastPt[1], lastPt[0], segmentiUnici[i][segmentiUnici[i].length-1][1], segmentiUnici[i][segmentiUnici[i].length-1][0]);
                    if (dStart < bestDist) { bestDist = dStart; bestIdx = i; rev = false; }
                    if (dEnd < bestDist) { bestDist = dEnd; bestIdx = i; rev = true; }
                }
                if (bestIdx !== -1) {
                    let next = segmentiUnici.splice(bestIdx, 1)[0];
                    if (rev) next.reverse();
                    chained.push(...next);
                } else break;
            }

            let curKm = 0, lLat = null, lLon = null;
            chained.forEach(c => {
                if (lLat !== null) {
                    let d = getDistance(lLat, lLon, c[1], c[0]);
                    if (d < 25) curKm += d;
                }
                tObj.punti.push({ lat: c[1], lon: c[0], km: curKm, isStazione: false });
                lLat = c[1]; lLon = c[0];
            });
        });

        stazioniRFI.forEach(st => {
            tratteMap.forEach(t => {
                if (t.nome === nomeSuper2) {  
                    const escluse = ["CARPENEDO", "OLIMPIA", "FAGAR", "GORGO", "ODERZO", "MOTTA", "GAGGIO"];
                    if (escluse.some(nomeEscluso => st.nome.toUpperCase().includes(nomeEscluso))) return;  
                }
                if (t.nome === nomeSuper6) {  
                    const escluse = ["GAZZERA"];
                    if (escluse.some(nomeEscluso => st.nome.toUpperCase().includes(nomeEscluso))) return;  
                }
                if (t.nome === nomeSuper4 && st.nome.toUpperCase() === "SACILE") return;
                
                let bestPerLinea = null;
                let bDist = 0.25;
                let bestInsertIdx = -1;
                
                for (let i = 0; i < t.punti.length - 1; i++) {
                    let m = getDistanceToSegment(st.lat, st.lon, t.punti[i].lat, t.punti[i].lon, t.punti[i+1].lat, t.punti[i+1].lon);
                    if (m.dist < bDist) {
                        bDist = m.dist;
                        bestPerLinea = { lat: st.lat, lon: st.lon, km: t.punti[i].km + m.t * (t.punti[i+1].km - t.punti[i].km), nome: st.nome, isStazione: true };
                        bestInsertIdx = i + 1;
                    }
                }
                
                if (bestPerLinea) {
                    t.stazioniDaInserire.push({stazione: bestPerLinea, idx: bestInsertIdx}); 
                    if (st.regione) t.regioniTrovate.add(st.regione.toUpperCase());  
                }
            });
        });
        
        tratteMap.forEach(t => {
            t.stazioniDaInserire.sort((a, b) => b.idx - a.idx); 
            t.stazioniDaInserire.forEach(item => t.punti.splice(item.idx, 0, item.stazione));
            if (t.nome === nomeSuper4 && t.punti.length > 0) {
                t.punti[0].isStazione = true; t.punti[0].nome = "SACILE"; t.punti[0].km = 0.0;
            }
        });
        
        let trattaSPM = tratteMap.get(nomeSuper6);
        if (trattaSPM) applicaCalibrazioneStazioniEGps(trattaSPM, kmRealiSanPoloMestre, capisaldiGpsSanPoloMestre, stazioniRFI);
        
        let trattaUDPA = tratteMap.get(nomeSuper8a);
        if (trattaUDPA) applicaCalibrazioneStazioniEGps(trattaUDPA, kmRealiUdinePalmanova, capisaldiGpsUdinePalmanova);
        
        let trattaPACE = tratteMap.get(nomeSuper8b);
        if (trattaPACE) applicaCalibrazioneStazioniEGps(trattaPACE, kmRealiPalmanovaCervignano, capisaldiGpsPalmanovaCervignano);
        
        let trattaUDSP = tratteMap.get(nomeSuper1);
        if (trattaUDSP) applicaCalibrazioneStazioniEGps(trattaUDSP, kmRealiUdineBivioSPolo, capisaldiGpsUdineBivioSPolo);
        
        let trattaUDVE = tratteMap.get(nomeSuper2);
        if (trattaUDVE) applicaCalibrazioneStazioniEGps(trattaUDVE, kmRealiUdineMestre, capisaldiGpsUdineMestre);
        
        let trattaUDTV = tratteMap.get(nomeSuper3);
        if (trattaUDTV) applicaCalibrazioneStazioniEGps(trattaUDTV, kmRealiUdineTarvisio, capisaldiGpsUdineTarvisio);

        let trattaPGCS = tratteMap.get(nomeSuper5);
        if (trattaPGCS) applicaCalibrazioneStazioniEGps(trattaPGCS, kmRealiPortoCasarsa, capisaldiGpsCasarsaPortogruaro);
        
        let trattaSAMA = tratteMap.get(nomeSuper4);
        if (trattaSAMA) applicaCalibrazioneStazioniEGps(trattaSAMA, kmRealiSacileManiago, capisaldiGpsSacileManiago);
        
        let trattaMEVE = tratteMap.get(nomeSuper9);
        if (trattaMEVE) applicaCalibrazioneStazioniEGps(trattaMEVE, kmRealiMestreSantaLucia, capisaldiGpsMestreSantaLucia);
        
        let trattaTSBP = tratteMap.get(nomeSuper7);
        if (trattaTSBP) applicaCalibrazioneTrieste(trattaTSBP);

        let trattaVatUdineParco = tratteMap.get("P.M. VAT - UDINE PARCO");
        if (trattaVatUdineParco && trattaVatUdineParco.punti.length > 0) {
            let latVat = 46.092902, lonVat = 13.247471;
            let dInizio = getDistance(trattaVatUdineParco.punti[0].lat, trattaVatUdineParco.punti[0].lon, latVat, lonVat);
            let dFine = getDistance(trattaVatUdineParco.punti[trattaVatUdineParco.punti.length-1].lat, trattaVatUdineParco.punti[trattaVatUdineParco.punti.length-1].lon, latVat, lonVat);
            
            let ancoreVP = [];
            if (dInizio < dFine) {
                ancoreVP.push({ indice: 0, kmCalcolato: trattaVatUdineParco.punti[0].km, kmReale: 7.677 });
                ancoreVP.push({ indice: trattaVatUdineParco.punti.length - 1, kmCalcolato: trattaVatUdineParco.punti[trattaVatUdineParco.punti.length - 1].km, kmReale: 0.920 });
            } else {
                ancoreVP.push({ indice: 0, kmCalcolato: trattaVatUdineParco.punti[0].km, kmReale: 0.920 });
                ancoreVP.push({ indice: trattaVatUdineParco.punti.length - 1, kmCalcolato: trattaVatUdineParco.punti[trattaVatUdineParco.punti.length - 1].km, kmReale: 7.677 });
            }
            ricalcolaSuAncore(trattaVatUdineParco, ancoreVP);
        }
        
        containerTratte.innerHTML = "";
        let raggruppamento = {};
        
        Array.from(tratteMap.values()).forEach((t) => {
            let regArray = Array.from(t.regioniTrovate);
            let cat = regArray.length === 1 ? regArray[0] : "Interregionali/Altro";
            if ([nomeSuper1, nomeSuper2, nomeSuper3, nomeSuper4, nomeSuper5, nomeSuper6, nomeSuper7, nomeSuper8a, nomeSuper8b, nomeSuper9, "P.M. VAT - UDINE PARCO"].includes(t.nome) || t.nome.toUpperCase() === "P.M. VAT - UDINE PARCO") {
                cat = "Regionale FVG";
            }
            t.idx = tratte.length; 
            tratte.push(t);
            if (cat.includes("FRIULI")) cat = "Friuli Venezia Giulia";
            if (!raggruppamento[cat]) raggruppamento[cat] = [];
            raggruppamento[cat].push(t);
        });
        
        const ordineCat = ["Regionale FVG", "Friuli Venezia Giulia", "Interregionali/Altro"];
        const chiaviOrdinate = Object.keys(raggruppamento).sort((a,b) => {
            let idxA = ordineCat.indexOf(a); let idxB = ordineCat.indexOf(b);
            return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
        });
        
        const nomiVisuali = {
            "UDINE - BIVIO S.POLO": "UDINE - BIVIO SAN POLO",
            "TRIESTE CENTRALE - BIVIO S.POLO": "TRIESTE CENTRALE - BIVIO SAN POLO", 
            "BIVIO SAN POLO - MESTRE": "BIVIO SAN POLO - VENEZIA MESTRE"
        };
        
        let idx8a = tratte.findIndex(tr => tr.nome === nomeSuper8a);
        let idx8b = tratte.findIndex(tr => tr.nome === nomeSuper8b);
        
        chiaviOrdinate.forEach(cat => {
            const det = document.createElement('div'); det.style.marginBottom = "10px";
            if (cat === "Regionale FVG") {
                const ordinePersonalizzato = [nomeSuper2, nomeSuper1, nomeSuper3, nomeSuper8a, nomeSuper8b, nomeSuper7, nomeSuper6, nomeSuper9, nomeSuper5, nomeSuper4, "P.M. VAT - UDINE PARCO"].map(n => n.toUpperCase());
                raggruppamento[cat].sort((a, b) => {
                    let posA = ordinePersonalizzato.indexOf(a.nome.toUpperCase()); let posB = ordinePersonalizzato.indexOf(b.nome.toUpperCase());
                    return (posA === -1 ? 99 : posA) - (posB === -1 ? 99 : posB);
                });
                let indicePrec = -1;
                raggruppamento[cat].forEach(t => {
                    if (t.nome === nomeSuper8b) return;
                    let posAttuale = ordinePersonalizzato.indexOf(t.nome.toUpperCase());
                    if (indicePrec !== -1 && ((indicePrec === 3 && posAttuale === 5) || (indicePrec === 7 && posAttuale === 8) || (indicePrec === 9 && posAttuale === 10))) {
                        const spaziatore = document.createElement('div'); spaziatore.style.height = "24px"; det.appendChild(spaziatore);
                    }
                    indicePrec = posAttuale;
                    
                    const lbl = document.createElement('label'); lbl.className = 'checkbox-container'; lbl.style.marginLeft = "15px";
                    let style = 'font-weight:bold; color:var(--text-color);';
                    
                    if (t.nome === nomeSuper8a) {
                        lbl.innerHTML = `<input type="checkbox" id="chk-tratta-${t.idx}" onchange="toggleTratta(${idx8a}, this.checked); toggleTratta(${idx8b}, this.checked)"><span style="color:${t.coloreLinea}; font-size:18px;">■</span> <span style="${style}">UDINE - CERVIGNANO A.G.</span>`;
                    } else {
                        let nomeDaMostrare = nomiVisuali[t.nome.toUpperCase()] || t.nome;
                        lbl.innerHTML = `<input type="checkbox" id="chk-tratta-${t.idx}" onchange="toggleTratta(${t.idx}, this.checked)"><span style="color:${t.coloreLinea}; font-size:18px;">■</span> <span style="${style}">${nomeDaMostrare}</span>`;
                    }
                    det.appendChild(lbl);
                });
            } else {
                  raggruppamento[cat].sort((a,b) => a.nome.localeCompare(b.nome));
                  raggruppamento[cat].forEach(t => {
                    const lbl = document.createElement('label'); lbl.className = 'checkbox-container'; lbl.style.marginLeft = "15px";
                    let nomeDaMostrare = nomiVisuali[t.nome.toUpperCase()] || t.nome;
                    lbl.innerHTML = `<input type="checkbox" id="chk-tratta-${t.idx}" onchange="toggleTratta(${t.idx}, this.checked)"><span style="color:${t.coloreLinea}; font-size:18px;">■</span> <span>${nomeDaMostrare}</span>`;
                    det.appendChild(lbl);
                }); 
            }
            containerTratte.appendChild(det);
        });
        
        statusText.innerText = "Sistema pronto! Dati in memoria.";
        aggiornaVisualizzazione();
        
        if (ultimaPosizioneGps) updateLocation(ultimaPosizioneGps);
    } catch (e) {
        statusText.innerText = "Errore connessione RFI. Verifica la rete.";
        showToast("Errore di caricamento mappa RFI", true);
        console.error(e);
    }
}

/* =========================================================================
   6. INIT MAPPA E AGGIORNAMENTO GPS
   ========================================================================= */
map = L.map('map', { fullscreenControl: true, fullscreenControlOptions: { position: 'topright' } }).setView([46.1, 13.1], 9);
mainLayerGroup.addTo(map);
osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OSM' }).addTo(map);
map.on('zoomend', aggiornaVisualizzazione);

function toggleBackground(c) { osmLayer.setOpacity(c.checked ? 0 : 1); }
window.toggleBackground = toggleBackground;

window.toggleCordinate = () => {
    const isChecked = document.getElementById('toggle-coords').checked;
    displayCoords.style.display = isChecked ? 'block' : 'none';
};

window.toggleTratta = (i, c) => {
    tratte[i].attiva = c;
    aggiornaVisualizzazione();
    if (ultimaPosizioneGps) updateLocation(ultimaPosizioneGps);
};

function aggiornaVisualizzazione() {
    mainLayerGroup.clearLayers();
    const cippi = document.getElementById('toggle-cippi').checked;
    const staz = document.getElementById('toggle-stazioni').checked;
    const zoomAttuale = map.getZoom();
    
    tratte.forEach(t => {
        if (!t.attiva) return;
        let pts = [];
        for(let i=0; i<t.punti.length; i++) {
            if (i > 0 && Math.abs(t.punti[i].km - t.punti[i-1].km) > 20) {
                L.polyline(pts, {color: t.coloreLinea, weight: 4}).addTo(mainLayerGroup);
                pts = [];
            }
            pts.push([t.punti[i].lat, t.punti[i].lon]);
        }
        L.polyline(pts, {color: t.coloreLinea, weight: 4}).addTo(mainLayerGroup);
        
        if (cippi && zoomAttuale >= 12) {
            t.punti.forEach((p, i) => {
                if (i < t.punti.length-1) {
                    let s1 = p, s2 = t.punti[i+1];
                    if (isNaN(s1.km) || isNaN(s2.km)) return;
                    let diffKm = Math.abs(s2.km - s1.km);
                    if (diffKm > 0 && diffKm < 10) { 
                        let minK = Math.ceil(Math.min(s1.km, s2.km)), maxK = Math.floor(Math.max(s1.km, s2.km));
                        for (let k = minK; k <= maxK; k++) {
                            if (k===0 && s1.km===0) continue;
                            let f = Math.abs(k - s1.km) / diffKm;
                            let lat = s1.lat + (s2.lat-s1.lat)*f, lon = s1.lon + (s2.lon-s1.lon)*f;
                            if (!isNaN(lat) && !isNaN(lon)) {
                                L.marker([lat, lon], { icon: L.divIcon({ className: 'km-icon', html: `<div>${k}</div>`, iconSize: [20, 14] }) }).addTo(mainLayerGroup);
                            }
                        }
                    }
                }
            });
        }
        
        if (staz) {
            t.punti.forEach(s => {
                if(s.isStazione) L.circleMarker([s.lat, s.lon], { radius: 8, fillColor: "#000", color: "#fff", weight: 2, fillOpacity: 1 }).addTo(mainLayerGroup).bindPopup(`<b>${s.nome}</b><br>Km ${s.km.toFixed(1)}`);
            });
        }
    });
}
window.aggiornaVisualizzazione = aggiornaVisualizzazione;

function updateLocation(pos) {
    ultimaPosizioneGps = pos; 
    const { latitude, longitude, accuracy, speed } = pos.coords;
    
    if (accuracy) {
        let color = accuracy <= 20 ? '#28a745' : (accuracy <= 60 ? '#ffc107' : '#dc3545');
        displayAccuracy.innerHTML = `<span style="color: ${color}; font-weight: bold;">±${accuracy.toFixed(0)} m</span>`;
    }
    
    const displaySpeed = document.getElementById('gps-speed');
    if (displaySpeed) {
        if (speed !== null && speed >= 0) {
            displaySpeed.innerText = (speed * 3.6).toFixed(0);
        } else {
            displaySpeed.innerText = "--";
        }
    }
    
    if (displayCoords) {
        displayCoords.innerHTML = `Lat: <b style="color: var(--text-color);">${latitude.toFixed(5)}</b> <br> Lon: <b style="color: var(--text-color);">${longitude.toFixed(5)}</b>`;
    }
    
    if (!userMarker) {
        userMarker = L.circleMarker([latitude, longitude], { color: '#fff', fillColor: '#00F', radius: 11, fillOpacity: 1, weight: 4 }).addTo(map);
        map.setView([latitude, longitude], 13);
    } else {
        userMarker.setLatLng([latitude, longitude]);
        if (document.getElementById('toggle-autocenter').checked) {
            map.setView([latitude, longitude]);
        }
    }
    
    if (!autoSelezioneFatta && tratte.length > 0) {
        let idTrattaPiuVicina = -1;
        let distMinimaAssoluta = Infinity;
        
        tratte.forEach((t) => {
            for (let i = 0; i < t.punti.length - 1; i++) {
                let m = getDistanceToSegment(latitude, longitude, t.punti[i].lat, t.punti[i].lon, t.punti[i+1].lat, t.punti[i+1].lon);
                if (m.dist < distMinimaAssoluta) {
                    distMinimaAssoluta = m.dist;
                    idTrattaPiuVicina = t.idx; 
                }
            }
        });
        
        if (idTrattaPiuVicina !== -1 && distMinimaAssoluta < 5) {
            tratte[idTrattaPiuVicina].attiva = true;
            if (tratte[idTrattaPiuVicina].nome === nomeSuper8a) {
                let t8b = tratte.find(t => t.nome === nomeSuper8b);
                if (t8b) t8b.attiva = true;
                const chk = document.getElementById(`chk-tratta-${idTrattaPiuVicina}`);
                if (chk) chk.checked = true;
            } else if (tratte[idTrattaPiuVicina].nome === nomeSuper8b) {
                let t8a = tratte.find(t => t.nome === nomeSuper8a);
                if (t8a) {
                    t8a.attiva = true;
                    const chk = document.getElementById(`chk-tratta-${t8a.idx}`);
                    if (chk) chk.checked = true;
                }
            } else {
                const chk = document.getElementById(`chk-tratta-${idTrattaPiuVicina}`);
                if (chk) chk.checked = true;
            }
            aggiornaVisualizzazione();
            statusText.innerText = `GPS Acceso. Linea auto-selezionata.`;
        }
        autoSelezioneFatta = true; 
    }
    
    let best = null, nStaz = null, dMin = Infinity;
    tratte.forEach(t => {
        if (!t.attiva) return;
        t.punti.forEach(s => {
            if (s.isStazione) {
                let d = getDistance(latitude, longitude, s.lat, s.lon);
                if (d < dMin) { dMin = d; nStaz = s; }
            }
        });
        for (let i = 0; i < t.punti.length - 1; i++) {
            let m = getDistanceToSegment(latitude, longitude, t.punti[i].lat, t.punti[i].lon, t.punti[i+1].lat, t.punti[i+1].lon);
            let nomePulito = t.nome.replace(" (Tratta 1)", "").replace(" (Tratta 2)", "");
            if (!best || m.dist < best.dist) best = { dist: m.dist, km: (t.punti[i].km + m.t * (t.punti[i+1].km - t.punti[i].km)).toFixed(2), nome: nomePulito };
        }
    });
    
    if (best && nStaz) {
        if (best.dist > 0.5) {
            displayStazione.innerHTML = `⚠️ Sede ferroviaria non rilevata`;
            displayKm.innerHTML = `---`;
            displayTratta.innerText = `Fuori linea o segnale debole`;
        } else {
            displayStazione.innerHTML = `Stazione più vicina: <b>${nStaz.nome}</b> (${dMin.toFixed(1)} km)`;
            displayKm.innerHTML = `Km ${best.km}`;
            displayTratta.innerText = `Linea: ${best.nome}`;
        }
    }
}

function handleGpsError(err) {
    console.warn(`GPS Error(${err.code}): ${err.message}`);
    showToast(`Errore GPS: ${err.message}`, true);
    displayStazione.innerHTML = `⚠️ Segnale GPS non disponibile`;
}

function forzaPosizione() {
    if (ultimaPosizioneGps) {
        map.setView([ultimaPosizioneGps.coords.latitude, ultimaPosizioneGps.coords.longitude]);
    }
    navigator.geolocation.getCurrentPosition(updateLocation, handleGpsError, { enableHighAccuracy: true });
}
window.forzaPosizione = forzaPosizione;

/* =========================================================================
   7. WAKE LOCK
   ========================================================================= */
let wakeLock = null;
async function richiediWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
            wakeLock.addEventListener('release', () => console.log('Wake Lock rilasciato dal sistema.'));
            console.log('Wake Lock attivato.');
        }
    } catch (err) {
        console.warn(`Wake Lock non supportato: ${err.message}`);
    }
}
document.addEventListener('visibilitychange', async () => {
    if (wakeLock !== null && document.visibilityState === 'visible') {
        await richiediWakeLock();
    }
});

/* =========================================================================
   8. ADMIN MODAL & TABELLE
   ========================================================================= */
window.toggleTema = () => {
    document.body.classList.toggle('dark-mode');
    const btn = document.querySelector('.theme-btn');
    btn.innerText = document.body.classList.contains('dark-mode') ? '☀️' : '🌙';
};

window.richiediCodiceAdmin = () => {
    document.getElementById('admin-login-modal').classList.add('show');
    document.getElementById('admin-login-modal').style.display = 'flex';
    document.getElementById('admin-pin-input').value = '';
    setTimeout(() => document.getElementById('admin-pin-input').focus(), 100);
};

window.chiudiAdminLogin = () => {
    document.getElementById('admin-login-modal').classList.remove('show');
    setTimeout(() => document.getElementById('admin-login-modal').style.display = 'none', 300);
};

window.confermaAdminPin = () => {
    let pin = document.getElementById('admin-pin-input').value;
    if (pin === "1717") {
        chiudiAdminLogin();
        generaTabelleCapisaldi();
        generaTabelleGPS();
        document.getElementById('admin-modal').style.display = 'flex';
        setTimeout(() => document.getElementById('admin-modal').classList.add('show'), 10);
        switchTabAdmin('km');
    } else {
        showToast("Codice errato", true);
        document.getElementById('admin-pin-input').value = '';
    }
};

window.chiudiAdmin = () => {
    document.getElementById('admin-modal').classList.remove('show');
    setTimeout(() => document.getElementById('admin-modal').style.display = 'none', 300);
};

window.switchTabAdmin = (tabId) => {
    const tabKm = document.getElementById('tab-km');
    const tabGps = document.getElementById('tab-gps');
    const btnKm = document.getElementById('btn-tab-km');
    const btnGps = document.getElementById('btn-tab-gps');

    if (tabId === 'km') {
        tabKm.style.display = 'block'; tabGps.style.display = 'none';
        btnKm.classList.add('active'); btnGps.classList.remove('active');
    } else {
        tabKm.style.display = 'none'; tabGps.style.display = 'block';
        btnKm.classList.remove('active'); btnGps.classList.add('active');
    }
};

function generaTabelleCapisaldi() {
    const container = document.getElementById('tab-km');
    container.innerHTML = ""; 
    const lineeDati = [
        { nome: nomeSuper1, dati: kmRealiUdineBivioSPolo }, { nome: nomeSuper2, dati: kmRealiUdineMestre }, { nome: nomeSuper3, dati: kmRealiUdineTarvisio },
        { nome: nomeSuper4, dati: kmRealiSacileManiago }, { nome: nomeSuper5, dati: kmRealiPortoCasarsa }, { nome: nomeSuper6, dati: kmRealiSanPoloMestre },
        { nome: nomeSuper7, dati: { "TRIESTE CENTRALE": 0.0, "MIRAMARE": 7.033, "BIVIO D'AURISINA": 130.463, "SISTIANA": 127.730, "MONFALCONE": 117.746 } }, 
        { nome: nomeSuper8a, dati: kmRealiUdinePalmanova }, { nome: nomeSuper8b, dati: kmRealiPalmanovaCervignano }, { nome: nomeSuper9, dati: kmRealiMestreSantaLucia }
    ];
    lineeDati.forEach(linea => {
        let html = `<h3 style="color: var(--text-color); margin-bottom: 8px; margin-top: 20px; font-size: 16px;">📍 ${linea.nome}</h3>
                    <table class="capisaldi-table"><tr><th style="text-align: left;">Stazione / Punto Notevole</th><th style="text-align: right;">Progressiva (Km)</th></tr>`;
        Object.entries(linea.dati).sort((a, b) => a[1] - b[1]).forEach(([stazione, km]) => {
            html += `<tr><td><b>${stazione}</b></td><td style="text-align: right; color: var(--note-color);">${km.toFixed(3).replace('.', ',')}</td></tr>`;
        });
        html += `</table>`; container.innerHTML += html;
    });
}

function generaTabelleGPS() {
    const container = document.getElementById('tab-gps');
    container.innerHTML = ""; 
    const lineeGps = [
        { nome: nomeSuper1, dati: capisaldiGpsUdineBivioSPolo }, { nome: nomeSuper2, dati: capisaldiGpsUdineMestre }, { nome: nomeSuper3, dati: capisaldiGpsUdineTarvisio },
        { nome: nomeSuper4, dati: capisaldiGpsSacileManiago }, { nome: nomeSuper5, dati: capisaldiGpsCasarsaPortogruaro }, { nome: nomeSuper6, dati: capisaldiGpsSanPoloMestre },
        { nome: nomeSuper8a, dati: capisaldiGpsUdinePalmanova }, { nome: nomeSuper8b, dati: capisaldiGpsPalmanovaCervignano }, { nome: nomeSuper9, dati: capisaldiGpsMestreSantaLucia }
    ];
    lineeGps.forEach(linea => {
        let html = `<h3 style="color: var(--text-color); margin-bottom: 8px; margin-top: 20px; font-size: 16px;">📡 ${linea.nome}</h3>
                    <table class="capisaldi-table"><tr><th style="text-align: left;">Punto (Km)</th><th style="text-align: right;">Latitudine</th><th style="text-align: right;">Longitudine</th></tr>`;
        linea.dati.sort((a, b) => a.km - b.km).forEach(punto => {
            html += `<tr><td><b>Km ${punto.km.toFixed(3).replace('.', ',')}</b></td>
                         <td style="text-align: right; color: var(--note-color); font-family: monospace;">${punto.lat.toFixed(6)}</td>
                         <td style="text-align: right; color: var(--note-color); font-family: monospace;">${punto.lon.toFixed(6)}</td></tr>`;
        });
        html += `</table>`; container.innerHTML += html;
    });
    if (lineeGps.length === 0) container.innerHTML = `<p style="color: var(--note-color); text-align: center; margin-top: 20px;">Nessun dato GPS salvato nel codice.</p>`;
}

/* =========================================================================
   9. ESECUZIONE ALL'AVVIO
   ========================================================================= */
scaricaDatiRFI();
navigator.geolocation.watchPosition(updateLocation, handleGpsError, { enableHighAccuracy: true });
richiediWakeLock();

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker pronto.', reg))
            .catch(err => console.warn('Errore Worker:', err));
    });
}
