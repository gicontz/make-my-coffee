// Restricted PH delivery coverage for checkout's Province/City dropdowns —
// only areas realistically reachable from the Pasig pickup point by
// Lalamove MOTORCYCLE. Barangay stays free text (no reliable, complete
// barangay-level dataset was available at authoring time — PH has 40k+
// barangays; don't hardcode a partial/guessed list).
//
// City list sourced from Wikipedia per-province LGU pages; ZIP codes
// sourced from rizalprovince.ph (official, Rizal) and cross-checked postal
// code aggregators (other provinces) — see memory/decision.md D10. Metro
// Manila cities genuinely have many ZIP codes each (by barangay/district),
// so their `zip` here is only a starting default, not authoritative —
// confirmed against this project's own verified Pasig/Manggahan order
// (1611, not the 1600 default below).

export const PROVINCES = ['Metro Manila / NCR', 'Rizal', 'Cavite', 'Laguna', 'Batangas', 'Bulacan'] as const
export type Province = (typeof PROVINCES)[number]

export interface CityOption {
  name: string
  zip?: string
}

export const CITIES_BY_PROVINCE: Record<Province, CityOption[]> = {
  'Metro Manila / NCR': [
    { name: 'Caloocan', zip: '1400' },
    { name: 'Las Piñas', zip: '1740' },
    { name: 'Makati', zip: '1200' },
    { name: 'Malabon', zip: '1470' },
    { name: 'Mandaluyong', zip: '1550' },
    { name: 'Manila', zip: '1000' },
    { name: 'Marikina', zip: '1800' },
    { name: 'Muntinlupa', zip: '1770' },
    { name: 'Navotas', zip: '1485' },
    { name: 'Parañaque', zip: '1700' },
    { name: 'Pasay', zip: '1300' },
    { name: 'Pasig', zip: '1600' },
    { name: 'Pateros', zip: '1620' },
    { name: 'Quezon City', zip: '1100' },
    { name: 'San Juan', zip: '1500' },
    { name: 'Taguig' },
    { name: 'Valenzuela', zip: '1440' },
  ],
  Rizal: [
    { name: 'Angono', zip: '1930' },
    { name: 'Antipolo', zip: '1870' },
    { name: 'Baras', zip: '1970' },
    { name: 'Binangonan', zip: '1940' },
    { name: 'Cainta', zip: '1900' },
    { name: 'Cardona', zip: '1950' },
    { name: 'Jalajala', zip: '1990' },
    { name: 'Morong', zip: '1960' },
    { name: 'Pililla', zip: '1910' },
    { name: 'Rodriguez (Montalban)', zip: '1860' },
    { name: 'San Mateo', zip: '1850' },
    { name: 'Tanay', zip: '1980' },
    { name: 'Taytay', zip: '1920' },
    { name: 'Teresa', zip: '1880' },
  ],
  Cavite: [
    { name: 'Alfonso', zip: '4123' },
    { name: 'Amadeo', zip: '4119' },
    { name: 'Bacoor', zip: '4102' },
    { name: 'Carmona', zip: '4116' },
    { name: 'Cavite City', zip: '4100' },
    { name: 'Dasmariñas', zip: '4114' },
    { name: 'General Emilio Aguinaldo (Bailen)', zip: '4124' },
    { name: 'General Mariano Alvarez', zip: '4117' },
    { name: 'General Trias', zip: '4107' },
    { name: 'Imus', zip: '4103' },
    { name: 'Indang', zip: '4122' },
    { name: 'Kawit', zip: '4104' },
    { name: 'Magallanes', zip: '4113' },
    { name: 'Maragondon', zip: '4112' },
    { name: 'Mendez', zip: '4121' },
    { name: 'Naic', zip: '4110' },
    { name: 'Noveleta', zip: '4105' },
    { name: 'Rosario', zip: '4106' },
    { name: 'Silang', zip: '4118' },
    { name: 'Tagaytay', zip: '4120' },
    { name: 'Tanza', zip: '4108' },
    { name: 'Ternate', zip: '4111' },
    { name: 'Trece Martires', zip: '4109' },
  ],
  Laguna: [
    { name: 'Alaminos', zip: '4001' },
    { name: 'Bay', zip: '4033' },
    { name: 'Biñan', zip: '4024' },
    { name: 'Cabuyao', zip: '4025' },
    { name: 'Calamba', zip: '4027' },
    { name: 'Calauan', zip: '4012' },
    { name: 'Cavinti', zip: '4013' },
    { name: 'Famy', zip: '4021' },
    { name: 'Kalayaan', zip: '4015' },
    { name: 'Liliw', zip: '4004' },
    { name: 'Los Baños', zip: '4030' },
    { name: 'Luisiana', zip: '4032' },
    { name: 'Lumban', zip: '4014' },
    { name: 'Mabitac', zip: '4020' },
    { name: 'Magdalena', zip: '4007' },
    { name: 'Majayjay', zip: '4005' },
    { name: 'Nagcarlan', zip: '4002' },
    { name: 'Paete', zip: '4016' },
    { name: 'Pagsanjan', zip: '4008' },
    { name: 'Pakil', zip: '4017' },
    { name: 'Pangil', zip: '4018' },
    { name: 'Pila', zip: '4010' },
    { name: 'Rizal', zip: '4003' },
    { name: 'San Pablo', zip: '4000' },
    { name: 'San Pedro', zip: '4023' },
    { name: 'Santa Cruz', zip: '4009' },
    { name: 'Santa Maria', zip: '4022' },
    { name: 'Santa Rosa', zip: '4026' },
    { name: 'Siniloan', zip: '4019' },
    { name: 'Victoria', zip: '4011' },
  ],
  Batangas: [
    { name: 'Agoncillo', zip: '4211' },
    { name: 'Alitagtag', zip: '4205' },
    { name: 'Balayan', zip: '4213' },
    { name: 'Balete', zip: '4219' },
    { name: 'Batangas City', zip: '4200' },
    { name: 'Bauan', zip: '4201' },
    { name: 'Calaca', zip: '4212' },
    { name: 'Calatagan', zip: '4215' },
    { name: 'Cuenca', zip: '4222' },
    { name: 'Ibaan', zip: '4230' },
    { name: 'Laurel', zip: '4221' },
    { name: 'Lemery', zip: '4209' },
    { name: 'Lian', zip: '4216' },
    { name: 'Lipa', zip: '4217' },
    { name: 'Lobo', zip: '4229' },
    { name: 'Mabini', zip: '4202' },
    { name: 'Malvar', zip: '4233' },
    { name: 'Mataasnakahoy', zip: '4223' },
    { name: 'Nasugbu', zip: '4231' },
    { name: 'Padre Garcia', zip: '4224' },
    { name: 'Rosario', zip: '4225' },
    { name: 'San Jose', zip: '4227' },
    { name: 'San Juan', zip: '4226' },
    { name: 'San Luis', zip: '4210' },
    { name: 'San Nicolas', zip: '4207' },
    { name: 'San Pascual', zip: '4204' },
    { name: 'Santa Teresita', zip: '4206' },
    { name: 'Santo Tomas', zip: '4234' },
    { name: 'Taal', zip: '4208' },
    { name: 'Talisay', zip: '4220' },
    { name: 'Tanauan', zip: '4232' },
    { name: 'Taysan', zip: '4228' },
    { name: 'Tingloy', zip: '4203' },
    { name: 'Tuy', zip: '4214' },
  ],
  Bulacan: [
    { name: 'Angat', zip: '3012' },
    { name: 'Balagtas', zip: '3016' },
    { name: 'Baliuag', zip: '3006' },
    { name: 'Bocaue', zip: '3018' },
    { name: 'Bulakan', zip: '3017' },
    { name: 'Bustos', zip: '3007' },
    { name: 'Calumpit', zip: '3003' },
    { name: 'Doña Remedios Trinidad', zip: '3009' },
    { name: 'Guiguinto', zip: '3015' },
    { name: 'Hagonoy', zip: '3002' },
    { name: 'Malolos', zip: '3000' },
    { name: 'Marilao', zip: '3019' },
    { name: 'Meycauayan', zip: '3020' },
    { name: 'Norzagaray', zip: '3013' },
    { name: 'Obando', zip: '3021' },
    { name: 'Pandi', zip: '3014' },
    { name: 'Paombong', zip: '3001' },
    { name: 'Plaridel', zip: '3004' },
    { name: 'Pulilan', zip: '3005' },
    { name: 'San Ildefonso', zip: '3010' },
    { name: 'San Jose del Monte', zip: '3023' },
    { name: 'San Miguel', zip: '3011' },
    { name: 'San Rafael', zip: '3008' },
    { name: 'Santa Maria', zip: '3022' },
  ],
}

export function isValidProvince(value: string): value is Province {
  return (PROVINCES as readonly string[]).includes(value)
}

export function citiesFor(province: string): CityOption[] {
  return isValidProvince(province) ? CITIES_BY_PROVINCE[province] : []
}

export function zipFor(province: string, city: string): string | undefined {
  return citiesFor(province).find(c => c.name === city)?.zip
}

// NCR ZIP defaults are a single starting guess per city — real NCR addresses
// have many codes by barangay/district, so the field should stay editable.
export function zipMayVaryByArea(province: string): boolean {
  return province === 'Metro Manila / NCR'
}
