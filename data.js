// =====================================================================
//  Mi Huerta — base de datos agronómica (orientada a Chile / hemisferio sur)
// =====================================================================

// ET0 = evapotranspiración de referencia (mm/día) y lluvia normal (mm/mes), enero..diciembre.
// Se usan en modo MANUAL. En modo automático se usan los datos reales de la ubicación.
const ZONAS = {
  norte:      { nombre: "Norte (seco y caluroso)",  hongos: false, heladas: false,
                et0: [6.5, 6.0, 5.0, 3.8, 2.8, 2.2, 2.4, 3.0, 4.0, 5.0, 6.0, 6.5],
                lluvia: [0, 0, 0, 1, 4, 6, 6, 3, 1, 0, 0, 0] },
  valle:      { nombre: "Valle central / interior", hongos: false, heladas: true,
                et0: [6.5, 5.6, 4.2, 2.6, 1.4, 0.9, 1.0, 1.6, 2.6, 3.8, 5.1, 6.2],
                lluvia: [1, 2, 4, 14, 55, 80, 75, 50, 20, 12, 6, 3] },
  costa:      { nombre: "Costa (húmeda, neblina)",  hongos: true, heladas: false,
                et0: [4.5, 4.0, 3.2, 2.2, 1.3, 1.0, 1.0, 1.5, 2.2, 3.0, 3.8, 4.4],
                lluvia: [1, 1, 5, 20, 80, 110, 95, 60, 25, 12, 5, 2] },
  sur:        { nombre: "Sur (lluvioso y fresco)",  hongos: true, heladas: true,
                et0: [4.5, 3.8, 2.6, 1.4, 0.7, 0.4, 0.5, 0.9, 1.6, 2.6, 3.5, 4.3],
                lluvia: [70, 70, 95, 140, 230, 240, 210, 170, 120, 100, 85, 80] },
  cordillera: { nombre: "Precordillera / altura",   hongos: false, heladas: true,
                et0: [5.5, 4.8, 3.6, 2.2, 1.2, 0.8, 0.8, 1.3, 2.2, 3.3, 4.4, 5.3],
                lluvia: [5, 5, 10, 30, 100, 130, 120, 90, 45, 25, 12, 8] },
};

// factor = cuánto reduce la evaporación la sombra/nubosidad
const SOL = {
  sol:     { nombre: "Pleno sol",              icono: "☀️", factor: 1.0,  ciclo: 1.0,  hongos: false },
  mixto:   { nombre: "Sol y a veces nublado",  icono: "⛅", factor: 0.9,  ciclo: 1.08, hongos: true  },
  nublado: { nombre: "Nublado / sombra",       icono: "☁️", factor: 0.75, ciclo: 1.15, hongos: true  },
};

// au = agua útil que retiene el suelo (mm por metro de profundidad)
const SUELOS = {
  arenoso:   { nombre: "Arenoso (se seca rápido)", icono: "🏖️", au: 70,  cal: 150, azufre: 40 },
  franco:    { nombre: "Normal / no sé",           icono: "🟫", au: 140, cal: 250, azufre: 70 },
  arcilloso: { nombre: "Arcilloso (se apelmaza)",  icono: "🧱", au: 180, cal: 350, azufre: 100 },
};

const METODOS = {
  goteo:     { nombre: "Goteo / cinta",     icono: "💧", ef: 0.9 },
  aspersion: { nombre: "Aspersor",          icono: "🌦️", ef: 0.75 },
  manguera:  { nombre: "Manguera / surco",  icono: "🚿", ef: 0.65 },
};

const EDADES = {
  joven:   { nombre: "Joven (1–2 años)",  factor: 0.3 },
  mediana: { nombre: "Mediana (3–5 años)", factor: 0.6 },
  adulta:  { nombre: "Adulta (6+ años)",   factor: 1.0 },
};

// Fertilizantes: % de N, P2O5, K2O, CaO, MgO
const FERT = {
  sft:  { nombre: "Superfosfato triple (0-46-0)",     P: 46 },
  map:  { nombre: "Fosfato monoamónico MAP (12-61-0)", N: 12, P: 61, soluble: true },
  sk:   { nombre: "Sulfato de potasio (0-0-50)",       K: 50, soluble: true },
  nk:   { nombre: "Nitrato de potasio (13-0-46)",      N: 13, K: 46, soluble: true },
  nca:  { nombre: "Nitrato de calcio (15,5-0-0 + 26% CaO)", N: 15.5, Ca: 26.5, soluble: true },
  urea: { nombre: "Urea (46-0-0)",                     N: 46, soluble: true },
  sa:   { nombre: "Sulfato de amonio (21-0-0)",        N: 21, soluble: true },
  mgs:  { nombre: "Sulfato de magnesio (16% MgO)",     Mg: 16, soluble: true },
};

// Equivalentes orgánicos aproximados
const ORGANICOS = {
  N: { nombre: "Guano de gallina compostado", pct: 2.5 },
  P: { nombre: "Harina de huesos",             pct: 20 },
  K: { nombre: "Ceniza de madera",             pct: 6 },
};

// Reparto (%) de cada nutriente por etapa según el tipo de cultivo
const PERFILES = {
  fruto:   { N: [10, 30, 25, 35], P: [50, 20, 20, 10], K: [10, 20, 25, 45], Ca: [10, 20, 30, 40], Mg: [20, 30, 25, 25] },
  hoja:    { N: [15, 50, 35, 0],  P: [55, 30, 15, 0],  K: [15, 40, 45, 0],  Ca: [15, 40, 45, 0],  Mg: [20, 40, 40, 0] },
  raiz:    { N: [20, 50, 25, 5],  P: [50, 25, 20, 5],  K: [15, 25, 35, 25], Ca: [15, 35, 35, 15], Mg: [20, 35, 30, 15] },
  legum:   { N: [40, 40, 20, 0],  P: [60, 20, 20, 0],  K: [20, 30, 40, 10], Ca: [20, 30, 40, 10], Mg: [20, 30, 40, 10] },
  grano:   { N: [10, 45, 35, 10], P: [50, 25, 20, 5],  K: [15, 40, 35, 10], Ca: [10, 40, 40, 10], Mg: [15, 40, 35, 10] },
  caduco:  { N: [30, 20, 30, 20, 0], P: [30, 30, 20, 20, 0], K: [10, 15, 55, 20, 0], Ca: [20, 40, 40, 0, 0], Mg: [25, 25, 30, 20, 0] },
  siempre: { N: [25, 20, 25, 20, 10], P: [25, 25, 20, 20, 10], K: [10, 15, 40, 25, 10], Ca: [20, 40, 30, 10, 0], Mg: [20, 20, 30, 20, 10] },
};

// Microelementos (aplicación foliar). etapas = índices de etapa donde se aplican.
const MICRO = {
  B:  { nombre: "Boro (B)", producto: "Ácido bórico o Solubor", gL: 1, etapas: [1, 2],
        para: "Cuaja de flores y frutos bien formados.", sintomas: "Flores que se caen, frutos deformes o agrietados, tallos huecos." },
  Zn: { nombre: "Zinc (Zn)", producto: "Sulfato de zinc", gL: 2, etapas: [0, 1],
        para: "Brotes y hojas de tamaño normal.", sintomas: "Hojas nuevas chicas y amarillas, en roseta, entrenudos cortos." },
  Fe: { nombre: "Hierro (Fe)", producto: "Quelato de hierro (EDDHA)", gL: 0.5, etapas: [0, 1, 2],
        para: "Verde de las hojas (clorofila).", sintomas: "Hojas nuevas amarillas con los nervios verdes. Común en suelos calcáreos (pH alto)." },
  Mg: { nombre: "Magnesio (Mg)", producto: "Sulfato de magnesio (sal de Epsom)", gL: 10, etapas: [1, 2, 3],
        para: "Clorofila y llenado de frutos.", sintomas: "Hojas viejas amarillas entre los nervios, de abajo hacia arriba." },
  Ca: { nombre: "Calcio (Ca)", producto: "Cloruro o nitrato de calcio", gL: 4, etapas: [2, 3],
        para: "Firmeza de frutos y bordes sanos de las hojas.", sintomas: "Pudrición apical (culo negro), bordes quemados en lechuga, manchas en manzanas (bitter pit)." },
  Mn: { nombre: "Manganeso (Mn)", producto: "Sulfato de manganeso", gL: 2, etapas: [1],
        para: "Fotosíntesis.", sintomas: "Manchas amarillas entre nervios en hojas nuevas, con nervios verdes gruesos." },
  Mo: { nombre: "Molibdeno (Mo)", producto: "Molibdato de sodio", gL: 0.5, etapas: [0, 1],
        para: "Uso del nitrógeno (repollos, coliflor, porotos).", sintomas: "Hojas angostas tipo 'cola de látigo' en coliflor, hojas pálidas." },
};

// Guía de deficiencias (para diagnóstico)
const DEFICIENCIAS = [
  { n: "Nitrógeno (N)",  s: "Planta pálida, hojas viejas amarillas parejo, crece poco.", f: "Urea o nitrato; orgánico: guano o purín de ortiga." },
  { n: "Fósforo (P)",    s: "Hojas verde oscuro con tonos morados/rojizos, raíces débiles, poca flor.", f: "MAP o superfosfato; orgánico: harina de huesos o guano rojo. Suelo frío lo bloquea." },
  { n: "Potasio (K)",    s: "Bordes de hojas viejas quemados (café), frutos chicos y sin sabor.", f: "Sulfato o nitrato de potasio; orgánico: ceniza." },
  { n: "Calcio (Ca)",    s: "Punta del fruto negra (culo negro), bordes de hojas nuevas quemados.", f: "Nitrato de calcio y riego parejo (sin calcio en agua no sube)." },
  { n: "Magnesio (Mg)",  s: "Amarillo entre nervios en hojas viejas, nervios verdes.", f: "Sulfato de magnesio 10 g/L foliar o 20 g/m² al suelo." },
  { n: "Azufre (S)",     s: "Hojas nuevas amarillas parejo (como el N pero arriba).", f: "Sulfato de potasio, de amonio o de magnesio." },
  { n: "Hierro (Fe)",    s: "Hojas nuevas amarillas con nervios bien verdes.", f: "Quelato de hierro; bajar pH con azufre o materia orgánica." },
  { n: "Zinc (Zn)",      s: "Hojas nuevas chicas, en roseta, manchadas.", f: "Sulfato de zinc 2 g/L foliar en brotación." },
  { n: "Boro (B)",       s: "Brotes muertos, flores que caen, frutos deformes, tallos huecos.", f: "Ácido bórico 1 g/L foliar antes de floración. ¡No exceder: es tóxico!" },
  { n: "Manganeso (Mn)", s: "Moteado amarillo en hojas nuevas.", f: "Sulfato de manganeso 2 g/L foliar." },
];

// Plagas y enfermedades comunes (se referencian por clave)
const PLAGAS = {
  pulgon:   { nombre: "Pulgones", sintomas: "Bichitos verdes o negros en brotes; hojas enrolladas y pegajosas.", org: "Jabón potásico, purín de ortiga o ajo, chinitas.", quim: "Pirimicarb." },
  aranita:  { nombre: "Arañita roja", sintomas: "Puntitos amarillos en las hojas y telitas finas debajo.", org: "Agua a presión, jabón potásico o aceite de neem cada 7 días.", quim: "Abamectina." },
  oidio:    { nombre: "Oídio", hongo: true, sintomas: "Polvillo blanco sobre las hojas.", org: "Bicarbonato 5 g/L o leche diluida 1:9.", quim: "Azufre mojable." },
  mildiu:   { nombre: "Mildiú", hongo: true, sintomas: "Manchas amarillas arriba y pelusa gris o violácea debajo de la hoja.", org: "Caldo bordelés, regar al pie, ventilar.", quim: "Fungicida cúprico o metalaxil + mancozeb." },
  botritis: { nombre: "Pudrición gris (Botrytis)", hongo: true, sintomas: "Moho gris en flores y frutos, que se ablandan.", org: "Ventilar, no mojar la planta, sacar partes enfermas.", quim: "Fenhexamid o boscalid." },
  babosas:  { nombre: "Babosas y caracoles", sintomas: "Hojas comidas con rastro brillante.", org: "Trampas de cerveza, recoger de noche, ceniza alrededor.", quim: "Cebo de fosfato férrico (seguro para mascotas)." },
  mosquita: { nombre: "Mosquita blanca", sintomas: "Mosquitas blancas debajo de las hojas, hojas pegajosas.", org: "Trampas amarillas, jabón potásico, neem.", quim: "Acetamiprid." },
  trips:    { nombre: "Trips", sintomas: "Hojas plateadas con puntitos negros.", org: "Trampas azules, neem, jabón potásico.", quim: "Spinosad." },
  cortador: { nombre: "Gusano cortador", sintomas: "Plantas cortadas a ras del suelo de un día para otro.", org: "Collar de cartón, buscar la larva bajo tierra en la noche.", quim: "Cebo insecticida autorizado." },
  cuncunilla:{ nombre: "Cuncunillas / gusanos de la hoja", sintomas: "Hojas comidas con agujeros grandes, excremento verde.", org: "Bacillus thuringiensis (Bt), sacar a mano.", quim: "Spinosad." },
  polilla_col:{ nombre: "Polilla de la col", sintomas: "Hojas con ventanitas y agujeros, larvas verdes chicas.", org: "Bacillus thuringiensis (Bt), malla antiinsectos.", quim: "Spinosad." },
  pajaros:  { nombre: "Pájaros", sintomas: "Frutos o semillas picoteados.", org: "Malla, cintas reflectantes, espantapájaros.", quim: "—" },
  chanchito:{ nombre: "Chanchito blanco", sintomas: "Algodoncitos blancos en ramas y frutos; fumagina negra.", org: "Aceite mineral en invierno, alcohol con algodón, controlar hormigas.", quim: "Aceite mineral + insecticida autorizado." },
  escama:   { nombre: "Conchuelas / escamas", sintomas: "Escamitas pegadas en ramas y hojas, fumagina.", org: "Aceite mineral 1–2% en invierno, cepillar.", quim: "Aceite mineral." },
  mosca_fruta:{ nombre: "Mosca de la fruta / Drosophila", sintomas: "Frutos maduros con larvas y blandos.", org: "Trampas con vinagre de manzana, cosechar seguido, sacar fruta caída.", quim: "Spinosad en cebo." },
  pud_cuello:{ nombre: "Pudrición del cuello (Phytophthora)", hongo: true, sintomas: "La planta se marchita, base del tallo oscura y blanda.", org: "No encharcar, plantar en camellón, buen drenaje.", quim: "Fosetil-aluminio o metalaxil." },
  roya:     { nombre: "Roya", hongo: true, sintomas: "Pústulas anaranjadas o color óxido en las hojas.", org: "Azufre, buena distancia entre plantas.", quim: "Tebuconazol." },
  hernia:   { nombre: "Hernia de las crucíferas", hongo: true, sintomas: "Raíces hinchadas como tumores, planta marchita a mediodía.", org: "Encalar a pH 7, rotar 5 años.", quim: "Sin control químico casero." },
};

// ---------------------------------------------------------------------
//  CULTIVOS
//  kc: coeficiente de cultivo por etapa (FAO-56). zr: profundidad de raíces (m).
//  req: kg/ha por temporada (anuales) o g por planta adulta al año (frutales) de N, P2O5, K2O, CaO, MgO.
// ---------------------------------------------------------------------
const E = (nombre, icono, d0, d1, ...tareas) => ({ nombre, icono, dias: [d0, d1], tareas });
const M = (nombre, icono, m0, m1, ...tareas) => ({ nombre, icono, meses: [m0, m1], tareas });

const CULTIVOS = [
  // ============ VERDURAS DE FRUTO ============
  { id: "frutilla", nombre: "Frutilla", emoji: "🍓", cat: "fruta", perfil: "fruto",
    temp: [5, 15, 25, 30], ph: [5.5, 6.5], plantasM2: 6, zr: 0.3, p: 0.3,
    kc: [0.4, 0.7, 0.85, 0.85], req: { N: 150, P: 80, K: 200, Ca: 60, Mg: 25 }, micro: ["B", "Ca", "Fe"],
    suelo: "Franco-arenoso, bien drenado y con mucha materia orgánica. Ideal en camellón con mulch.",
    luz: "Pleno sol, mínimo 6–8 horas.", necesitaSol: true,
    distancia: "30 cm entre plantas, hilera doble en camellón de 70–80 cm",
    epoca: "Plantar en marzo–abril (otoño) o julio–agosto (planta frigo). Cosecha de noviembre a febrero.",
    etapas: [
      E("Plantación y arraigo", "🌱", 0, 30, "No enterrar la corona", "Riego diario suave los primeros 10 días", "Poner mulch"),
      E("Primeras hojas", "🌿", 30, 75, "Cortar estolones (guías)", "Sacar malezas"),
      E("Floración", "🌸", 75, 110, "Regar al pie sin mojar flores", "Revisar botritis"),
      E("Fruto y cosecha", "🍓", 110, 240, "Cosechar cada 2–3 días", "Retirar frutos dañados")],
    plagas: ["aranita", "pulgon", "botritis", "oidio", "babosas", "trips",
      { nombre: "Burrito de la frutilla", sintomas: "Plantas marchitas, larvas blancas en raíces, hojas mordidas en el borde.", org: "Nematodos entomopatógenos o Beauveria al suelo.", quim: "Insecticida de suelo autorizado." }] },

  { id: "tomate", nombre: "Tomate", emoji: "🍅", cat: "verdura", perfil: "fruto",
    temp: [10, 20, 27, 35], ph: [6.0, 6.8], plantasM2: 2, zr: 0.7,
    kc: [0.6, 0.85, 1.15, 1.0], req: { N: 250, P: 120, K: 350, Ca: 150, Mg: 40 }, micro: ["Ca", "B", "Mg"],
    suelo: "Franco, profundo y con buena materia orgánica.", luz: "Pleno sol, 8 horas o más.", necesitaSol: true,
    distancia: "50 cm entre plantas y 1 m entre hileras",
    epoca: "Almácigo en agosto–septiembre, trasplante en octubre–noviembre (después de las heladas).",
    etapas: [
      E("Trasplante y arraigo", "🌱", 0, 20, "Plantar un poco más hondo", "Regar día por medio la primera semana"),
      E("Primeras hojas", "🌿", 20, 45, "Poner tutores", "Sacar chupones (brotes laterales)"),
      E("Floración y cuaja", "🌼", 45, 70, "Riego parejo (evita el culo negro)", "Mover las plantas para polinizar"),
      E("Fruto y cosecha", "🍅", 70, 150, "Sacar hojas bajas", "Cosechar al cambiar de color")],
    plagas: [{ nombre: "Polilla del tomate (Tuta absoluta)", sintomas: "Galerías transparentes en hojas, frutos con agujeritos.", org: "Trampas de feromona, Bacillus thuringiensis.", quim: "Spinosad o clorantraniliprol." },
      "mosquita", "pulgon",
      { nombre: "Tizón tardío", hongo: true, sintomas: "Manchas cafés aceitosas en hojas y frutos, avanza rápido con humedad.", org: "No mojar el follaje, caldo bordelés preventivo.", quim: "Cúprico o mancozeb preventivo." },
      "oidio",
      { nombre: "Culo negro (pudrición apical)", sintomas: "Mancha negra hundida en la punta del fruto. Falta calcio por riego irregular.", org: "Riego parejo, mulch.", quim: "Nitrato de calcio." }] },

  { id: "pimenton", nombre: "Pimentón / Ají", emoji: "🌶️", cat: "verdura", perfil: "fruto",
    temp: [12, 20, 28, 33], ph: [6.0, 7.0], plantasM2: 3, zr: 0.5,
    kc: [0.6, 0.8, 1.05, 0.95], req: { N: 200, P: 100, K: 280, Ca: 120, Mg: 30 }, micro: ["Ca", "B", "Mg"],
    suelo: "Franco, bien drenado (no tolera encharcamiento).", luz: "Pleno sol.", necesitaSol: true,
    distancia: "40 cm entre plantas y 80 cm entre hileras",
    epoca: "Almácigo julio–agosto, trasplante octubre–noviembre.",
    etapas: [
      E("Trasplante", "🌱", 0, 20, "Trasplantar en la tarde y regar enseguida"),
      E("Primeras hojas", "🌿", 20, 50, "Tutor si es variedad alta"),
      E("Floración y cuaja", "🌼", 50, 80, "Riego parejo para que no bote flores"),
      E("Fruto y cosecha", "🫑", 80, 180, "Cosechar con tijera")],
    plagas: ["pulgon", "trips", "aranita", "cuncunilla", "pud_cuello"] },

  { id: "berenjena", nombre: "Berenjena", emoji: "🍆", cat: "verdura", perfil: "fruto",
    temp: [12, 22, 30, 35], ph: [5.5, 6.8], plantasM2: 2, zr: 0.7,
    kc: [0.6, 0.8, 1.05, 0.9], req: { N: 180, P: 90, K: 250, Ca: 80, Mg: 30 }, micro: ["Ca", "Mg", "B"],
    suelo: "Franco, profundo y bien drenado.", luz: "Pleno sol, mucho calor.", necesitaSol: true,
    distancia: "60 cm entre plantas y 1 m entre hileras",
    epoca: "Almácigo en agosto, trasplante en octubre–noviembre.",
    etapas: [
      E("Trasplante", "🌱", 0, 20, "Plantar con suelo tibio"),
      E("Primeras hojas", "🌿", 20, 50, "Poner tutor"),
      E("Floración", "🌸", 50, 75, "Riego parejo"),
      E("Fruto y cosecha", "🍆", 75, 170, "Cosechar cuando estén brillantes")],
    plagas: ["aranita", "pulgon", "mosquita", "trips",
      { nombre: "Pulguilla", sintomas: "Hojas con muchos agujeritos pequeños.", org: "Malla, tierra de diatomeas, riego frecuente.", quim: "Insecticida autorizado." }] },

  { id: "zapallo", nombre: "Zapallo italiano", emoji: "🥒", cat: "verdura", perfil: "fruto",
    temp: [10, 18, 28, 35], ph: [6.0, 7.0], plantasM2: 1.2, zr: 0.8,
    kc: [0.5, 0.75, 1.0, 0.9], req: { N: 150, P: 80, K: 200, Ca: 60, Mg: 20 }, micro: ["B", "Mg"],
    suelo: "Franco con mucha materia orgánica.", luz: "Pleno sol.", necesitaSol: true,
    distancia: "80 cm entre plantas y 1 m entre hileras", epoca: "Siembra de octubre a diciembre.",
    etapas: [
      E("Siembra", "🌱", 0, 15, "2 semillas por hoyo a 3 cm"),
      E("Primeras hojas", "🌿", 15, 35, "Mulch alrededor"),
      E("Floración", "🌼", 35, 50, "Si no cuajan, polinizar con pincel"),
      E("Fruto y cosecha", "🥒", 50, 120, "Cosechar a los 15–20 cm, cada 2–3 días")],
    plagas: ["oidio", "pulgon", "mosquita", "aranita"] },

  { id: "pepino", nombre: "Pepino", emoji: "🥒", cat: "verdura", perfil: "fruto",
    temp: [12, 20, 28, 35], ph: [6.0, 7.0], plantasM2: 2.5, zr: 0.6,
    kc: [0.6, 0.8, 1.0, 0.9], req: { N: 160, P: 80, K: 220, Ca: 80, Mg: 25 }, micro: ["Mg", "B", "Ca"],
    suelo: "Franco, suelto y con materia orgánica.", luz: "Pleno sol.", necesitaSol: true,
    distancia: "40 cm entre plantas, 1 m entre hileras, con malla", epoca: "Siembra de octubre a diciembre.",
    etapas: [
      E("Siembra", "🌱", 0, 15, "Sembrar a 2–3 cm"),
      E("Primeras hojas", "🌿", 15, 35, "Guiar por la malla"),
      E("Floración", "🌼", 35, 50, "Riego parejo, sin encharcar"),
      E("Fruto y cosecha", "🥒", 50, 110, "Cosechar seguido")],
    plagas: ["oidio", "mildiu", "aranita", "pulgon", "trips"] },

  { id: "melon", nombre: "Melón", emoji: "🍈", cat: "fruta", perfil: "fruto",
    temp: [12, 22, 30, 38], ph: [6.0, 7.0], plantasM2: 0.8, zr: 1.0,
    kc: [0.5, 0.75, 1.05, 0.75], req: { N: 150, P: 80, K: 250, Ca: 60, Mg: 30 }, micro: ["B", "Mg"],
    suelo: "Franco-arenoso, bien drenado, que se caliente rápido.", luz: "Pleno sol, mucho calor.", necesitaSol: true,
    distancia: "1 m entre plantas y 1,5 m entre hileras", epoca: "Siembra de octubre a noviembre.",
    etapas: [
      E("Siembra", "🌱", 0, 20, "Sembrar con suelo tibio (sobre 15 °C)"),
      E("Guías y hojas", "🌿", 20, 45, "Despuntar la guía principal a las 4–5 hojas"),
      E("Floración y cuaja", "🌼", 45, 65, "No dejar sin agua"),
      E("Fruto y maduración", "🍈", 65, 110, "Bajar el riego al madurar (más dulce)", "Cosechar cuando se desprende solo")],
    plagas: ["oidio", "pulgon", "aranita", "mosquita", "mildiu"] },

  { id: "sandia", nombre: "Sandía", emoji: "🍉", cat: "fruta", perfil: "fruto",
    temp: [15, 22, 30, 38], ph: [5.8, 7.0], plantasM2: 0.5, zr: 1.0,
    kc: [0.4, 0.7, 1.0, 0.75], req: { N: 130, P: 80, K: 220, Ca: 60, Mg: 25 }, micro: ["B", "Mg"],
    suelo: "Arenoso o franco-arenoso, profundo.", luz: "Pleno sol, mucho calor.", necesitaSol: true,
    distancia: "1,2 m entre plantas y 2 m entre hileras", epoca: "Siembra de octubre a noviembre.",
    etapas: [
      E("Siembra", "🌱", 0, 20, "Sembrar con suelo tibio"),
      E("Guías y hojas", "🌿", 20, 50, "Ordenar las guías"),
      E("Floración y cuaja", "🌼", 50, 70, "Dejar 2–3 frutos por planta"),
      E("Fruto y maduración", "🍉", 70, 120, "Reducir riego al final", "Madura cuando se seca el zarcillo junto al fruto")],
    plagas: ["pulgon", "aranita", "oidio", "trips"] },

  { id: "zapallo_guarda", nombre: "Zapallo de guarda", emoji: "🎃", cat: "verdura", perfil: "fruto",
    temp: [10, 18, 28, 35], ph: [6.0, 7.0], plantasM2: 0.4, zr: 1.0,
    kc: [0.5, 0.75, 1.0, 0.8], req: { N: 120, P: 80, K: 200, Ca: 50, Mg: 20 }, micro: ["B", "Mg"],
    suelo: "Franco con mucha materia orgánica.", luz: "Pleno sol.", necesitaSol: true,
    distancia: "1,5 m entre plantas y 2 m entre hileras", epoca: "Siembra de octubre a noviembre. Cosecha en otoño.",
    etapas: [
      E("Siembra", "🌱", 0, 20, "Una pala de compost por hoyo"),
      E("Guías y hojas", "🌿", 20, 55, "Mulch y control de malezas"),
      E("Floración", "🌼", 55, 75, "Polinizar a mano si hace falta"),
      E("Fruto y maduración", "🎃", 75, 150, "Cosechar con el pedúnculo seco y dejar curar al sol")],
    plagas: ["oidio", "pulgon", "mosquita", "aranita"] },

  { id: "choclo", nombre: "Choclo / Maíz", emoji: "🌽", cat: "verdura", perfil: "grano",
    temp: [10, 20, 30, 35], ph: [6.0, 7.0], plantasM2: 5.5, zr: 0.9,
    kc: [0.3, 0.7, 1.2, 1.05], req: { N: 200, P: 80, K: 120, Ca: 20, Mg: 20 }, micro: ["Zn", "B"],
    suelo: "Franco, profundo y fértil.", luz: "Pleno sol.", necesitaSol: true,
    distancia: "25 cm entre plantas y 70 cm entre hileras",
    epoca: "Siembra de octubre a diciembre, en bloque de varias hileras.",
    etapas: [
      E("Siembra y emergencia", "🌱", 0, 20, "2–3 semillas por golpe, ralear"),
      E("Primeras hojas", "🌿", 20, 55, "Aporcar a los 30–40 cm"),
      E("Floración (panoja y pelo)", "🌾", 55, 75, "Etapa crítica: nunca sin agua"),
      E("Llenado y cosecha", "🌽", 75, 110, "Cosechar con el pelo café")],
    plagas: [{ nombre: "Gusano del choclo", sintomas: "Gusano en la punta de la mazorca.", org: "Gotas de aceite en el pelo, Bt.", quim: "Spinosad." },
      "cortador", "pulgon", "pajaros",
      { nombre: "Carbón del maíz", hongo: true, sintomas: "Agallas grises que se vuelven polvo negro.", org: "Cortar agallas antes de que se abran.", quim: "Sin control químico efectivo." }] },

  // ============ LEGUMBRES ============
  { id: "poroto", nombre: "Poroto verde", emoji: "🫛", cat: "verdura", perfil: "legum",
    temp: [10, 18, 25, 32], ph: [6.0, 7.0], plantasM2: 15, zr: 0.6,
    kc: [0.5, 0.75, 1.05, 0.95], req: { N: 40, P: 60, K: 80, Ca: 30, Mg: 15 }, micro: ["Mo", "B"],
    suelo: "Franco, bien drenado. Fija su propio nitrógeno.", luz: "Pleno sol.", necesitaSol: true,
    distancia: "10 cm entre plantas y 60 cm entre hileras", epoca: "Siembra de octubre a enero.",
    etapas: [
      E("Siembra", "🌱", 0, 15, "Sembrar con suelo húmedo, no regar encima hasta que brote"),
      E("Primeras hojas", "🌿", 15, 35, "Aporcar levemente"),
      E("Floración", "🌸", 35, 50, "No dejar secar: se caen las flores"),
      E("Vainas y cosecha", "🫛", 50, 90, "Cosechar cada 3–4 días")],
    plagas: ["pulgon", "aranita", "cortador", "roya",
      { nombre: "Antracnosis", hongo: true, sintomas: "Manchas hundidas cafés en vainas.", org: "Semilla sana, no trabajar con plantas mojadas.", quim: "Fungicida cúprico." }] },

  { id: "arveja", nombre: "Arveja", emoji: "🟢", cat: "verdura", perfil: "legum",
    temp: [2, 13, 18, 25], ph: [6.0, 7.5], plantasM2: 30, zr: 0.6,
    kc: [0.5, 0.8, 1.15, 1.05], req: { N: 30, P: 60, K: 80, Ca: 30, Mg: 15 }, micro: ["Mo", "B"],
    suelo: "Franco, bien drenado.", luz: "Pleno sol.", necesitaSol: true,
    distancia: "5 cm entre plantas y 50 cm entre hileras, con malla", epoca: "Siembra de abril a agosto (otoño–invierno).",
    etapas: [
      E("Siembra", "🌱", 0, 20, "Sembrar a 4 cm"),
      E("Crecimiento", "🌿", 20, 60, "Poner malla o ramas para trepar"),
      E("Floración", "🌸", 60, 85, "No dejar secar"),
      E("Vainas y cosecha", "🟢", 85, 130, "Cosechar con vainas llenas y verdes")],
    plagas: ["pulgon", "oidio", "pajaros", "babosas"] },

  { id: "haba", nombre: "Haba", emoji: "🫘", cat: "verdura", perfil: "legum",
    temp: [-2, 10, 18, 25], ph: [6.0, 7.5], plantasM2: 8, zr: 0.7,
    kc: [0.5, 0.8, 1.15, 1.05], req: { N: 30, P: 60, K: 80, Ca: 30, Mg: 15 }, micro: ["Mo", "B"],
    suelo: "Franco a arcilloso.", luz: "Pleno sol.", necesitaSol: true,
    distancia: "20 cm entre plantas y 60 cm entre hileras", epoca: "Siembra de abril a junio.",
    etapas: [
      E("Siembra", "🌱", 0, 25, "Sembrar a 5 cm"),
      E("Crecimiento", "🌿", 25, 80, "Aporcar"),
      E("Floración", "🌸", 80, 110, "Despuntar las puntas si hay pulgón negro"),
      E("Vainas y cosecha", "🫘", 110, 160, "Cosechar con granos tiernos")],
    plagas: ["pulgon", "roya",
      { nombre: "Mancha chocolate", hongo: true, sintomas: "Manchitas café-rojizas en hojas y tallos.", org: "Buena distancia, no exceso de agua.", quim: "Mancozeb." }] },

  // ============ VERDURAS DE HOJA ============
  { id: "lechuga", nombre: "Lechuga", emoji: "🥬", cat: "verdura", perfil: "hoja",
    temp: [5, 15, 20, 26], ph: [6.0, 7.0], plantasM2: 12, zr: 0.3, p: 0.3,
    kc: [0.7, 0.85, 1.0, 0.95], req: { N: 100, P: 50, K: 150, Ca: 30, Mg: 10 }, micro: ["Ca", "Mg"],
    suelo: "Franco, suelto y con materia orgánica.", luz: "Pleno sol; en verano algo de sombra en la tarde.", necesitaSol: false,
    distancia: "25–30 cm entre plantas", epoca: "Casi todo el año.",
    etapas: [
      E("Trasplante", "🌱", 0, 15, "No enterrar el cogollo"),
      E("Primeras hojas", "🌿", 15, 35, "Suelo siempre húmedo"),
      E("Formación de cabeza", "🥬", 35, 55, "Regar temprano"),
      E("Cosecha", "✂️", 55, 70, "Cosechar antes de que se suba")],
    plagas: ["pulgon", "babosas", "cortador", "mildiu",
      { nombre: "Esclerotinia", hongo: true, sintomas: "Se pudre desde la base con algodón blanco.", org: "Sacar plantas enfermas, rotar.", quim: "Iprodiona." }] },

  { id: "acelga", nombre: "Acelga", emoji: "🥬", cat: "verdura", perfil: "hoja",
    temp: [3, 15, 22, 30], ph: [6.0, 7.5], plantasM2: 9, zr: 0.5,
    kc: [0.7, 0.85, 1.0, 0.95], req: { N: 120, P: 50, K: 150, Ca: 30, Mg: 15 }, micro: ["B", "Mg"],
    suelo: "Franco, fértil.", luz: "Pleno sol o semisombra.", necesitaSol: false,
    distancia: "30 cm entre plantas y 40 cm entre hileras", epoca: "Casi todo el año.",
    etapas: [
      E("Trasplante / siembra", "🌱", 0, 20, "Ralear dejando 30 cm"),
      E("Primeras hojas", "🌿", 20, 50, "Sacar malezas"),
      E("Cosecha de hojas", "🥬", 50, 150, "Cortar hojas de afuera, dejar el centro"),
      E("Fin del cultivo", "✂️", 150, 180, "Sacar cuando se suba a flor")],
    plagas: ["pulgon", "babosas", "cuncunilla",
      { nombre: "Cercospora", hongo: true, sintomas: "Manchas redondas con centro claro y borde rojizo.", org: "Sacar hojas enfermas, rotar.", quim: "Cúprico." }] },

  { id: "espinaca", nombre: "Espinaca", emoji: "🍃", cat: "verdura", perfil: "hoja",
    temp: [2, 12, 18, 24], ph: [6.5, 7.5], plantasM2: 25, zr: 0.3, p: 0.3,
    kc: [0.7, 0.85, 1.0, 0.95], req: { N: 120, P: 50, K: 120, Ca: 30, Mg: 15 }, micro: ["Fe", "Mg"],
    suelo: "Franco, fértil, pH neutro.", luz: "Sol o semisombra.", necesitaSol: false,
    distancia: "10 cm entre plantas y 30 cm entre hileras", epoca: "Otoño e invierno (en verano se sube a flor).",
    etapas: [
      E("Siembra", "🌱", 0, 15, "Sembrar a 2 cm"),
      E("Primeras hojas", "🌿", 15, 35, "Ralear a 10 cm"),
      E("Crecimiento de hojas", "🍃", 35, 50, "Riego frecuente"),
      E("Cosecha", "✂️", 50, 65, "Cortar antes de la flor")],
    plagas: ["pulgon", "mildiu", "babosas", "cuncunilla"] },

  { id: "repollo", nombre: "Repollo", emoji: "🥬", cat: "verdura", perfil: "hoja",
    temp: [0, 15, 20, 28], ph: [6.0, 7.5], plantasM2: 3, zr: 0.5,
    kc: [0.7, 0.85, 1.05, 0.95], req: { N: 200, P: 80, K: 200, Ca: 50, Mg: 20 }, micro: ["B", "Mo"],
    suelo: "Franco a arcilloso, fértil.", luz: "Pleno sol.", necesitaSol: true,
    distancia: "50 cm entre plantas y 60 cm entre hileras", epoca: "Todo el año según variedad.",
    etapas: [
      E("Trasplante", "🌱", 0, 20, "Plantar hasta las primeras hojas"),
      E("Crecimiento de hojas", "🌿", 20, 60, "Aporcar"),
      E("Formación de cabeza", "🥬", 60, 100, "Riego parejo (si no, se parte)"),
      E("Cosecha", "✂️", 100, 120, "Cosechar cuando esté firme")],
    plagas: ["polilla_col", "pulgon", "cuncunilla", "babosas", "hernia"] },

  { id: "brocoli", nombre: "Brócoli", emoji: "🥦", cat: "verdura", perfil: "hoja",
    temp: [0, 15, 20, 26], ph: [6.0, 7.5], plantasM2: 3, zr: 0.5,
    kc: [0.7, 0.85, 1.05, 0.95], req: { N: 200, P: 80, K: 200, Ca: 50, Mg: 20 }, micro: ["B", "Mo"],
    suelo: "Franco, fértil y con materia orgánica.", luz: "Pleno sol.", necesitaSol: true,
    distancia: "50 cm entre plantas y 60 cm entre hileras", epoca: "Trasplante de febrero a abril y en primavera.",
    etapas: [
      E("Trasplante", "🌱", 0, 20, "Regar al plantar"),
      E("Crecimiento de hojas", "🌿", 20, 55, "Aporcar"),
      E("Formación de cabeza", "🥦", 55, 80, "Boro: evita tallo hueco"),
      E("Cosecha", "✂️", 80, 110, "Cortar con flores cerradas; luego salen brotes laterales")],
    plagas: ["polilla_col", "pulgon", "cuncunilla", "hernia"] },

  { id: "coliflor", nombre: "Coliflor", emoji: "🥦", cat: "verdura", perfil: "hoja",
    temp: [0, 15, 20, 25], ph: [6.0, 7.5], plantasM2: 2.5, zr: 0.5,
    kc: [0.7, 0.85, 1.05, 0.95], req: { N: 200, P: 80, K: 220, Ca: 50, Mg: 20 }, micro: ["B", "Mo"],
    suelo: "Franco, fértil, pH cercano a neutro.", luz: "Pleno sol.", necesitaSol: true,
    distancia: "60 cm entre plantas y 70 cm entre hileras", epoca: "Trasplante de enero a abril.",
    etapas: [
      E("Trasplante", "🌱", 0, 20, "Regar al plantar"),
      E("Crecimiento de hojas", "🌿", 20, 60, "Aporcar"),
      E("Formación de cabeza", "🥦", 60, 95, "Tapar la cabeza con sus hojas para que quede blanca"),
      E("Cosecha", "✂️", 95, 120, "Cosechar firme y compacta")],
    plagas: ["polilla_col", "pulgon", "cuncunilla", "hernia"] },

  { id: "apio", nombre: "Apio", emoji: "🥬", cat: "verdura", perfil: "hoja",
    temp: [5, 15, 21, 28], ph: [6.0, 7.0], plantasM2: 8, zr: 0.4, p: 0.3,
    kc: [0.7, 0.85, 1.05, 1.0], req: { N: 180, P: 80, K: 250, Ca: 80, Mg: 25 }, micro: ["B", "Ca", "Mg"],
    suelo: "Franco, rico en materia orgánica y húmedo.", luz: "Sol o semisombra.", necesitaSol: false,
    distancia: "30 cm entre plantas y 40 cm entre hileras", epoca: "Trasplante de septiembre a diciembre.",
    etapas: [
      E("Trasplante", "🌱", 0, 25, "Nunca dejar secar"),
      E("Crecimiento", "🌿", 25, 70, "Riego frecuente"),
      E("Engrosamiento de pencas", "🥬", 70, 110, "Boro y calcio evitan pencas agrietadas"),
      E("Cosecha", "✂️", 110, 130, "Cortar a ras del suelo")],
    plagas: ["pulgon", "babosas",
      { nombre: "Septoria", hongo: true, sintomas: "Manchas cafés con puntitos negros en hojas.", org: "Semilla sana, no mojar hojas.", quim: "Cúprico." }] },

  // ============ RAÍCES Y BULBOS ============
  { id: "papa", nombre: "Papa", emoji: "🥔", cat: "verdura", perfil: "raiz",
    temp: [7, 15, 20, 28], ph: [5.5, 6.5], plantasM2: 4.5, zr: 0.5,
    kc: [0.5, 0.8, 1.15, 0.75], req: { N: 180, P: 120, K: 220, Ca: 20, Mg: 20 }, micro: ["Zn", "B", "Mg"],
    suelo: "Suelto, franco-arenoso, sin piedras.", luz: "Pleno sol.", necesitaSol: true,
    distancia: "30 cm entre semillas y 75 cm entre hileras", epoca: "Valle: agosto–octubre. Sur: octubre–noviembre.",
    etapas: [
      E("Plantación y brotación", "🌱", 0, 25, "Papa semilla sana a 10 cm"),
      E("Primeras hojas y aporca", "🌿", 25, 50, "Aporcar a los 20–25 cm"),
      E("Floración (inicio de papas)", "🌸", 50, 75, "Riego más importante"),
      E("Llenado de papas", "🥔", 75, 120, "Bajar el riego al amarillear", "Cosechar 2 semanas después de secarse la mata")],
    plagas: [{ nombre: "Tizón tardío", hongo: true, sintomas: "Manchas negras en hojas con borde blanco debajo, avanza rápido.", org: "Caldo bordelés preventivo.", quim: "Mancozeb o cúprico." },
      { nombre: "Polilla de la papa", sintomas: "Galerías en tubérculos.", org: "Aporca alta, cosechar a tiempo.", quim: "Insecticida autorizado." },
      "pulgon",
      { nombre: "Gusano blanco", sintomas: "Papas mordidas.", org: "Rotar, arar en invierno.", quim: "Insecticida de suelo autorizado." }] },

  { id: "cebolla", nombre: "Cebolla", emoji: "🧅", cat: "verdura", perfil: "raiz",
    temp: [5, 13, 24, 30], ph: [6.0, 7.0], plantasM2: 30, zr: 0.3,
    kc: [0.7, 0.85, 1.05, 0.75], req: { N: 140, P: 80, K: 160, Ca: 30, Mg: 15 }, micro: ["Zn", "Mn"],
    suelo: "Franco, suelto y sin piedras.", luz: "Pleno sol.", necesitaSol: true,
    distancia: "10 cm entre plantas y 30 cm entre hileras", epoca: "Guarda: trasplante junio–agosto. Temprana: abril–mayo.",
    etapas: [
      E("Trasplante", "🌱", 0, 30, "Plantar superficial"),
      E("Crecimiento de hojas", "🌿", 30, 90, "Desmalezar seguido"),
      E("Formación del bulbo", "🧅", 90, 150, "No dar nitrógeno tarde"),
      E("Maduración y cosecha", "✂️", 150, 190, "Cortar riego 2–3 semanas antes", "Secar al sol")],
    plagas: ["trips", "mildiu", "roya",
      { nombre: "Pudrición blanca", hongo: true, sintomas: "Hojas amarillas, moho blanco en la base.", org: "Rotar 4–5 años.", quim: "Difícil; prevenir." }] },

  { id: "ajo", nombre: "Ajo", emoji: "🧄", cat: "verdura", perfil: "raiz",
    temp: [-5, 12, 24, 30], ph: [6.0, 7.5], plantasM2: 30, zr: 0.3,
    kc: [0.7, 0.85, 1.0, 0.7], req: { N: 150, P: 90, K: 150, Ca: 30, Mg: 15 }, micro: ["Zn", "B"],
    suelo: "Franco, suelto y bien drenado.", luz: "Pleno sol.", necesitaSol: true,
    distancia: "10 cm entre dientes y 30 cm entre hileras", epoca: "Plantar de abril a junio.",
    etapas: [
      E("Plantación y brotación", "🌱", 0, 40, "Dientes sanos con la punta arriba a 3–4 cm"),
      E("Crecimiento de hojas", "🌿", 40, 120, "Con lluvia no regar"),
      E("Formación de la cabeza", "🧄", 120, 170, "Cortar el tallo floral"),
      E("Maduración y cosecha", "✂️", 170, 210, "Suspender riego", "Cosechar con 2/3 de hojas secas")],
    plagas: ["trips", "roya",
      { nombre: "Pudrición blanca", hongo: true, sintomas: "Moho blanco en la base.", org: "Semilla sana, rotar.", quim: "Difícil; prevenir." },
      { nombre: "Ácaro del ajo", sintomas: "Hojas deformes, dientes vacíos.", org: "Remojar dientes en agua a 45 °C por 20 min.", quim: "Azufre." }] },

  { id: "zanahoria", nombre: "Zanahoria", emoji: "🥕", cat: "verdura", perfil: "raiz",
    temp: [5, 15, 20, 28], ph: [6.0, 6.8], plantasM2: 60, zr: 0.5,
    kc: [0.7, 0.85, 1.05, 0.95], req: { N: 100, P: 70, K: 180, Ca: 30, Mg: 15 }, micro: ["B", "Mn"],
    suelo: "Suelto, profundo, sin piedras. Sin guano fresco.", luz: "Pleno sol.", necesitaSol: false,
    distancia: "Ralear a 5 cm, hileras a 30 cm", epoca: "Casi todo el año, salvo pleno invierno.",
    etapas: [
      E("Siembra y germinación", "🌱", 0, 20, "Superficie siempre húmeda hasta que nazca"),
      E("Primeras hojas", "🌿", 20, 50, "Ralear a 5 cm"),
      E("Engorde de la raíz", "🥕", 50, 90, "Riego parejo (si no, se parten)"),
      E("Cosecha", "✂️", 90, 120, "Regar el día antes de cosechar")],
    plagas: [{ nombre: "Mosca de la zanahoria", sintomas: "Galerías en la raíz.", org: "Malla, sembrar junto a cebollas.", quim: "Insecticida de suelo autorizado." },
      "pulgon", "cortador",
      { nombre: "Alternaria", hongo: true, sintomas: "Hojas con manchas cafés que se secan.", org: "Rotar, no mojar el follaje.", quim: "Mancozeb." }] },

  { id: "betarraga", nombre: "Betarraga", emoji: "🟣", cat: "verdura", perfil: "raiz",
    temp: [5, 15, 22, 28], ph: [6.0, 7.5], plantasM2: 25, zr: 0.5,
    kc: [0.5, 0.75, 1.05, 0.95], req: { N: 120, P: 80, K: 200, Ca: 30, Mg: 20 }, micro: ["B", "Mn"],
    suelo: "Franco, profundo.", luz: "Pleno sol.", necesitaSol: false,
    distancia: "10 cm entre plantas y 30 cm entre hileras", epoca: "De agosto a marzo.",
    etapas: [
      E("Siembra", "🌱", 0, 20, "Remojar semilla 12 h antes"),
      E("Primeras hojas", "🌿", 20, 45, "Ralear a 10 cm"),
      E("Engorde de la raíz", "🟣", 45, 80, "Boro: evita el corazón negro"),
      E("Cosecha", "✂️", 80, 100, "Cosechar del tamaño de una pelota de tenis")],
    plagas: ["pulgon", "cuncunilla",
      { nombre: "Cercospora", hongo: true, sintomas: "Manchas redondas con borde rojizo.", org: "Rotar, sacar hojas enfermas.", quim: "Cúprico." }] },

  { id: "rabanito", nombre: "Rabanito", emoji: "🔴", cat: "verdura", perfil: "raiz",
    temp: [3, 12, 20, 26], ph: [6.0, 7.0], plantasM2: 80, zr: 0.2, p: 0.3,
    kc: [0.7, 0.8, 0.9, 0.85], req: { N: 50, P: 30, K: 60, Ca: 15, Mg: 10 }, micro: ["B"],
    suelo: "Suelto.", luz: "Sol o semisombra.", necesitaSol: false,
    distancia: "3–5 cm entre plantas, 20 cm entre hileras", epoca: "Todo el año salvo pleno verano.",
    etapas: [
      E("Siembra", "🌱", 0, 7, "Sembrar a 1 cm"),
      E("Primeras hojas", "🌿", 7, 15, "Ralear a 3–5 cm"),
      E("Engorde", "🔴", 15, 25, "Riego parejo"),
      E("Cosecha", "✂️", 25, 35, "Cosechar a tiempo (se ahueca)")],
    plagas: ["polilla_col", "babosas", "pulgon"] },

  { id: "puerro", nombre: "Puerro", emoji: "🥬", cat: "verdura", perfil: "raiz",
    temp: [0, 13, 22, 28], ph: [6.0, 7.5], plantasM2: 20, zr: 0.4,
    kc: [0.7, 0.85, 1.0, 0.95], req: { N: 150, P: 70, K: 180, Ca: 30, Mg: 15 }, micro: ["Mn"],
    suelo: "Franco, profundo.", luz: "Pleno sol.", necesitaSol: true,
    distancia: "15 cm entre plantas y 40 cm entre hileras", epoca: "Trasplante de octubre a febrero.",
    etapas: [
      E("Trasplante", "🌱", 0, 30, "Plantar en surco hondo"),
      E("Crecimiento", "🌿", 30, 90, "Aporcar para blanquear el tallo"),
      E("Engrosamiento", "🥬", 90, 140, "Volver a aporcar"),
      E("Cosecha", "✂️", 140, 170, "Cosechar a medida que se necesita")],
    plagas: ["trips", "roya", "mildiu"] },

  // ============ HIERBAS ============
  { id: "albahaca", nombre: "Albahaca", emoji: "🌿", cat: "hierba", perfil: "hoja",
    temp: [12, 20, 28, 35], ph: [6.0, 7.0], plantasM2: 9, zr: 0.3,
    kc: [0.6, 0.8, 1.0, 0.9], req: { N: 100, P: 40, K: 100, Ca: 30, Mg: 10 }, micro: ["Mg", "Fe"],
    suelo: "Franco, bien drenado.", luz: "Pleno sol, calor.", necesitaSol: true,
    distancia: "30 cm entre plantas", epoca: "Trasplante de octubre a diciembre.",
    etapas: [
      E("Trasplante", "🌱", 0, 15, "Plantar con suelo tibio"),
      E("Crecimiento", "🌿", 15, 40, "Despuntar para que ramifique"),
      E("Cosecha de hojas", "🌿", 40, 120, "Cortar flores para alargar la cosecha"),
      E("Fin", "✂️", 120, 140, "Muere con el frío")],
    plagas: ["pulgon", "babosas", "mildiu", "mosquita"] },

  { id: "cilantro", nombre: "Cilantro", emoji: "🌱", cat: "hierba", perfil: "hoja",
    temp: [5, 15, 22, 28], ph: [6.0, 7.5], plantasM2: 50, zr: 0.3, p: 0.3,
    kc: [0.6, 0.8, 1.0, 0.9], req: { N: 80, P: 40, K: 80, Ca: 20, Mg: 10 }, micro: ["Mg"],
    suelo: "Franco, suelto.", luz: "Sol o semisombra.", necesitaSol: false,
    distancia: "Siembra en hilera a chorro, 20 cm entre hileras", epoca: "Casi todo el año (en verano se sube rápido).",
    etapas: [
      E("Siembra", "🌱", 0, 15, "Partir la semilla en dos"),
      E("Crecimiento", "🌿", 15, 35, "Riego frecuente"),
      E("Cosecha", "✂️", 35, 60, "Cortar seguido"),
      E("Fin", "🌸", 60, 75, "Sembrar de nuevo cada 3 semanas")],
    plagas: ["pulgon", "oidio"] },

  // ============ FRUTALES (perennes, por meses del año) ============
  { id: "frambuesa", nombre: "Frambuesa", emoji: "🫐", cat: "fruta", perenne: true, perfil: "caduco",
    temp: [-15, 15, 25, 32], ph: [5.5, 6.5], zr: 0.5, areaPlanta: 1.0,
    kc: [0.4, 0.9, 1.05, 0.7, 0.3], req: { N: 15, P: 8, K: 20, Ca: 8, Mg: 4 }, micro: ["B", "Zn", "Fe"],
    suelo: "Franco, bien drenado, con mucha materia orgánica.", luz: "Pleno sol.", necesitaSol: true,
    distancia: "50 cm entre plantas, 2,5 m entre hileras, con alambres",
    epoca: "Plantar en invierno (junio–agosto).",
    etapas: [
      M("Brotación", "🌱", 8, 10, "Amarrar las cañas al alambre"),
      M("Floración", "🌸", 10, 12, "Riego parejo, revisar botritis"),
      M("Fruto y cosecha", "🫐", 12, 4, "Cosechar cada 2–3 días"),
      M("Postcosecha", "🍂", 4, 6, "Cortar las cañas que ya dieron fruta"),
      M("Reposo invernal", "❄️", 6, 8, "Compost en invierno", "Poda de cañas débiles")],
    plagas: ["aranita", "botritis", "mosca_fruta", "pulgon", "escama"] },

  { id: "arandano", nombre: "Arándano", emoji: "🫐", cat: "fruta", perenne: true, perfil: "caduco", amonio: true,
    temp: [-15, 15, 25, 32], ph: [4.5, 5.5], zr: 0.4, areaPlanta: 1.5, p: 0.35,
    kc: [0.4, 0.8, 1.0, 0.7, 0.3], req: { N: 15, P: 6, K: 15, Ca: 0, Mg: 4 }, micro: ["Fe", "Zn", "B"],
    suelo: "MUY ácido (pH 4,5–5,5), suelto, con turba o aserrín. No tolera cal ni nitratos.", luz: "Pleno sol.", necesitaSol: true,
    distancia: "1 m entre plantas y 3 m entre hileras",
    epoca: "Plantar en invierno (junio–agosto).",
    etapas: [
      M("Brotación", "🌱", 8, 9, "Mulch de aserrín o corteza de pino"),
      M("Floración", "🌸", 9, 11, "Proteger de heladas"),
      M("Fruto y cosecha", "🫐", 11, 3, "Cosechar cuando estén azules completas"),
      M("Postcosecha", "🍂", 3, 5, "Mantener riego hasta otoño"),
      M("Reposo invernal", "❄️", 5, 8, "Poda de ramas viejas", "Agregar azufre si el pH sube")],
    plagas: ["botritis", "pajaros", "mosca_fruta", "pulgon", "escama"] },

  { id: "palto", nombre: "Palto", emoji: "🥑", cat: "fruta", perenne: true, perfil: "siempre",
    temp: [-1, 18, 26, 35], ph: [5.5, 7.0], zr: 0.6, areaPlanta: 20,
    kc: [0.7, 0.75, 0.8, 0.75, 0.6], req: { N: 300, P: 100, K: 300, Ca: 100, Mg: 50 }, micro: ["Zn", "B", "Fe"],
    suelo: "Muy bien drenado (no tolera agua estancada). Plantar en camellón.", luz: "Pleno sol, sin heladas.", necesitaSol: true,
    distancia: "5–6 m entre árboles",
    epoca: "Plantar en primavera (septiembre–noviembre), sin heladas.",
    etapas: [
      M("Floración", "🌸", 9, 11, "Abejas ayudan a la cuaja"),
      M("Cuaja", "🫛", 11, 1, "Riego parejo: evita caída de frutos"),
      M("Crecimiento del fruto", "🥑", 1, 5, "Mulch bajo la copa"),
      M("Cosecha y brotación de otoño", "🍂", 5, 7, "Cosechar según madurez"),
      M("Invierno", "❄️", 7, 9, "Proteger de heladas", "Revisar drenaje")],
    plagas: ["chanchito", "escama", "aranita", "pud_cuello",
      { nombre: "Trips del palto", sintomas: "Frutos con piel áspera y café.", org: "Aceite mineral.", quim: "Spinosad." }] },

  { id: "limonero", nombre: "Limonero", emoji: "🍋", cat: "fruta", perenne: true, perfil: "siempre",
    temp: [-2, 18, 28, 35], ph: [6.0, 7.0], zr: 0.6, areaPlanta: 12,
    kc: [0.65, 0.65, 0.7, 0.65, 0.6], req: { N: 400, P: 150, K: 300, Ca: 100, Mg: 60 }, micro: ["Fe", "Zn", "Mn", "Mg"],
    suelo: "Franco, bien drenado.", luz: "Pleno sol, protegido del viento.", necesitaSol: true,
    distancia: "4–5 m entre árboles",
    epoca: "Plantar en primavera.",
    etapas: [
      M("Brotación y floración", "🌸", 8, 10, "Aplicar zinc y manganeso foliar"),
      M("Cuaja", "🫛", 10, 12, "Riego parejo"),
      M("Crecimiento del fruto", "🍋", 12, 4, "Mulch bajo la copa"),
      M("Cosecha", "🧺", 4, 7, "Cosechar según necesidad"),
      M("Invierno", "❄️", 7, 8, "Aceite mineral contra conchuelas")],
    plagas: ["chanchito", "escama", "pulgon", "aranita", "pud_cuello"] },

  { id: "naranjo", nombre: "Naranjo / Mandarino", emoji: "🍊", cat: "fruta", perenne: true, perfil: "siempre",
    temp: [-2, 18, 28, 35], ph: [6.0, 7.0], zr: 0.6, areaPlanta: 14,
    kc: [0.65, 0.65, 0.7, 0.65, 0.6], req: { N: 400, P: 150, K: 300, Ca: 100, Mg: 60 }, micro: ["Fe", "Zn", "Mn", "Mg"],
    suelo: "Franco, bien drenado.", luz: "Pleno sol.", necesitaSol: true,
    distancia: "5 m entre árboles", epoca: "Plantar en primavera.",
    etapas: [
      M("Brotación y floración", "🌸", 8, 10, "Zinc y manganeso foliar"),
      M("Cuaja", "🫛", 10, 12, "Riego parejo"),
      M("Crecimiento del fruto", "🍊", 12, 5, "Mulch bajo la copa"),
      M("Maduración y cosecha", "🧺", 5, 7, "Cosechar con tijera"),
      M("Fin de invierno", "❄️", 7, 8, "Poda liviana", "Aceite mineral contra conchuelas")],
    plagas: ["chanchito", "escama", "pulgon", "aranita", "mosca_fruta"] },

  { id: "manzano", nombre: "Manzano", emoji: "🍎", cat: "fruta", perenne: true, perfil: "caduco",
    temp: [-20, 18, 25, 35], ph: [6.0, 7.0], zr: 0.8, areaPlanta: 8,
    kc: [0.5, 0.9, 1.1, 0.8, 0.3], req: { N: 150, P: 50, K: 150, Ca: 80, Mg: 30 }, micro: ["Ca", "B", "Zn"],
    suelo: "Franco, profundo.", luz: "Pleno sol, necesita frío en invierno.", necesitaSol: true,
    distancia: "4 m entre árboles", epoca: "Plantar en invierno (junio–agosto).",
    etapas: [
      M("Brotación", "🌱", 9, 10, "Zinc foliar en puntas verdes"),
      M("Floración", "🌸", 10, 11, "Boro en floración"),
      M("Crecimiento del fruto", "🍎", 11, 4, "Raleo: dejar 1–2 frutos por racimo", "Calcio foliar cada 15 días"),
      M("Postcosecha", "🍂", 4, 6, "Urea foliar antes de la caída de hojas"),
      M("Reposo invernal", "❄️", 6, 9, "Poda", "Aceite mineral + cobre")],
    plagas: [{ nombre: "Polilla de la manzana (gusano)", sintomas: "Frutos con agujero y aserrín.", org: "Trampas de feromona, embolsar frutos.", quim: "Insecticida autorizado según trampa." },
      "pulgon", "aranita", "escama", "oidio",
      { nombre: "Venturia (sarna)", hongo: true, sintomas: "Manchas negras costrosas en hojas y frutos.", org: "Recoger hojas caídas, cobre en brotación.", quim: "Captan o mancozeb." }] },

  { id: "durazno", nombre: "Durazno / Nectarín", emoji: "🍑", cat: "fruta", perenne: true, perfil: "caduco",
    temp: [-15, 18, 28, 36], ph: [6.0, 7.0], zr: 0.8, areaPlanta: 10,
    kc: [0.5, 0.85, 1.0, 0.75, 0.3], req: { N: 150, P: 50, K: 150, Ca: 60, Mg: 30 }, micro: ["Zn", "Fe", "B"],
    suelo: "Franco, bien drenado.", luz: "Pleno sol.", necesitaSol: true,
    distancia: "4–5 m entre árboles", epoca: "Plantar en invierno.",
    etapas: [
      M("Brotación", "🌱", 8, 9, "Cobre contra la cloca"),
      M("Floración", "🌸", 9, 10, "Proteger de heladas"),
      M("Crecimiento del fruto", "🍑", 10, 3, "Raleo: un fruto cada 15 cm"),
      M("Postcosecha", "🍂", 3, 6, "Mantener riego hasta otoño"),
      M("Reposo invernal", "❄️", 6, 8, "Poda", "Cobre a la caída de hojas")],
    plagas: ["pulgon", "aranita", "escama", "mosca_fruta",
      { nombre: "Cloca (torque)", hongo: true, sintomas: "Hojas rojizas, encrespadas y abolladas en primavera.", org: "Cobre en caída de hojas y yema hinchada.", quim: "Oxicloruro de cobre o ziram." }] },

  { id: "cerezo", nombre: "Cerezo", emoji: "🍒", cat: "fruta", perenne: true, perfil: "caduco",
    temp: [-20, 16, 25, 32], ph: [6.0, 7.5], zr: 0.8, areaPlanta: 12,
    kc: [0.5, 0.9, 1.05, 0.8, 0.3], req: { N: 120, P: 50, K: 150, Ca: 60, Mg: 25 }, micro: ["B", "Ca", "Zn"],
    suelo: "Franco, profundo y muy bien drenado.", luz: "Pleno sol, necesita frío.", necesitaSol: true,
    distancia: "4–5 m entre árboles", epoca: "Plantar en invierno.",
    etapas: [
      M("Brotación", "🌱", 8, 9, "Boro antes de flor"),
      M("Floración", "🌸", 9, 10, "Necesita polinizante y abejas"),
      M("Fruto y cosecha", "🍒", 10, 1, "Calcio foliar: evita partidura", "Malla contra pájaros"),
      M("Postcosecha", "🍂", 1, 5, "No cortar el riego: se forman las yemas del próximo año"),
      M("Reposo invernal", "❄️", 5, 8, "Poda en verano o fin de invierno", "Cobre")],
    plagas: ["pajaros", "mosca_fruta", "pulgon", "escama",
      { nombre: "Cáncer bacterial", sintomas: "Goma en ramas, ramas que se secan.", org: "Cobre en otoño e invierno, podar con herramientas limpias.", quim: "Cobre." }] },

  { id: "vid", nombre: "Parra / Uva", emoji: "🍇", cat: "fruta", perenne: true, perfil: "caduco",
    temp: [-15, 18, 30, 38], ph: [6.0, 7.5], zr: 0.8, areaPlanta: 4,
    kc: [0.3, 0.6, 0.75, 0.5, 0.2], req: { N: 60, P: 30, K: 90, Ca: 40, Mg: 20 }, micro: ["B", "Zn", "Mg"],
    suelo: "Franco a pedregoso, bien drenado.", luz: "Pleno sol.", necesitaSol: true,
    distancia: "1,5–2 m entre plantas en espaldera, o parrón", epoca: "Plantar en invierno.",
    etapas: [
      M("Brotación", "🌱", 9, 11, "Azufre en polvo contra oídio desde brotes de 10 cm"),
      M("Floración y cuaja", "🌸", 11, 12, "Boro y zinc antes de flor"),
      M("Crecimiento y pinta", "🍇", 12, 4, "Deshojar alrededor de racimos", "Bajar riego en pinta (más dulce)"),
      M("Postcosecha", "🍂", 4, 6, "Riego liviano"),
      M("Reposo invernal", "❄️", 6, 9, "Poda de invierno")],
    plagas: ["oidio", "botritis", "chanchito", "aranita", "pajaros"] },

  { id: "olivo", nombre: "Olivo", emoji: "🫒", cat: "fruta", perenne: true, perfil: "siempre",
    temp: [-7, 15, 30, 40], ph: [6.5, 8.0], zr: 0.8, areaPlanta: 12,
    kc: [0.55, 0.65, 0.7, 0.6, 0.5], req: { N: 200, P: 60, K: 200, Ca: 50, Mg: 30 }, micro: ["B", "Zn"],
    suelo: "Cualquiera bien drenado, tolera suelos pobres y calcáreos.", luz: "Pleno sol.", necesitaSol: true,
    distancia: "6 m entre árboles", epoca: "Plantar en primavera.",
    etapas: [
      M("Brotación", "🌱", 8, 10, "Boro foliar"),
      M("Floración y cuaja", "🌸", 10, 12, "Riego parejo"),
      M("Crecimiento del fruto", "🫒", 12, 4, "Riego deficitario tolera bien"),
      M("Maduración y cosecha", "🧺", 4, 7, "Cosechar al cambiar de color"),
      M("Invierno", "❄️", 7, 8, "Poda liviana", "Cobre")],
    plagas: ["escama", "chanchito",
      { nombre: "Repilo", hongo: true, sintomas: "Manchas circulares tipo 'ojo de pavo' en hojas.", org: "Cobre en otoño y primavera.", quim: "Oxicloruro de cobre." }] },
];

const CATEGORIAS = { todas: "Todas", verdura: "🥬 Verduras", fruta: "🍓 Frutas", hierba: "🌿 Hierbas" };
