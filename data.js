/* =========================================================================
   1. COSTANTI DI CONFIGURAZIONE E STRUTTURE DATI
   ========================================================================= */
const nomeSuper1 = "UDINE - BIVIO S.POLO";
const nomeSuper2 = "UDINE - VENEZIA MESTRE";
const nomeSuper3 = "UDINE - TARVISIO BOSCOVERDE";
const nomeSuper4 = "SACILE - MANIAGO";
const nomeSuper5 = "CASARSA - PORTOGRUARO";
const nomeSuper6 = "BIVIO SAN POLO - MESTRE";
const nomeSuper7 = "TRIESTE CENTRALE - BIVIO S.POLO";
const nomeSuper8a = "UDINE - PALMANOVA (Tratta 1)";
const nomeSuper8b = "PALMANOVA - CERVIGNANO (Tratta 2)";
const nomeSuper9 = "VENEZIA MESTRE - VENEZIA S.LUCIA";

const TRATTE_AMMESSE = [
    nomeSuper1, nomeSuper2, nomeSuper3, nomeSuper4, 
    nomeSuper5, nomeSuper6, nomeSuper7, nomeSuper8a, nomeSuper8b, 
    nomeSuper9, "P.M. VAT - UDINE PARCO"
];

const COLORI_FISSI = {
    [nomeSuper2]: "#E3000F", 
    [nomeSuper1]: "#0055A4", 
    [nomeSuper3]: "#008A00", 
    [nomeSuper5]: "#800080", 
    [nomeSuper4]: "#FF8C00", 
    [nomeSuper6]: "#00CED1", 
    [nomeSuper7]: "#E0007A", 
    [nomeSuper8a]: "#8B4513", 
    [nomeSuper8b]: "#8B4513", 
    [nomeSuper9]: "#32CD32", 
    "P.M. VAT - UDINE PARCO": "#000080"
};

const PALETTE_EXTRA = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"];

const FUSIONI = [
    { nuovoNome: nomeSuper1, segmenti: ["UDINE - UDINE PARCO", "UDINE PARCO - UDINE PARCO DEV. PRADAMANO", "UDINE PARCO DEV. PRADAMANO - S.GIOVANNI AL NATISONE", "S.GIOVANNI AL NATISONE - CORMONS", "CORMONS - GORIZIA C.LE", "GORIZIA C.LE - REDIPUGLIA", "REDIPUGLIA - RONCHI DEI LEGIONARI NORD", "RONCHI DEI LEGIONARI NORD - MONF.DEV.S.POLO"] },
    { nuovoNome: nomeSuper2, segmenti: ["UDINE - BASILIANO", "BASILIANO - CODROIPO", "CODROIPO - CASARSA", "CASARSA - PORDENONE", "PORDENONE - SACILE", "SACILE - D.E. CONEGLIANO", "D.E. CONEGLIANO - CONEGLIANO", "CONEGLIANO - SPRESIANO", "SPRESIANO - G.S. TREVISO", "G.S. TREVISO - TREVISO CENTRALE", "TREVISO CENTRALE - MOGLIANO VENETO", "MOGLIANO VENETO - BIVIO MAROCCO", "BIVIO MAROCCO - CONFLUENZA UD-TS", "CONFLUENZA UD-TS - VENEZIA MESTRE (VIA UD)"] },
    { nuovoNome: nomeSuper3, segmenti: ["TARVISIO BOSCOVERDE - UGOVIZZA VALBRUNA", "UGOVIZZA VALBRUNA - PONTEBBA", "PONTEBBA - AUPA", "AUPA - CARNIA", "CARNIA - GEMONA DEL FRIULI", "GEMONA DEL FRIULI - TARCENTO", "TARCENTO - P.M. VAT", "P.M. VAT - UDINE"] },
    { nuovoNome: nomeSuper4, segmenti: ["MANIAGO - MONTEREALE VALCELLINA", "MONTEREALE VALCELLINA - AVIANO", "AVIANO - BUDOIA POLCENIGO", "BUDOIA POLCENIGO - SACILE"] },
    { nuovoNome: nomeSuper5, segmenti: ["CASARSA - S.VITO AL TAGLIAMENTO", "S.VITO AL TAGLIAMENTO - CORDOVADO SESTO", "CORDOVADO SESTO - PORTOGRUARO"] },
    { nuovoNome: nomeSuper6, segmenti: ["MONF.DEV.S.POLO - RONCHI DEI LEGIONARI SUD", "RONCHI DEI LEGIONARI SUD - CERVIGNANO A.G.", "CERVIGNANO A.G. - TORVISCOSA", "TORVISCOSA - S.GIORGIO DI NOGARO", "S.GIORGIO DI NOGARO - LATISANA", "LATISANA - PORTOGRUARO", "PORTOGRUARO - S.STINO DI LIVENZA", "S.STINO DI LIVENZA - S.DONA' DI PIAVE JESOLO", "S.DONA' DI PIAVE JESOLO - QUARTO D'ALTINO", "QUARTO D'ALTINO - VENEZIA CARPENEDO", "VENEZIA CARPENEDO - CONFLUENZA UD-TS", "CONFLUENZA UD-TS - VENEZIA MESTRE (VIA TS)"] },
    { nuovoNome: nomeSuper7, segmenti: ["TRIESTE CENTRALE - TRIESTE C.LE GR SC. GRETTA", "TRIESTE C.LE GR SC. GRETTA - TRIESTE C.LE GR SC. BARCOLA", "TRIESTE C.LE GR SC. BARCOLA - BIVIO D'AURISINA SC. ESTR. GALLERIA", "BIVIO D'AURISINA SC. ESTR. GALLERIA - BIVIO D'AURISINA", "BIVIO D'AURISINA - MONFALCONE", "MONFALCONE - MONF.DEV.S.POLO"] },
    { nuovoNome: nomeSuper8a, segmenti: ["UDINE - BIVIO CARGNACCO", "BIVIO CARGNACCO - DEV. BIVIO CARGNACCO (UD)", "DEV. BIVIO CARGNACCO - RISANO", "RISANO - PALMANOVA"] },
    { nuovoNome: nomeSuper8b, segmenti: ["PALMANOVA - DEV.E. LATO UDINE", "DEV.E. LATO UDINE - CERVIGNANO SMISTAMENTO F.P.", "CERVIGNANO SMISTAMENTO F.P. - DEV.RACCORDO ARRIVI", "DEV.RACCORDO ARRIVI - CERVIGNANO A.G."] },
    { nuovoNome: nomeSuper9, segmenti: ["VENEZIA MESTRE - DEV.ESTR.VENEZIA (ponte nuovo)", "DEV.ESTR.VENEZIA - VENEZIA S.LUCIA (ponte vecchio)"] }
];

/* =========================================================================
   2. KM REALI (STAZIONI) E CAPISALDI GPS
   ========================================================================= */
const kmRealiUdinePalmanova = { "UDINE": 0.0, "RISANO": 9.883, "PALMANOVA": 17.940 };
const kmRealiPalmanovaCervignano = { "PALMANOVA": 0.0, "CERVIGNANO": 10.401 };
const kmRealiSanPoloMestre = { "VENEZIA MESTRE": 0.0, "OLIMPIA": 1.9, "CARPENEDO": 3.9, "GAGGIO": 10.7, "QUARTO D'ALTINO": 15.7, "MEOLO": 23.9, "FOSSALTA DI PIAVE": 27.7, "S.DONA": 32.7, "CEGGIA": 40.6, "S.STINO": 45.9, "LISON": 52.8, "PORTOGRUARO": 59.3, "LATISANA": 73.2, "S.GIORGIO": 90.6, "TORVISCOSA": 96.6, "CERVIGNANO": 101.3, "TRIESTE AIRPORT": 112.8, "RONCHI": 114.0 };
const kmRealiUdineBivioSPolo = { "UDINE": 0.0, "BUTTRIO": 8.67, "MANZANO": 13.14, "S.GIOVANNI": 15.33, "CORMONS": 20.78, "GORIZIA": 32.86, "SAGRADO": 46.00, "REDIPUGLIA": 48.19, "RONCHI": 51.23 };
const kmRealiUdineMestre = { "UDINE": 126.57, "BASILIANO": 115.2, "CODROIPO": 103.6, "CASARSA": 92.9, "CUSANO": 86.4, "PORDENONE": 77.8, "FONTANAFREDDA": 71.3, "SACILE": 64.9, "ORSAGO": 59.4, "PIANZANO": 55.4, "CONEGLIANO": 47.8, "SUSEGANA": 40.0, "SPRESIANO": 34.7, "LANCENIGO": 27.2, "TREVISO CENTRALE": 20.9, "SAN TROVASO": 16.3, "PREGANZIOL": 13.9, "MOGLIANO VENETO": 9.2, "OSPEDALE": 3.9, "GAZZERA": 1.2, "VENEZIA MESTRE": 0.0 };
const kmRealiPortoCasarsa = { "PORTOGRUARO": 0.0, "TEGLIO VENETO": 3.9, "CORDOVADO SESTO": 8.6, "S.VITO": 15.9, "SAN VITO": 15.9, "VITO AL TAGLIAMENTO": 15.9, "S.GIOVANNI": 19.4, "SAN GIOVANNI": 19.4, "GIOVANNI DI CASARSA": 19.4, "CASARSA": 21.1 };
const kmRealiSacileManiago = { "SACILE": 0.0, "LIBERALE": 2.0, "BUDOIA": 10.4, "AVIANO": 16.1, "MONTEREALE": 27.2, "MANIAGO": 32.2 };
const kmRealiMestreSantaLucia = { "VENEZIA MESTRE": 257.90, "PORTO MARGHERA": 260.19, "S.LUCIA": 266.34 };
const kmRealiUdineTarvisio = { "UDINE": 0.0, "VAT": 4.493, "TRICESIMO": 11.975, "TARCENTO": 18.349, "ARTEGNA": 22.147, "GEMONA": 28.199, "VENZONE": 34.895, "CARNIA": 39.669, "PONTEBBA": 62.576, "UGOVIZZA": 79.249, "TARVISIO": 88.790 };

const capisaldiGpsSanPoloMestre = [
    { km: 91.829, lat: 45.828970, lon: 13.221518 },
    { km: 92.224, lat: 45.828551, lon: 13.226542 },
    { km: 92.643, lat: 45.827406, lon: 13.231675 },
    { km: 103.069, lat: 45.819319, lon: 13.364175 },
    { km: 114.256, lat: 45.818401, lon: 13.503552 }
];
const capisaldiGpsUdineBivioSPolo = [ { km: 2.9, lat: 46.043658, lon: 13.272406 }, { km: 30, lat: 45.938751, lon: 13.572469 }, { km: 47.6, lat: 45.858269, lon: 13.484634 }, { km: 48.95, lat: 45.847216, lon: 13.489232 }, { km: 51.1, lat: 45.831259, lon: 13.504973 }, { km: 52.2, lat: 45.822599, lon: 13.513489 } ];
const capisaldiGpsUdineMestre = [ { km: 1, lat: 45.488092, lon: 12.222952 }, { km: 4, lat: 45.514736, lon: 12.226043 }, { km: 5, lat: 45.523635, lon: 12.227747 }, { km: 6, lat: 45.532502, lon: 12.229466 }, { km: 8, lat: 45.550450, lon: 12.232614 }, { km: 9, lat: 45.559444, lon: 12.232772 }, { km: 10, lat: 45.568426, lon: 12.232380 }, { km: 14, lat: 45.604362, lon: 12.231518 }, { km: 16, lat: 45.622234, lon: 12.232779 }, { km: 17, lat: 45.631263, lon: 12.232588 }, { km: 19, lat: 45.649205, lon: 12.232154 }, { km: 20, lat: 45.657771, lon: 12.234304 }, { km: 21, lat: 45.659592, lon: 12.246388 }, { km: 23, lat: 45.672559, lon: 12.259240 }, { km: 25, lat: 45.690633, lon: 12.262503 }, { km: 27, lat: 45.708186, lon: 12.265405 }, { km: 29, lat: 45.726534, lon: 12.267608 }, { km: 33, lat: 45.762196, lon: 12.267827 }, { km: 35, lat: 45.779674, lon: 12.265230 }, { km: 37, lat: 45.795752, lon: 12.254676 }, { km: 38, lat: 45.804635, lon: 12.251723 }, { km: 39, lat: 45.813155, lon: 12.251198 }, { km: 40, lat: 45.820622, lon: 12.258001 }, { km: 41, lat: 45.828916, lon: 12.263692 }, { km: 43, lat: 45.845420, lon: 12.273212 }, { km: 45, lat: 45.862304, lon: 12.283018 }, { km: 47, lat: 45.879249, lon: 12.291827 }, { km: 48, lat: 45.885287, lon: 12.300507 }, { km: 49, lat: 45.889654, lon: 12.311860 }, { km: 50, lat: 45.894103, lon: 12.323346 }, { km: 53, lat: 45.904810, lon: 12.358450 }, { km: 55, lat: 45.911704, lon: 12.382343 }, { km: 57, lat: 45.918573, lon: 12.406137 }, { km: 60, lat: 45.930688, lon: 12.440696 }, { km: 65, lat: 45.948531, lon: 12.498970 }, { km: 72, lat: 45.968678, lon: 12.583043 }, { km: 73, lat: 45.968050, lon: 12.595957 }, { km: 74, lat: 45.967404, lon: 12.608984 }, { km: 75, lat: 45.965754, lon: 12.622196 }, { km: 77, lat: 45.960610, lon: 12.646295 }, { km: 78, lat: 45.954923, lon: 12.655463 }, { km: 80, lat: 45.947060, lon: 12.676631 }, { km: 83, lat: 45.941725, lon: 12.713792 }, { km: 84, lat: 45.942813, lon: 12.726719 }, { km: 86, lat: 45.944980, lon: 12.752178 }, { km: 88, lat: 45.947163, lon: 12.777969 }, { km: 93, lat: 45.953200, lon: 12.841473 }, { km: 94, lat: 45.955964, lon: 12.854021 }, { km: 95, lat: 45.958618, lon: 12.865924 }, { km: 96, lat: 45.959513, lon: 12.879297 }, { km: 104, lat: 45.967025, lon: 12.980304 }, { km: 105, lat: 45.971165, lon: 12.991998 }, { km: 115, lat: 46.011938, lon: 13.107003 }, { km: 126, lat: 46.053864, lon: 13.235291 } ];
const capisaldiGpsSacileManiago = [
    { km: 0.109, lat: 45.948694, lon: 12.499869 }, { km: 1.030, lat: 45.951022, lon: 12.511178 }, { km: 1.797, lat: 45.957318, lon: 12.514461 }, { km: 2.237, lat: 45.961217, lon: 12.515192 },
    { km: 2.885, lat: 45.967063, lon: 12.516286 }, { km: 3.764, lat: 45.974838, lon: 12.517745 }, { km: 5.351, lat: 45.988944, lon: 12.520382 }, { km: 6.130, lat: 45.995963, lon: 12.521699 },
    { km: 7.303, lat: 46.006342, lon: 12.524236 }, { km: 8.394, lat: 46.015684, lon: 12.528568 }, { km: 10.971, lat: 46.033656, lon: 12.544060 }, { km: 11.385, lat: 46.035886, lon: 12.548321 },
    { km: 12.771, lat: 46.042299, lon: 12.563057 }, { km: 13.661, lat: 46.049565, lon: 12.567295 }, { km: 14.295, lat: 46.053130, lon: 12.573686 }, { km: 15.174, lat: 46.058372, lon: 12.582178 },
    { km: 15.602, lat: 46.061105, lon: 12.586069 }, { km: 16.479, lat: 46.066729, lon: 12.594048 }, { km: 16.817, lat: 46.068876, lon: 12.597141 }, { km: 17.613, lat: 46.075545, lon: 12.599545 },
    { km: 21.696, lat: 46.106393, lon: 12.623746 }, { km: 26.824, lat: 46.146379, lon: 12.654245 }, { km: 30.669, lat: 46.161823, lon: 12.698827 }, { km: 31.346, lat: 46.164535, lon: 12.706671 }
];
const capisaldiGpsMestreSantaLucia = [ { km: 259, lat: 45.479134, lon: 12.244667 }, { km: 260, lat: 45.473811, lon: 12.254119 } ];
const capisaldiGpsUdineTarvisio = [
    { km: 0.877, lat: 46.060347, lon: 13.250451 }, { km: 1.228, lat: 46.063490, lon: 13.250247 }, { km: 1.545, lat: 46.066329, lon: 13.249812 }, { km: 1.931, lat: 46.069787, lon: 13.249284 }, { km: 2.784, lat: 46.077432, lon: 13.248533 }
];
const capisaldiGpsCasarsaPortogruaro = [
    { km: 1, lat: 45.786690, lon: 12.841830 }, { km: 5, lat: 45.818891, lon: 12.864544 }, { km: 5.12, lat: 45.819977, lon: 12.865018 }, { km: 7.11, lat: 45.837223, lon: 12.872215 },
    { km: 8.55, lat: 45.849542, lon: 12.877340 }, { km: 9, lat: 45.853659, lon: 12.879057 }, { km: 9.05, lat: 45.853957, lon: 12.879185 }, { km: 10, lat: 45.862673, lon: 12.879779 },
    { km: 10.52, lat: 45.867048, lon: 12.878823 }, { km: 11.32, lat: 45.873749, lon: 12.874869 }, { km: 12.48, lat: 45.883409, lon: 12.869158 }, { km: 14.08, lat: 45.896649, lon: 12.861318 },
    { km: 14.56, lat: 45.900656, lon: 12.858753 }, { km: 15.07, lat: 45.904861, lon: 12.856061 }, { km: 15.99, lat: 45.912357, lon: 12.851657 }, { km: 16.21, lat: 45.914327, lon: 12.850540 },
    { km: 16.41, lat: 45.915947, lon: 12.849597 }, { km: 17.31, lat: 45.923603, lon: 12.845457 }, { km: 18.47, lat: 45.933350, lon: 12.840413 }, { km: 18.95, lat: 45.937503, lon: 12.838252 },
    { km: 19, lat: 45.937860, lon: 12.838066 }, { km: 19.47, lat: 45.941908, lon: 12.835968 }, { km: 19.65, lat: 45.943406, lon: 12.835121 }, { km: 20.10, lat: 45.947145, lon: 12.833013 }
];
const capisaldiGpsUdinePalmanova = [
    { km: 1.312, lat: 46.049154, lon: 13.230233 }, { km: 2.043, lat: 46.042545, lon: 13.232947 }, { km: 6.917, lat: 46.000420, lon: 13.250343 }, { km: 7.415, lat: 45.996170, lon: 13.252086 },
    { km: 7.969, lat: 45.991211, lon: 13.254121 }, { km: 10.290, lat: 45.971503, lon: 13.263925 }, { km: 11.359, lat: 45.962681, lon: 13.269401 }, { km: 12.440, lat: 45.953757, lon: 13.274941 },
    { km: 14.493, lat: 45.936771, lon: 13.285482 }, { km: 14.954, lat: 45.932982, lon: 13.287819 }, { km: 16.525, lat: 45.922562, lon: 13.292227 }
];
const capisaldiGpsPalmanovaCervignano = [
    { km: 0.769, lat: 45.900110, lon: 13.298720 }, { km: 1.244, lat: 45.896091, lon: 13.300826 }, { km: 2.283, lat: 45.887181, lon: 13.304807 }, { km: 3.295, lat: 45.878318, lon: 13.307825 }
];
