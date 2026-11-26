export const ROLE_COLORS: Record<string, string> = {
  Doctor: '#7DD3FC',
  Mother: '#F9A8D4',
  Mediator: '#C6F432',
  Teacher: '#86EFAC',
  Youth: '#C4B5FD',
  Elder: '#FDBA74',
  Researcher: '#5EEAD4',
  Member: '#EEF2EA',
};
export const STORY_ROLES = ['Doctor', 'Mother', 'Mediator', 'Teacher', 'Youth', 'Elder'] as const;
export const PROFILE_ROLES = [...STORY_ROLES, 'Researcher', 'Member'] as const;
export const CONSENT_LABEL: Record<string, string> = {
  public: 'Public, with my name',
  pseudonymous: 'Public, without my name',
  researchers: 'Researchers only',
};
export const CONSENT_SHORT: Record<string, string> = {
  public: 'Public',
  pseudonymous: 'Pseudonymous',
  researchers: 'Researchers only',
};
export const REPORT_REASONS: [string, string][] = [
  ['child_safety', 'Child sexual abuse or exploitation'],
  ['threat', 'Threat of violence'],
  ['danger', 'Puts someone in danger (location, identity)'],
  ['hate', 'Illegal hate speech'],
  ['harassment', 'Harassment or bullying'],
  ['privacy', 'Shares private information without consent'],
  ['impersonation', 'Pretends to be someone else'],
  ['illegal', 'Other illegal content'],
  ['manipulation', 'Spam or coordinated fake activity'],
  ['spam', 'Spam'],
  ['false', 'Invented story presented as true'],
  ['other', 'Something else'],
];

export const APP_NAME = 'Verum Agora';
export const TAGLINE = 'Where Reality Connects';

export const POST_KINDS: Record<string, string> = {
  post: 'Post',
  question: 'Question',
  article: 'Article',
  research: 'Research & analysis',
};

export const LANGUAGES: [string, string][] = [
  ['en', 'English'], ['de', 'Deutsch'], ['fr', 'Français'], ['nl', 'Nederlands'], ['es', 'Español'],
  ['it', 'Italiano'], ['hr', 'Hrvatski'], ['pl', 'Polski'], ['pt', 'Português'], ['sr', 'Srpski'],
  ['bs', 'Bosanski'], ['sl', 'Slovenščina'], ['cs', 'Čeština'], ['sk', 'Slovenčina'], ['hu', 'Magyar'],
  ['ro', 'Română'], ['bg', 'Български'], ['el', 'Ελληνικά'], ['sv', 'Svenska'], ['da', 'Dansk'],
  ['fi', 'Suomi'], ['no', 'Norsk'], ['et', 'Eesti'], ['lv', 'Latviešu'], ['lt', 'Lietuvių'],
  ['ga', 'Gaeilge'], ['mt', 'Malti'], ['tr', 'Türkçe'], ['uk', 'Українська'], ['ar', 'العربية'],
];

// ISO 3166-1 alpha-2. "EU" is the code reserved for the European Union.
export const COUNTRIES: [string, string][] = [
  ['EU', 'European Union (EU-wide)'],
  ['AL', 'Albania'], ['AD', 'Andorra'], ['AT', 'Austria'], ['BY', 'Belarus'], ['BE', 'Belgium'], ['BA', 'Bosnia and Herzegovina'],
  ['BG', 'Bulgaria'], ['HR', 'Croatia'], ['CY', 'Cyprus'], ['CZ', 'Czechia'], ['DK', 'Denmark'], ['EE', 'Estonia'],
  ['FI', 'Finland'], ['FR', 'France'], ['GE', 'Georgia'], ['DE', 'Germany'], ['GR', 'Greece'], ['HU', 'Hungary'],
  ['IS', 'Iceland'], ['IE', 'Ireland'], ['IT', 'Italy'], ['XK', 'Kosovo'], ['LV', 'Latvia'], ['LI', 'Liechtenstein'],
  ['LT', 'Lithuania'], ['LU', 'Luxembourg'], ['MT', 'Malta'], ['MD', 'Moldova'], ['MC', 'Monaco'], ['ME', 'Montenegro'],
  ['NL', 'Netherlands'], ['MK', 'North Macedonia'], ['NO', 'Norway'], ['PL', 'Poland'], ['PT', 'Portugal'], ['RO', 'Romania'],
  ['RU', 'Russia'], ['SM', 'San Marino'], ['RS', 'Serbia'], ['SK', 'Slovakia'], ['SI', 'Slovenia'], ['ES', 'Spain'],
  ['SE', 'Sweden'], ['CH', 'Switzerland'], ['TR', 'Türkiye'], ['UA', 'Ukraine'], ['GB', 'United Kingdom'],
  ['DZ', 'Algeria'], ['AR', 'Argentina'], ['AU', 'Australia'], ['BR', 'Brazil'], ['CA', 'Canada'], ['CN', 'China'],
  ['EG', 'Egypt'], ['IN', 'India'], ['ID', 'Indonesia'], ['IR', 'Iran'], ['IQ', 'Iraq'], ['IL', 'Israel'], ['JP', 'Japan'],
  ['JO', 'Jordan'], ['LB', 'Lebanon'], ['LY', 'Libya'], ['MY', 'Malaysia'], ['MX', 'Mexico'], ['MA', 'Morocco'],
  ['NG', 'Nigeria'], ['PK', 'Pakistan'], ['PS', 'Palestine'], ['SA', 'Saudi Arabia'], ['ZA', 'South Africa'],
  ['KR', 'South Korea'], ['SD', 'Sudan'], ['SY', 'Syria'], ['TN', 'Tunisia'], ['AE', 'United Arab Emirates'],
  ['US', 'United States'], ['VN', 'Vietnam'], ['YE', 'Yemen'],
];
export const countryName = (code: string | null | undefined) => (code ? COUNTRIES.find((c) => c[0] === code)?.[1] ?? code : '');
export const languageName = (code: string | null | undefined) => (code ? LANGUAGES.find((l) => l[0] === code)?.[1] ?? code : '');
