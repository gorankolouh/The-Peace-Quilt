// Preview mode: answers the app's Supabase requests from in-memory sample data,
// so the real app can be clicked through without a backend. Nothing is saved.

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export const DEMO_URL = 'https://demo.supabase.co';
export const DEMO_ME = '00000000-0000-4000-8000-000000000001';

const P = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const ago = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

const profiles: Row[] = [
  { id: DEMO_ME, username: 'demo', display_name: 'Demo account', role: 'Mediator', bio: 'Collecting peace stories from the Riverside district.', is_researcher: false, is_moderator: false, created_at: ago(900) },
  { id: P(2), username: 'lena_mediates', display_name: 'Lena Haddad', role: 'Mediator', bio: 'Community mediator. Water, bread and schools first.', is_researcher: false, is_moderator: false, created_at: ago(800) },
  { id: P(3), username: 'miravos', display_name: 'Dr. Mira Vos', role: 'Researcher', bio: 'I study local agreements that no government signed.', is_researcher: true, is_moderator: false, created_at: ago(700) },
  { id: P(4), username: 'youssef_a', display_name: 'Youssef A.', role: 'Teacher', bio: 'Teacher. Two shifts, one classroom.', is_researcher: false, is_moderator: false, created_at: ago(600) },
  { id: P(5), username: 'archive', display_name: 'Archive team', role: 'Member', bio: 'We look after the quilt.', is_researcher: false, is_moderator: true, created_at: ago(1000) },
  { id: P(6), username: 'dr_okafor', display_name: 'Dr. Samir Okafor', role: 'Doctor', bio: 'Field clinic, Hill villages.', is_researcher: false, is_moderator: false, created_at: ago(300) },
  { id: P(7), username: 'twovoices', display_name: 'Youth Choir Collective', role: 'Youth', bio: 'Songs in two languages.', is_researcher: false, is_moderator: false, created_at: ago(200) },
];

const RAW: [string, string, number, number, string, string][] = [
  ['We kept the generator running', 'Doctor', 1, 1, 'For eleven nights the staff took turns guarding fuel for the generator. Neighbours from both sides brought diesel in jerrycans.', 'public'],
  ['The sheets on the roof', 'Elder', 1, 1, 'We painted a red crescent and a red cross side by side on bedsheets and laid them on the hospital roof.', 'pseudonymous'],
  ['Blood donors from across the line', 'Youth', 1, 3, 'A group chat of forty students organised blood donations from both communities within a day.', 'public'],
  ['Nobody asked which side', 'Doctor', 1, 2, 'In the field clinic we stopped writing down which village patients came from. Only their injuries.', 'public'],
  ['Mothers at the gate', 'Mother', 1, 1, 'When armed men came to the gate, twelve mothers sat down in front of it and refused to move.', 'pseudonymous'],
  ['Night shift letters', 'Doctor', 1, 3, 'Patients wrote notes to the families of the wounded from the other side, two beds away.', 'public'],
  ['The water-pump truce', 'Elder', 2, 2, 'Two villages agreed to share one pump: mornings for one, afternoons for the other. It held for two years.', 'public'],
  ['Market day without weapons', 'Mediator', 2, 3, 'Traders agreed the Thursday market would be weapon-free. Then Friday, then the whole week.', 'public'],
  ['Tea on both ends of the bridge', 'Mediator', 2, 4, 'Commanders met halfway across the bridge. We had tea ready on both ends.', 'public'],
  ['The harvest corridor', 'Elder', 2, 2, 'Farmers negotiated six quiet hours a day to bring in the olive harvest.', 'pseudonymous'],
  ['The football field rule', 'Youth', 2, 5, 'Whoever plays on the field leaves politics at the gate. The boys wrote the rule themselves.', 'public'],
  ['Copying the pump deal', 'Mediator', 2, 1, 'We heard about the water-pump agreement and used the same wording for our bakery.', 'public'],
  ['Kitchen table talks', 'Mother', 3, 5, 'Our husbands would not meet, so we cooked together and talked. The first agreement was written on a recipe card.', 'pseudonymous'],
  ['Lists of the missing', 'Mother', 3, 4, 'Women from both communities shared their lists of missing sons. Forty families got news.', 'public'],
  ['The sewing circle', 'Teacher', 3, 3, 'Each family brought a piece of fabric for one quilt. While we sewed, we negotiated.', 'public'],
  ["Through the commander's wife", 'Mediator', 3, 2, 'Sometimes the shortest road to a commander goes through his wife.', 'pseudonymous'],
  ['Radio for mothers', 'Mother', 3, 1, 'A weekly radio hour where mothers from both sides read letters to each other.', 'public'],
  ['Translating grief', 'Teacher', 3, 5, 'I translated between two mothers who lost sons in the same week. After a month they no longer needed me.', 'public'],
  ['The ambulance code', 'Doctor', 4, 4, 'A three-word radio code meant: ambulance passing, hold fire. Both sides learned it.', 'public'],
  ['Walking the children through', 'Teacher', 4, 4, 'Every morning I walked twenty-three children past the checkpoint to school.', 'public'],
  ["The bus driver's list", 'Elder', 4, 5, 'I gave my passenger list to both checkpoints. Nobody went missing on my bus.', 'pseudonymous'],
  ['Escorted by grandmothers', 'Elder', 4, 2, 'Young men could not pass alone, so grandmothers walked with them.', 'public'],
  ['Two shifts, one classroom', 'Teacher', 5, 3, 'Morning shift for one community, afternoon for the other. In the third year we merged.', 'public'],
  ['The first joint exam', 'Youth', 5, 1, 'We sat the same exam in the same room. Nobody cheated, nobody fought.', 'public'],
  ['Books from the other side', 'Teacher', 5, 2, 'A library across the line sent us three hundred books with notes inside the covers.', 'public'],
  ["The parents' committee", 'Mother', 5, 3, 'Five mothers from each side ran the school when the ministry could not.', 'public'],
  ['A choir in two languages', 'Youth', 5, 5, 'We formed a choir that sang in both languages at the reopening.', 'public'],
  ['The teacher who stayed', 'Teacher', 5, 4, 'When the others left, she stayed and taught in a tent for a year.', 'public'],
];
const authorFor: Record<string, string> = { Doctor: P(6), Mediator: P(2), Teacher: P(4), Youth: P(7), Mother: P(3), Elder: P(5) };
const stories: Row[] = RAW.map((r, i) => ({
  id: i + 1, author_id: i === 11 ? DEMO_ME : authorFor[r[1]], title: r[0], role: r[1], theme_id: r[2], region_id: r[3], body: r[4],
  consent: r[5], media_path: null, media_kind: null, hidden: false, created_at: ago((RAW.length - i) * 7),
}));

const SUBJECTS: [number, string, string, string][] = [
  [1, 'politics-democracy', 'Politics & Democracy', 'Elections, governments, democratic institutions, public policy, corruption, transparency and civic participation.'],
  [2, 'peace-international', 'Peace & International Affairs', 'Wars, diplomacy, international relations, conflict prevention, humanitarian affairs and peacebuilding.'],
  [3, 'human-rights-justice', 'Human Rights & Justice', 'Equality, discrimination, international law, civil liberties, migration, access to justice and human rights violations.'],
  [4, 'business-entrepreneurship', 'Business & Entrepreneurship', 'Small businesses, startups, entrepreneurship, employment, international trade and business development.'],
  [5, 'economy-finance', 'Economy & Finance', 'Inflation, banking, taxation, public spending, economic policies, financial systems and inequality.'],
  [6, 'education-knowledge', 'Education & Knowledge', 'Schools, universities, scientific research, educational policy, professional training and lifelong learning.'],
  [7, 'children-family-society', 'Children, Family & Society', "Children's rights, parenting, families, aging populations, social welfare and social development."],
  [8, 'technology-digital', 'Technology & Digital Life', 'Artificial intelligence, cybersecurity, digital sovereignty, online platforms, data protection and emerging technologies.'],
  [9, 'health-wellbeing', 'Health & Wellbeing', 'Healthcare, public health, medical research, mental health, healthcare policy and wellbeing.'],
  [10, 'environment-sustainability', 'Environment & Sustainability', 'Climate change, biodiversity, pollution, energy, environmental protection and sustainable development.'],
  [11, 'culture-media-identity', 'Culture, Media & Identity', 'Journalism, media freedom, cultural heritage, arts, languages, religion, identity and media literacy.'],
  [12, 'communities-everyday', 'Communities & Everyday Life', 'Housing, transport, accessibility, local issues, public services, infrastructure and community development.'],
];
const SUBTOPICS: [number, string][] = [
  [1, 'Elections'], [1, 'Public policy'], [1, 'Corruption & transparency'], [2, 'Diplomacy'], [2, 'Humanitarian affairs'], [2, 'Peacebuilding'],
  [3, 'Equality & discrimination'], [3, 'Migration'], [3, 'Access to justice'], [4, 'Small businesses'], [4, 'Employment'], [5, 'Inflation & prices'],
  [5, 'Taxation & public spending'], [6, 'Schools'], [6, 'Education policy'], [6, 'Universities & research'], [7, "Children's rights"], [7, 'Social welfare'],
  [8, 'Artificial intelligence'], [8, 'Data protection'], [8, 'Digital sovereignty'], [9, 'Public health'], [9, 'Mental health'], [10, 'Energy'],
  [10, 'Climate change'], [11, 'Journalism & media freedom'], [11, 'Media literacy'], [12, 'Housing'], [12, 'Transport'],
];
const subtopics: Row[] = SUBTOPICS.map(([subject_id, name], i) => ({ id: i + 1, subject_id, name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-') }));
const st = (name: string) => subtopics.find((x) => x.name === name)!.id;

type Seed = { a: string; k: string; t: string | null; b: string; h: number; s: number[]; st?: string[]; tags?: string[]; c?: string; l?: string; src?: { url: string; title?: string }[] };
const SEED: Seed[] = [
  { a: P(3), k: 'research', t: 'Public school funding in Germany: what the 2026 state budgets show', h: 2, s: [6, 5], st: ['Education policy', 'Taxation & public spending'], tags: ['school funding', 'teacher shortage'], c: 'DE',
    b: 'We compared the 2026 education budgets of all sixteen German states. Spending per pupil ranges from about 8,900 to 12,400 euros, and the gap has widened since 2022.\n\nThe states with the largest teacher shortages are not the ones spending least. Shortages follow demographics and pay structures more than total budgets.\n\nThe full table and our method are linked below, so anyone can check and extend the figures.',
    src: [{ url: 'https://www.destatis.de/', title: 'Federal Statistical Office (Destatis)' }, { url: 'https://www.kmk.org/', title: 'Standing Conference of Education Ministers (KMK)' }] },
  { a: P(4), k: 'question', t: 'How is public school funding decided in the Netherlands?', h: 4, s: [6], st: ['Education policy'], tags: ['school funding'], c: 'NL',
    b: 'I teach in Germany and keep hearing that Dutch schools get a lump sum per pupil and decide themselves how to spend it. Is that accurate, and has it helped with teacher shortages?' },
  { a: P(2), k: 'post', t: null, h: 6, s: [2, 3], st: ['Peacebuilding'], tags: ['local agreements'],
    b: 'Three villages now use the same water-sharing wording. Local agreements copy each other faster than any treaty. If you helped make one, add it to the Peace Quilt collection.' },
  { a: P(6), k: 'article', t: 'AI hiring tools and discrimination: what the EU AI Act changes for employers', h: 9, s: [8, 3, 4], st: ['Artificial intelligence', 'Equality & discrimination', 'Employment'], tags: ['ai act', 'algorithmic hiring'], c: 'EU',
    b: 'Recruitment software that ranks candidates is classed as high-risk under the EU AI Act. From August 2026, employers using such systems must keep logs, ensure human oversight and inform candidates.\n\nIn practice, many small companies do not know the tools they license fall under these rules. This article explains what to ask your vendor.',
    src: [{ url: 'https://eur-lex.europa.eu/eli/reg/2024/1689/oj', title: 'Regulation (EU) 2024/1689 (AI Act)' }] },
  { a: P(5), k: 'post', t: 'Teacher shortage: Croatia raises starting salaries', h: 12, s: [6, 5], st: ['Schools'], tags: ['teacher shortage'], c: 'HR', l: 'en',
    b: 'Croatia announced higher starting salaries for teachers from January. Unions say it closes only part of the gap with other public-sector jobs. Similar debates are running in Germany and Slovenia.' },
  { a: P(7), k: 'post', t: null, h: 20, s: [12, 10], st: ['Transport', 'Energy'], tags: ['public transport'], c: 'AT',
    b: 'Vienna’s annual public transport pass still costs one euro a day. Ridership is up, car ownership in the city is down. Would a model like this work in your city?' },
  { a: P(3), k: 'article', t: 'Children in conflict zones lose years of schooling. What helps them catch up?', h: 30, s: [2, 6, 7, 3], st: ['Humanitarian affairs', "Children's rights", 'Schools'], tags: ['education in emergencies'], c: 'PS',
    b: 'When schools close during conflict, children do not just lose time. They lose the routine, safety and meals that school provides.\n\nAccelerated learning programmes, community classrooms and radio lessons have all shown results. This piece collects what worked, with links to the evaluations.',
    src: [{ url: 'https://inee.org/', title: 'Inter-agency Network for Education in Emergencies' }] },
  { a: P(6), k: 'question', t: 'Which European cloud providers are actually EU-owned?', h: 40, s: [8], st: ['Digital sovereignty', 'Data protection'], tags: ['european cloud'],
    b: 'Server location in Frankfurt does not mean European control. I am collecting providers by ownership and legal jurisdiction. Please add sources.' },
];
const posts: Row[] = SEED.map((x, i) => ({
  id: i + 1, author_id: x.a, kind: x.k, title: x.t, body: x.b, created_at: ago(x.h), media_path: null, media_kind: null, hidden: false,
  language: x.l ?? 'en', country: x.c ?? null, sources: x.src ?? [], updated_at: null,
}));
const postSubjects: Row[] = SEED.flatMap((x, i) => x.s.map((subject_id) => ({ post_id: i + 1, subject_id })));
const postSubtopics: Row[] = SEED.flatMap((x, i) => (x.st ?? []).map((n) => ({ post_id: i + 1, subtopic_id: st(n) })));
const postTags: Row[] = SEED.flatMap((x, i) => (x.tags ?? []).map((tag) => ({ post_id: i + 1, tag })));

const db: Record<string, Row[]> = {
  themes: [
    { id: 1, name: 'Protecting a hospital', short: 'Hospital' },
    { id: 2, name: 'A chain of local agreements', short: 'Local agreements' },
    { id: 3, name: "Women's cross-community mediation", short: "Women's mediation" },
    { id: 4, name: 'Safe passage', short: 'Safe passage' },
    { id: 5, name: 'Reopening schools', short: 'Schools' },
  ],
  regions: [
    { id: 1, name: 'Riverside district' }, { id: 2, name: 'Hill villages' }, { id: 3, name: 'Old town' },
    { id: 4, name: 'Border crossing' }, { id: 5, name: 'Coastal camp' },
  ],
  profiles,
  stories,
  posts,
  subjects: SUBJECTS.map(([id, slug, name, description]) => ({ id, slug, name, description, sort: id })),
  subtopics,
  post_subjects: postSubjects,
  post_subtopics: postSubtopics,
  post_tags: postTags,
  user_interests: [6, 8, 3].map((subject_id) => ({ user_id: DEMO_ME, subject_id })),
  likes: [
    ...stories.slice(0, 20).flatMap((s, i) => profiles.slice(1, 2 + (i % 5)).map((p) => ({ user_id: p.id, target_type: 'story', target_id: s.id, created_at: ago(1) }))),
    ...posts.flatMap((x) => profiles.slice(1, 6).map((p) => ({ user_id: p.id, target_type: 'post', target_id: x.id, created_at: ago(1) }))),
  ],
  comments: [
    { id: 1, author_id: P(2), target_type: 'story', target_id: 13, body: 'We did the same with the bakery agreement. Recipes are safer than minutes.', hidden: false, created_at: ago(2) },
    { id: 2, author_id: P(4), target_type: 'post', target_id: 1, body: 'Very useful. Do you have the same table for 2022, to compare?', hidden: false, created_at: ago(1.5) },
    { id: 3, author_id: P(3), target_type: 'post', target_id: 2, body: 'Mostly yes: Dutch schools receive a lump sum per pupil. I linked a comparison in my research post on German funding.', hidden: false, created_at: ago(3) },
  ],
  follows: [P(2), P(3), P(4), P(5)].map((id) => ({ follower_id: DEMO_ME, followee_id: id, created_at: ago(100) }))
    .concat([P(2), P(3), P(6)].map((id) => ({ follower_id: id, followee_id: DEMO_ME, created_at: ago(90) }))),
  conversations: [{ id: 'lena', created_at: ago(5) }, { id: 'mira', created_at: ago(9) }],
  conversation_members: [
    { conversation_id: 'lena', user_id: DEMO_ME, last_read_at: ago(10) }, { conversation_id: 'lena', user_id: P(2), last_read_at: ago(0) },
    { conversation_id: 'mira', user_id: DEMO_ME, last_read_at: ago(0) }, { conversation_id: 'mira', user_id: P(3), last_read_at: ago(0) },
  ],
  messages: [
    { id: 1, conversation_id: 'lena', sender_id: P(2), body: 'I read your piece about the bakery agreement.', created_at: ago(1.2) },
    { id: 2, conversation_id: 'lena', sender_id: P(2), body: 'Can we link it to the water-pump story? Same wording, two villages apart.', created_at: ago(1) },
    { id: 3, conversation_id: 'mira', sender_id: DEMO_ME, body: 'Which metadata fields do you use for testimonies?', created_at: ago(8) },
    { id: 4, conversation_id: 'mira', sender_id: P(3), body: 'Role, region, date, theme, outcome. Sending you our list now.', created_at: ago(7.5) },
  ],
  blocks: [],
  reports: [],
};
const nextId: Record<string, number> = { stories: 100, posts: 100, comments: 100, messages: 100, reports: 1 };
let me: string | null = DEMO_ME;

function view(name: string): Row[] {
  if (name === 'stories_v') {
    return db.stories.filter((s) => s.author_id === me || !s.hidden).map((s) => ({
      ...s,
      author_id: s.consent === 'public' || s.author_id === me ? s.author_id : null,
      is_mine: s.author_id === me,
      like_count: db.likes.filter((l) => l.target_type === 'story' && l.target_id === s.id).length,
      comment_count: db.comments.filter((c) => c.target_type === 'story' && c.target_id === s.id).length,
      liked: db.likes.some((l) => l.target_type === 'story' && l.target_id === s.id && l.user_id === me),
    }));
  }
  if (name === 'posts_v') {
    return db.posts.filter((p) => p.author_id === me || !p.hidden).map((p) => ({
      ...p,
      is_mine: p.author_id === me,
      like_count: db.likes.filter((l) => l.target_type === 'post' && l.target_id === p.id).length,
      comment_count: db.comments.filter((c) => c.target_type === 'post' && c.target_id === p.id).length,
      liked: db.likes.some((l) => l.target_type === 'post' && l.target_id === p.id && l.user_id === me),
      subject_ids: db.post_subjects.filter((x) => x.post_id === p.id).map((x) => x.subject_id).sort((a, b) => a - b),
      subtopic_ids: db.post_subtopics.filter((x) => x.post_id === p.id).map((x) => x.subtopic_id),
      tags: db.post_tags.filter((x) => x.post_id === p.id).map((x) => x.tag).sort(),
    }));
  }
  return db[name] ?? [];
}

function parseVal(v: string): string { return v.replace(/^"|"$/g, ''); }
function test(row: Row, col: string, expr: string): boolean {
  const neg = expr.startsWith('not.');
  if (neg) expr = expr.slice(4);
  const dot = expr.indexOf('.');
  const op = expr.slice(0, dot), raw = expr.slice(dot + 1);
  const cell = row[col];
  let ok = false;
  if (op === 'eq') ok = String(cell) === parseVal(raw);
  else if (op === 'neq') ok = String(cell) !== parseVal(raw);
  else if (op === 'is') ok = raw === 'null' ? cell == null : String(cell) === raw;
  else if (op === 'in') ok = raw.replace(/^\(|\)$/g, '').split(',').map(parseVal).includes(String(cell));
  else if (op === 'cs' || op === 'ov') {
    const want = raw.replace(/^\{|\}$/g, '').split(',').filter(Boolean).map(parseVal);
    const have = (Array.isArray(cell) ? cell : []).map(String);
    ok = op === 'cs' ? want.every((w) => have.includes(w)) : want.some((w) => have.includes(w));
  } else if (op.startsWith('wfts') || op.startsWith('fts') || op.startsWith('plfts')) {
    const words = decodeURIComponent(raw.slice(raw.indexOf(')') + 1 || 0)).toLowerCase().split(/\s+/).filter(Boolean);
    const text = `${row.title ?? ''} ${row.body ?? ''}`.toLowerCase();
    ok = words.every((w) => text.includes(w));
  }
  return neg ? !ok : ok;
}
function filter(rows: Row[], params: URLSearchParams): Row[] {
  let out = rows;
  params.forEach((v, k) => {
    if (['select', 'order', 'limit', 'offset', 'columns'].includes(k)) return;
    if (k === 'or') {
      const parts = v.replace(/^\(|\)$/g, '').split(',');
      out = out.filter((r) => parts.some((p) => { const d = p.indexOf('.'); return test(r, p.slice(0, d), p.slice(d + 1)); }));
      return;
    }
    out = out.filter((r) => test(r, k, v));
  });
  const order = params.get('order');
  if (order) {
    const [col, dir] = order.split('.');
    out = [...out].sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (dir === 'desc' ? -1 : 1));
  }
  const limit = params.get('limit');
  if (limit) out = out.slice(0, Number(limit));
  return out;
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(body === null ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

const user = () => ({ id: DEMO_ME, aud: 'authenticated', role: 'authenticated', email: 'demo@peacequilt.example', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: ago(900) });
export function demoSession() {
  return { access_token: 'demo', refresh_token: 'demo', token_type: 'bearer', expires_in: 3600 * 24 * 365, expires_at: Math.floor(Date.now() / 1000) + 3600 * 24 * 365, user: user() };
}

function rpc(fn: string, args: Row): unknown {
  if (fn === 'my_conversations') {
    return db.conversation_members.filter((m) => m.user_id === me).map((m) => {
      const other = db.conversation_members.find((o) => o.conversation_id === m.conversation_id && o.user_id !== me)!;
      const msgs = db.messages.filter((x) => x.conversation_id === m.conversation_id).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      return {
        conversation_id: m.conversation_id, other_id: other.user_id, last_body: msgs[0]?.body ?? null, last_at: msgs[0]?.created_at ?? null,
        last_sender: msgs[0]?.sender_id ?? null, unread: msgs.filter((x) => x.sender_id !== me && x.created_at > m.last_read_at).length,
      };
    }).sort((a, b) => ((a.last_at ?? '') < (b.last_at ?? '') ? 1 : -1));
  }
  if (fn === 'start_conversation') {
    const mine = db.conversation_members.filter((m) => m.user_id === me).map((m) => m.conversation_id);
    const hit = db.conversation_members.find((m) => m.user_id === args.other && mine.includes(m.conversation_id));
    if (hit) return hit.conversation_id;
    const id = 'c-' + Math.random().toString(36).slice(2, 8);
    db.conversations.push({ id, created_at: new Date().toISOString() });
    db.conversation_members.push({ conversation_id: id, user_id: me, last_read_at: new Date().toISOString() }, { conversation_id: id, user_id: args.other, last_read_at: new Date().toISOString() });
    return id;
  }
  if (fn === 'mark_read') {
    db.conversation_members.filter((m) => m.conversation_id === args.conv && m.user_id === me).forEach((m) => { m.last_read_at = new Date().toISOString(); });
    return null;
  }
  if (fn === 'delete_my_account') { me = null; return null; }
  if (fn === 'related_posts') {
    const all = view('posts_v');
    const base = all.find((p) => p.id === args.pid);
    if (!base) return [];
    return all.filter((p) => p.id !== base.id).map((p) => {
      const ss = p.subject_ids.filter((x: number) => base.subject_ids.includes(x)).length;
      const stt = p.subtopic_ids.filter((x: number) => base.subtopic_ids.includes(x)).length;
      const tg = p.tags.filter((x: string) => base.tags.includes(x));
      const sc = !!(p.country && p.country === base.country);
      return { post_id: p.id, score: stt * 3 + tg.length * 3 + ss + (sc ? 2 : 0), shared_subjects: ss, shared_subtopics: stt, shared_tags: tg, same_country: sc };
    }).filter((r) => r.score > 0).sort((a, b) => b.score - a.score).slice(0, args.max_results || 8);
  }
  return null;
}

function scheduleReply(conv: string) {
  const other = db.conversation_members.find((m) => m.conversation_id === conv && m.user_id !== me)?.user_id;
  if (!other) return;
  setTimeout(() => {
    db.messages.push({ id: nextId.messages++, conversation_id: conv, sender_id: other, body: 'Thank you. Let’s connect our pieces.', created_at: new Date().toISOString() });
  }, 1500);
}

export async function demoFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  const method = (init.method || 'GET').toUpperCase();
  const headers = new Headers(init.headers);
  const path = url.pathname;

  if (path.startsWith('/auth/v1/')) {
    if (path.endsWith('/user')) return json(user());
    if (path.endsWith('/logout')) { me = null; return new Response(null, { status: 204 }); }
    if (path.endsWith('/token')) { me = DEMO_ME; return json(demoSession()); }
    return json({});
  }
  if (path.startsWith('/storage/v1/')) {
    if (path.includes('/object/list/')) return json([]);
    if (path.includes('/object/sign/')) return json({ message: 'Files are not stored in the preview' }, 400);
    return json({ Key: 'media/preview' });
  }
  if (path.startsWith('/rest/v1/rpc/')) {
    const args = init.body ? JSON.parse(String(init.body)) : {};
    return json(rpc(path.slice('/rest/v1/rpc/'.length), args));
  }
  const table = path.replace('/rest/v1/', '');
  const params = url.searchParams;
  const single = (headers.get('Accept') || '').includes('vnd.pgrst.object');
  const prefer = headers.get('Prefer') || '';

  if (method === 'GET' || method === 'HEAD') {
    const all = filter(view(table), params);
    if (method === 'HEAD' || prefer.includes('count=exact')) {
      return new Response(method === 'HEAD' ? null : JSON.stringify(all), { status: 200, headers: { 'Content-Type': 'application/json', 'Content-Range': `0-${Math.max(0, all.length - 1)}/${all.length}` } });
    }
    if (single) return all.length ? json(all[0]) : json({ code: 'PGRST116', message: 'No rows' }, 406);
    return json(all);
  }
  if (method === 'POST') {
    const body = JSON.parse(String(init.body || '[]'));
    const rows = (Array.isArray(body) ? body : [body]).map((r: Row) => {
      const row: Row = { created_at: new Date().toISOString(), ...r };
      if (table in nextId && row.id === undefined) row.id = nextId[table]++;
      if (table === 'stories' || table === 'posts' || table === 'comments') row.hidden = false;
      if (table === 'messages') scheduleReply(row.conversation_id);
      return row;
    });
    (db[table] ||= []).push(...rows);
    if (prefer.includes('return=representation')) return json(single ? rows[0] : rows, 201);
    return new Response(null, { status: 201 });
  }
  if (method === 'PATCH') {
    const patch = JSON.parse(String(init.body || '{}'));
    filter(db[table] || [], params).forEach((r) => Object.assign(r, patch));
    return new Response(null, { status: 204 });
  }
  if (method === 'DELETE') {
    const gone = new Set(filter(db[table] || [], params));
    db[table] = (db[table] || []).filter((r) => !gone.has(r));
    return new Response(null, { status: 204 });
  }
  return json({}, 400);
}
