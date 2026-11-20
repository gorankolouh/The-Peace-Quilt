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
  ['danger', 'Puts someone in danger (location, identity)'],
  ['illegal', 'Illegal content'],
  ['harassment', 'Harassment or hate'],
  ['privacy', 'Shares private information'],
  ['false', 'Clearly false or invented story'],
  ['spam', 'Spam'],
  ['other', 'Something else'],
];
