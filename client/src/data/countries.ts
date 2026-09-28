// ISO 3166-1 codes from IANA tzdb iso3166.tab (public domain, 2025-07-01).
// https://data.iana.org/time-zones/tzdb/iso3166.tab
// XK adds Kosovo, supported by the location provider and Unicode display names.
const codes = "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW XK".split(' ');
const english = new Intl.DisplayNames(['en'], { type: 'region' });
const hebrew = new Intl.DisplayNames(['he'], { type: 'region' });
const aliases: Record<string, string[]> = {
  US: ['USA', 'United States of America'], GB: ['UK', 'Great Britain', 'Britain'],
  AE: ['UAE'], KR: ['Republic of Korea'], CZ: ['Czech Republic'], TR: ['Turkey', 'Türkiye'],
  VA: ['Vatican City', 'Holy See'], CI: ['Ivory Coast'], TW: ['Taiwan'], PS: ['Palestine'],
};
export function normalizeLocation(value: string) {
  return value.normalize('NFD').replace(/\p{M}/gu, '').trim().toLocaleLowerCase();
}
export const countries = codes.map(code => ({
  code, english: english.of(code) ?? code, hebrew: hebrew.of(code) ?? code,
  aliases: aliases[code] ?? [],
}));
export function resolveCountry(value: string) {
  const normalized = normalizeLocation(value);
  return countries.find(country => [country.code, country.english, country.hebrew, ...country.aliases]
    .some(name => normalizeLocation(name) === normalized));
}
export function findCountries(query: string, language: 'en' | 'he') {
  const normalized = normalizeLocation(query);
  return countries.filter(country => [country.code, country.english, country.hebrew, ...country.aliases]
    .some(name => normalizeLocation(name).includes(normalized)))
    .map(country => ({ id: country.code, label: language === 'he' ? country.hebrew : country.english }))
    .sort((a, b) => a.label.localeCompare(b.label, language));
}
