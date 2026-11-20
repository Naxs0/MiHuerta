// =====================================================================
//  ETIQUETA VERDE
//  Clasificación toxicológica: SAG, Resolución 2196/2000 (criterios OMS).
//  Productos: SAG, Lista Nº 45 de insumos visados para agricultura
//  orgánica (diciembre 2022), donde figuran como "Toxicidad: IV Verde".
// =====================================================================
const FRANJAS = [
  { clase: "IV", color: "Verde", hex: "#2e7d32", nombre: "Productos que normalmente no ofrecen peligro",
    dl50: "DL50 oral sobre 2.000 mg/kg (sólidos) o 3.000 mg/kg (líquidos)" },
  { clase: "III", color: "Azul", hex: "#1565c0", nombre: "Poco peligroso",
    dl50: "DL50 oral 500–2.000 (sólidos) o 2.000–3.000 (líquidos)" },
  { clase: "II", color: "Amarilla", hex: "#f9a825", nombre: "Moderadamente peligroso",
    dl50: "DL50 oral 50–500 (sólidos) o 200–2.000 (líquidos)" },
  { clase: "Ia / Ib", color: "Roja", hex: "#c62828", nombre: "Sumamente / Muy peligroso",
    dl50: "DL50 oral 50 o menos (sólidos) o 200 o menos (líquidos)" },
];

// bio: true = controlador biológico (microorganismo o insecto benéfico)
const VERDES = {
  azufre: { nombre: "Azufre", tipo: "Fungicida / acaricida",
    ejemplos: "Kumulus S, Thiolux WG, Acoidal WG, Sulfur 80% WG, Microthiol Disperss, Azufre Mojable Urkabe",
    nota: "No aplicar sobre 28–30 °C ni dentro de 3 semanas de un aceite (quema las hojas)." },
  aceite: { nombre: "Aceite mineral / parafínico", tipo: "Insecticida / acaricida",
    ejemplos: "Citroliv Emulsible y Miscible, Ultraspray, Pure Spray Green, Argenfrut Supreme Green",
    nota: "Actúa por contacto: mojar bien. No mezclar con azufre ni aplicar con calor fuerte." },
  spinosad: { nombre: "Spinosad", tipo: "Insecticida", ejemplos: "Entrust",
    nota: "Aplicar al atardecer: es tóxico para abejas mientras está mojado." },
  cobre: { nombre: "Cobre (caldo bordelés, hidróxido, óxido cuproso)", tipo: "Fungicida / bactericida",
    ejemplos: "Caldo Bordelés Vallés, Cuprobordoles, Hidro-Cup WG, Cuprodul WG, Nordox Super 75 WG, Fungicup WG/WP",
    nota: "⚠️ No todos los cobres son verdes: Oxicup, Hidroxicobre 35/50 % y Cuproso 50 % son de etiqueta AZUL." },
  bicarbonato: { nombre: "Bicarbonato de potasio", tipo: "Fungicida", ejemplos: "Kaligreen Top",
    nota: "Preventivo y curativo temprano. Repetir cada 7–10 días." },
  citricos: { nombre: "Extracto de cítricos / toronja", tipo: "Fungicida / bactericida",
    ejemplos: "Citrus SL, Citrus Dust, Fungastop Dust, BC-1000", nota: "Preventivo; repetir después de lluvias." },
  arbol_te: { nombre: "Aceite de árbol del té", tipo: "Fungicida", ejemplos: "Timorex Gold", nota: "Oídio, botritis y mildiú." },
  neem: { nombre: "Neem (azadiractina)", tipo: "Insecticida", ejemplos: "Neem-X",
    nota: "Efecto lento (2–3 días): repelente y frena el desarrollo de la plaga." },
  capsaicina: { nombre: "Capsaicina (extracto de ají)", tipo: "Insecticida / acaricida",
    ejemplos: "Biocap, Biocapsaicin 500 EC, Akarofin 370 EC", nota: "Repelente. Usar guantes y no tocarse los ojos." },
  quillay: { nombre: "Extracto de quillay (saponinas)", tipo: "Nematicida / acaricida / insecticida", ejemplos: "QL Agri 35",
    nota: "Producto a base del quillay chileno (Quillaja saponaria)." },
  esenciales: { nombre: "Aceites vegetales y esenciales", tipo: "Insecticida / acaricida",
    ejemplos: "Bioil Spray (linaza), Biomite (geraniol), Protek (limoneno)", nota: "Contacto: mojar bien el envés de las hojas." },
  feromona: { nombre: "Feromonas (trampas y confusión sexual)", tipo: "Monitoreo / confusión",
    ejemplos: "Tuta Stop (polilla del tomate), Pherocon CM, Isomate C+, Puffer CM (polilla de la manzana)",
    nota: "No mata por sí sola: detecta la plaga y reduce los apareamientos." },
  bt: { bio: true, nombre: "Bacillus thuringiensis (Bt)", tipo: "Biológico · insecticida", ejemplos: "B.T.O., BETK-03",
    nota: "Solo afecta larvas de polillas y cuncunillas que comen hojas. Aplicar al atardecer." },
  beauveria: { bio: true, nombre: "Beauveria bassiana (hongo)", tipo: "Biológico · insecticida", ejemplos: "Cepas INIA",
    nota: "Necesita humedad: aplicar al atardecer. No mezclar con fungicidas." },
  metarhizium: { bio: true, nombre: "Metarhizium anisopliae (hongo)", tipo: "Biológico · plagas de suelo", ejemplos: "Metagram",
    nota: "Para larvas en el suelo (gusano blanco, burrito)." },
  nematodos: { bio: true, nombre: "Nematodos benéficos (Steinernema feltiae)", tipo: "Biológico · plagas de suelo",
    ejemplos: "Entonem, Capirel, Nemaplus", nota: "Aplicar con el suelo húmedo y al atardecer." },
  trichoderma: { bio: true, nombre: "Trichoderma (hongo benéfico)", tipo: "Biológico · enfermedades de raíz",
    ejemplos: "Bio-Fit y otros", nota: "Preventivo: al trasplante y por el riego." },
  bsubtilis: { bio: true, nombre: "Bacillus subtilis", tipo: "Biológico · fungicida", ejemplos: "B.S. y otros",
    nota: "Preventivo para botritis y oídio." },
  paecilomyces: { bio: true, nombre: "Paecilomyces lilacinus (hongo)", tipo: "Biológico · nematicida", ejemplos: "Conbiol 4-WP",
    nota: "Para nematodos de la raíz." },
  chrysoperla: { bio: true, nombre: "Crisopas (Chrysoperla)", tipo: "Biológico · insecto benéfico", ejemplos: "Liberación de crisopas",
    nota: "Sus larvas comen pulgones, mosquita blanca y huevos de polillas." },
  cryptolaemus: { bio: true, nombre: "Cryptolaemus (chinita depredadora)", tipo: "Biológico · insecto benéfico",
    ejemplos: "Liberación de Cryptolaemus", nota: "Especialista en chanchito blanco." },
};

// Qué opciones sirven para cada plaga (según palabras de su nombre)
const VERDE_POR_PLAGA = [
  [/pulg[oó]n|pulguilla/i, ["neem", "capsaicina", "aceite", "beauveria", "chrysoperla"]],
  [/ara[ñn]ita|[aá]caro/i, ["azufre", "aceite", "capsaicina", "esenciales", "quillay"]],
  [/o[ií]dio/i, ["azufre", "bicarbonato", "citricos", "arbol_te", "bsubtilis"]],
  [/mildi[uú]/i, ["cobre", "citricos", "arbol_te"]],
  [/botr|pudrici[oó]n gris/i, ["bicarbonato", "citricos", "arbol_te", "bsubtilis", "trichoderma"]],
  [/mosquita/i, ["aceite", "neem", "capsaicina", "beauveria", "chrysoperla"]],
  [/trips/i, ["spinosad", "neem", "beauveria"]],
  [/cortador/i, ["bt", "nematodos"]],
  [/tuta|polilla del tomate/i, ["feromona", "bt", "spinosad", "neem"]],
  [/polilla de la manzana/i, ["feromona", "bt"]],
  [/polilla de la (papa|col)|cuncunilla|gusano del (choclo|fruto)/i, ["bt", "spinosad", "neem"]],
  [/chanchito/i, ["aceite", "cryptolaemus"]],
  [/conchuela|escama/i, ["aceite"]],
  [/mosca de la fruta|drosophila/i, ["spinosad"]],
  [/mosca de la (zanahoria|cebolla|semilla)/i, ["nematodos"]],
  [/burrito|gusano blanco/i, ["nematodos", "metarhizium", "beauveria"]],
  [/nematodo/i, ["quillay", "paecilomyces"]],
  [/phytophthora|cuello|marchitez/i, ["trichoderma", "cobre"]],
  [/esclerotinia|pudrici[oó]n blanca/i, ["trichoderma"]],
  [/roya/i, ["azufre"]],
  [/tiz[oó]n|alternaria|cercospora|septoria|antracnosis|venturia|cloca|repilo|c[aá]ncer|mancha chocolate/i, ["cobre"]],
];

function verdesPara(plaga) {
  const ids = new Set();
  for (const [re, lista] of VERDE_POR_PLAGA) if (re.test(plaga.nombre)) lista.forEach((x) => ids.add(x));
  return [...ids];
}
