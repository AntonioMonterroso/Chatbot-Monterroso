import { buscar, sinAcentos } from "./texto.js";

// Categoría de un gasto según lo que dice el detalle ("3 libras de tomate" -> verduras y frutas).
const GRUPOS = {
  carnes: "pollo carne res cerdo costilla chuleta pescado chorizo jamon salchicha huevo huevos longaniza tocino mariscos camaron",
  "verduras y frutas": "tomate cebolla papa lechuga limon aguacate fruta frutas verdura verduras chile ajo cilantro naranja platano pina zanahoria repollo güisquil guisquil mora fresa",
  bebidas: "cerveza gaseosa refresco jugo cafe licor hielo ron vino botella",
  abarrotes: "arroz frijol frijoles aceite azucar sal harina tortilla tortillas pan leche queso crema pasta mantequilla",
  "gas y energía": "gas propano luz energia electricidad carbon lena",
  servicios: "internet telefono celular cable servicio servicios",
  sueldos: "sueldo sueldos salario salarios planilla jornal ayudante mesero cocinero",
  alquiler: "alquiler renta arrendamiento",
  limpieza: "jabon cloro detergente escoba limpieza trapeador desinfectante",
  empaques: "bolsa bolsas desechable desechables envase envases servilleta servilletas platos vasos",
  mantenimiento: "reparacion arreglo mantenimiento plomero electricista pintura",
};

const TABLA = new Map(
  Object.entries(GRUPOS).flatMap(([categoria, palabras]) => sinAcentos(palabras).split(" ").map((p) => [p, categoria])),
);

export function categoriaDe(detalle = "") {
  for (const palabra of sinAcentos(detalle.toLowerCase()).split(/[^a-z]+/).filter((p) => p.length > 2)) {
    const c = buscar(palabra, TABLA);
    if (c) return c;
  }
  return "otros";
}
