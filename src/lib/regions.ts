/**
 * Continents for destination countries, so lists are grouped ("Africa",
 * "Asia", ...) and searchable by them. The payments partner sends each
 * corridor's `region`; this table is the fallback for an older server and for
 * plain country codes (an international group's countries).
 */
export type Region =
  | "africa"
  | "asia"
  | "europe"
  | "middle_east"
  | "north_america"
  | "south_america"
  | "oceania"
  | "other";

export const REGION_ORDER: Region[] = [
  "africa",
  "asia",
  "europe",
  "middle_east",
  "north_america",
  "south_america",
  "oceania",
  "other",
];

export const REGION_LABEL: Record<Region, string> = {
  africa: "Africa",
  asia: "Asia",
  europe: "Europe",
  middle_east: "Middle East",
  north_america: "North America",
  south_america: "South America",
  oceania: "Oceania",
  other: "Other",
};

const BY_REGION: Record<Exclude<Region, "other">, string[]> = {
  africa: [
    "NG",
    "GH",
    "KE",
    "TZ",
    "UG",
    "RW",
    "ZA",
    "ZM",
    "CM",
    "SN",
    "CI",
    "BJ",
    "TG",
    "ML",
    "BF",
    "NE",
    "EG",
    "MA",
    "ET",
  ],
  asia: [
    "CN",
    "HK",
    "SG",
    "IN",
    "ID",
    "MY",
    "PH",
    "TH",
    "VN",
    "JP",
    "KR",
    "PK",
    "BD",
    "LK",
    "NP",
    "TW",
  ],
  europe: [
    "GB",
    "AT",
    "BE",
    "CY",
    "DE",
    "EE",
    "ES",
    "FI",
    "FR",
    "GR",
    "HR",
    "IE",
    "IT",
    "LT",
    "LU",
    "LV",
    "MT",
    "NL",
    "PT",
    "SI",
    "SK",
    "CH",
    "SE",
    "NO",
    "DK",
    "PL",
    "CZ",
    "HU",
    "RO",
    "BG",
  ],
  middle_east: ["AE", "SA", "QA", "KW", "BH", "OM", "JO", "IL", "TR"],
  north_america: ["US", "CA", "MX"],
  south_america: ["BR", "CO", "AR", "CL", "PE", "UY", "EC"],
  oceania: ["AU", "NZ"],
};

const REGION_OF = new Map<string, Region>(
  (Object.entries(BY_REGION) as [Region, string[]][]).flatMap(
    ([region, countries]) => countries.map((c) => [c, region] as const),
  ),
);

const isRegion = (value: unknown): value is Region =>
  typeof value === "string" && (REGION_ORDER as string[]).includes(value);

/** The region a country is in: the server's word when given, else ours. */
export const regionOf = (country: string, fromServer?: unknown): Region =>
  isRegion(fromServer)
    ? fromServer
    : (REGION_OF.get(country.toUpperCase()) ?? "other");

/** "Africa, Asia & Middle East": the regions a set of countries spans. */
export const regionsLabel = (countries: string[]): string => {
  const labels = REGION_ORDER.filter((r) =>
    countries.some((c) => regionOf(c) === r),
  ).map((r) => REGION_LABEL[r]);
  if (labels.length <= 1) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} & ${labels[labels.length - 1]}`;
};
