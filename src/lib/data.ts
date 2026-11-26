import { supabase } from './supabase';
import type { Appeal, Claim, ClaimInput, Comment, Conflict, ContentReport, EventClaim, Evidence, Nature, Review, ReviewStatus, Conversation, FeedItem, Message, Post, PostKind, Profile, Region, Related, Source, Story, Subject, Subtopic, Theme } from './types';

export const POST_COLS = 'id,author_id,kind,title,body,media_path,media_kind,created_at,is_mine,like_count,comment_count,liked,language,country,sources,updated_at,subject_ids,subtopic_ids,tags,nature,claim_count,signal_context,signal_conflict,signal_correction';

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

/* ---------- reference data ---------- */
let themesCache: Theme[] | null = null;
let regionsCache: Region[] | null = null;
export async function getThemes(): Promise<Theme[]> {
  if (!themesCache) themesCache = check(await supabase.from('themes').select('*').order('id'));
  return themesCache;
}
export async function getRegions(): Promise<Region[]> {
  if (!regionsCache) regionsCache = check(await supabase.from('regions').select('*').order('id'));
  return regionsCache;
}

/* ---------- profiles ---------- */
const profileCache = new Map<string, Profile>();
export function cachedProfile(id: string | null | undefined) {
  return id ? profileCache.get(id) : undefined;
}
export async function getProfiles(ids: (string | null | undefined)[]): Promise<Map<string, Profile>> {
  const need = [...new Set(ids.filter((x): x is string => !!x && !profileCache.has(x)))];
  if (need.length) {
    const rows = check(await supabase.from('profiles').select('*').in('id', need)) as Profile[];
    rows.forEach((p) => profileCache.set(p.id, p));
  }
  return profileCache;
}
export function forgetProfile(id: string) {
  profileCache.delete(id);
}
export async function getProfileByUsername(username: string): Promise<Profile | null> {
  const p = check(await supabase.from('profiles').select('*').eq('username', username).maybeSingle()) as Profile | null;
  if (p) profileCache.set(p.id, p);
  return p;
}
export async function suggestedProfiles(me: string | undefined): Promise<Profile[]> {
  let q = supabase.from('profiles').select('*').not('username', 'is', null).order('created_at', { ascending: false }).limit(8);
  if (me) q = q.neq('id', me);
  const rows = check(await q) as Profile[];
  rows.forEach((p) => profileCache.set(p.id, p));
  return rows;
}
export async function updateMyProfile(id: string, patch: Partial<Pick<Profile, 'username' | 'display_name' | 'role' | 'bio'>>) {
  check(await supabase.from('profiles').update(patch).eq('id', id));
  profileCache.delete(id);
}

/* ---------- feeds ---------- */
export async function followingIds(me: string): Promise<string[]> {
  const rows = check(await supabase.from('follows').select('followee_id').eq('follower_id', me)) as { followee_id: string }[];
  return rows.map((r) => r.followee_id);
}
function merge(stories: Story[], posts: Post[]): FeedItem[] {
  const items: FeedItem[] = [
    ...stories.map((s) => ({ type: 'story' as const, item: s })),
    ...posts.map((p) => ({ type: 'post' as const, item: p })),
  ];
  return items.sort((a, b) => b.item.created_at.localeCompare(a.item.created_at));
}
export async function followingFeed(me: string): Promise<FeedItem[]> {
  const ids = [...(await followingIds(me)), me];
  const [stories, posts] = await Promise.all([
    supabase.from('stories_v').select('*').in('author_id', ids).order('created_at', { ascending: false }).limit(40),
    supabase.from('posts_v').select(POST_COLS).in('author_id', ids).order('created_at', { ascending: false }).limit(40),
  ]);
  const s = check(stories) as Story[];
  const p = check(posts) as Post[];
  await getProfiles([...s.map((x) => x.author_id), ...p.map((x) => x.author_id)]);
  return merge(s, p);
}
export async function everythingFeed(): Promise<FeedItem[]> {
  const [stories, posts] = await Promise.all([
    supabase.from('stories_v').select('*').order('created_at', { ascending: false }).limit(30),
    supabase.from('posts_v').select(POST_COLS).order('created_at', { ascending: false }).limit(30),
  ]);
  const s = check(stories) as Story[];
  const p = check(posts) as Post[];
  await getProfiles([...s.map((x) => x.author_id), ...p.map((x) => x.author_id)]);
  return merge(s, p);
}
export async function newestStories(limit = 40): Promise<Story[]> {
  const s = check(await supabase.from('stories_v').select('*').order('created_at', { ascending: false }).limit(limit)) as Story[];
  await getProfiles(s.map((x) => x.author_id));
  return s;
}
export async function articles(): Promise<Post[]> {
  const p = check(await supabase.from('posts_v').select(POST_COLS).in('kind', ['article', 'research']).order('created_at', { ascending: false }).limit(30)) as Post[];
  await getProfiles(p.map((x) => x.author_id));
  return p;
}
export async function allStories(): Promise<Story[]> {
  return check(await supabase.from('stories_v').select('*').order('created_at', { ascending: true }).limit(1000)) as Story[];
}
export async function storiesBy(author: string): Promise<Story[]> {
  return check(await supabase.from('stories_v').select('*').eq('author_id', author).order('created_at', { ascending: false })) as Story[];
}
export async function postsBy(author: string): Promise<Post[]> {
  return check(await supabase.from('posts_v').select(POST_COLS).eq('author_id', author).order('created_at', { ascending: false })) as Post[];
}
export async function getStory(id: number): Promise<Story | null> {
  const s = check(await supabase.from('stories_v').select('*').eq('id', id).maybeSingle()) as Story | null;
  if (s) await getProfiles([s.author_id]);
  return s;
}
export async function getPost(id: number): Promise<Post | null> {
  const p = check(await supabase.from('posts_v').select(POST_COLS).eq('id', id).maybeSingle()) as Post | null;
  if (p) await getProfiles([p.author_id]);
  return p;
}

/* ---------- create / delete ---------- */
export async function createStory(row: {
  author_id: string; title: string; body: string; role: string; theme_id: number; region_id: number;
  consent: string; media_path: string | null; media_kind: string | null;
}): Promise<number> {
  const res = check(await supabase.from('stories').insert(row).select('id').single()) as { id: number };
  return res.id;
}
export type PostInput = {
  kind: PostKind; title: string | null; body: string; language: string; country: string | null;
  sources: Source[]; media_path: string | null; media_kind: string | null;
  subjects: number[]; subtopics: number[]; tags: string[];
  nature?: Nature; claims?: ClaimInput[];
};
async function writeLinks(id: number, inp: Pick<PostInput, 'subjects' | 'subtopics' | 'tags'>, replace: boolean) {
  if (replace) {
    await Promise.all([
      supabase.from('post_subjects').delete().eq('post_id', id),
      supabase.from('post_subtopics').delete().eq('post_id', id),
      supabase.from('post_tags').delete().eq('post_id', id),
    ]);
  }
  const ops = [];
  if (inp.subjects.length) ops.push(supabase.from('post_subjects').insert(inp.subjects.map((subject_id) => ({ post_id: id, subject_id }))));
  if (inp.subtopics.length) ops.push(supabase.from('post_subtopics').insert(inp.subtopics.map((subtopic_id) => ({ post_id: id, subtopic_id }))));
  if (inp.tags.length) ops.push(supabase.from('post_tags').insert(inp.tags.map((tag) => ({ post_id: id, tag }))));
  for (const r of await Promise.all(ops)) if (r.error) throw new Error(r.error.message);
}
export async function createPost(me: string, inp: PostInput): Promise<number> {
  const res = check(await supabase.from('posts').insert({
    author_id: me, kind: inp.kind, title: inp.title, body: inp.body, language: inp.language, country: inp.country,
    sources: inp.sources, media_path: inp.media_path, media_kind: inp.media_kind, ...(inp.nature ? { nature: inp.nature } : {}),
  }).select('id').single()) as { id: number };
  await writeLinks(res.id, inp, false);
  for (const c of inp.claims ?? []) if (c.statement.trim().length >= 5) await addClaim(me, res.id, c);
  return res.id;
}
export async function updatePost(id: number, inp: Omit<PostInput, 'kind' | 'media_path' | 'media_kind'>) {
  check(await supabase.from('posts').update({
    title: inp.title, body: inp.body, language: inp.language, country: inp.country, sources: inp.sources, ...(inp.nature ? { nature: inp.nature } : {}),
  }).eq('id', id));
  await writeLinks(id, inp, true);
}
export async function deleteStory(id: number) {
  check(await supabase.from('stories').delete().eq('id', id));
}
export async function deletePost(id: number) {
  check(await supabase.from('posts').delete().eq('id', id));
}

/* ---------- likes, comments, follows ---------- */
export async function setLike(me: string, type: 'story' | 'post', id: number, on: boolean) {
  if (on) check(await supabase.from('likes').insert({ user_id: me, target_type: type, target_id: id }));
  else check(await supabase.from('likes').delete().match({ user_id: me, target_type: type, target_id: id }));
}
export async function getComments(type: 'story' | 'post', id: number): Promise<Comment[]> {
  const c = check(await supabase.from('comments').select('id, author_id, body, created_at').match({ target_type: type, target_id: id }).order('created_at')) as Comment[];
  await getProfiles(c.map((x) => x.author_id));
  return c;
}
export async function addComment(me: string, type: 'story' | 'post', id: number, body: string) {
  check(await supabase.from('comments').insert({ author_id: me, target_type: type, target_id: id, body }));
}
export async function deleteComment(id: number) {
  check(await supabase.from('comments').delete().eq('id', id));
}
export async function isFollowing(me: string, other: string): Promise<boolean> {
  const r = check(await supabase.from('follows').select('followee_id').match({ follower_id: me, followee_id: other }).maybeSingle());
  return !!r;
}
export async function setFollow(me: string, other: string, on: boolean) {
  if (on) check(await supabase.from('follows').insert({ follower_id: me, followee_id: other }));
  else check(await supabase.from('follows').delete().match({ follower_id: me, followee_id: other }));
}
export async function followCounts(id: string): Promise<{ followers: number; following: number }> {
  const [a, b] = await Promise.all([
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('followee_id', id),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', id),
  ]);
  return { followers: a.count ?? 0, following: b.count ?? 0 };
}

/* ---------- messaging ---------- */
export async function myConversations(): Promise<Conversation[]> {
  const c = check(await supabase.rpc('my_conversations')) as Conversation[];
  await getProfiles(c.map((x) => x.other_id));
  return c;
}
export async function startConversation(other: string): Promise<string> {
  return check(await supabase.rpc('start_conversation', { other })) as string;
}
export async function getMessages(conv: string): Promise<Message[]> {
  return check(await supabase.from('messages').select('*').eq('conversation_id', conv).order('created_at').limit(500)) as Message[];
}
export async function conversationOther(conv: string, me: string): Promise<string | null> {
  const rows = check(await supabase.from('conversation_members').select('user_id').eq('conversation_id', conv)) as { user_id: string }[];
  const other = rows.find((r) => r.user_id !== me)?.user_id ?? null;
  if (other) await getProfiles([other]);
  return other;
}
export async function sendMessage(me: string, conv: string, body: string, attachment?: { path: string; kind: string; name: string } | null) {
  const row: Record<string, unknown> = { conversation_id: conv, sender_id: me, body };
  if (attachment) Object.assign(row, { attachment_path: attachment.path, attachment_kind: attachment.kind, attachment_name: attachment.name });
  check(await supabase.from('messages').insert(row));
}
export async function markRead(conv: string) {
  await supabase.rpc('mark_read', { conv });
}

/* ---------- safety ---------- */
export async function report(me: string | null, target_type: string, target_id: string | number, reason: string, details: string) {
  check(await supabase.from('reports').insert({ reporter_id: me, target_type, target_id: String(target_id), reason, details }));
}
export async function isBlocked(me: string, other: string): Promise<boolean> {
  const r = check(await supabase.from('blocks').select('blocked_id').match({ blocker_id: me, blocked_id: other }).maybeSingle());
  return !!r;
}
export async function setBlock(me: string, other: string, on: boolean) {
  if (on) {
    check(await supabase.from('blocks').insert({ blocker_id: me, blocked_id: other }));
    await supabase.from('follows').delete().match({ follower_id: me, followee_id: other });
  } else check(await supabase.from('blocks').delete().match({ blocker_id: me, blocked_id: other }));
}

/* ---------- GDPR ---------- */
export async function exportMyData(me: string) {
  const [profile, stories, posts, comments, likes, follows, blocks, reports, convs, interests] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', me).single(),
    supabase.from('stories').select('*').eq('author_id', me),
    supabase.from('posts').select('*').eq('author_id', me),
    supabase.from('comments').select('*').eq('author_id', me),
    supabase.from('likes').select('*').eq('user_id', me),
    supabase.from('follows').select('*').or(`follower_id.eq.${me},followee_id.eq.${me}`),
    supabase.from('blocks').select('*').eq('blocker_id', me),
    supabase.from('reports').select('*').eq('reporter_id', me),
    supabase.from('messages').select('*').eq('sender_id', me),
    supabase.from('user_interests').select('subject_id').eq('user_id', me),
  ]);
  const { data: auth } = await supabase.auth.getUser();
  return {
    exported_at: new Date().toISOString(),
    account: { id: me, email: auth.user?.email, created_at: auth.user?.created_at },
    profile: profile.data,
    stories: stories.data,
    posts: posts.data,
    comments: comments.data,
    likes: likes.data,
    follows: follows.data,
    blocks: blocks.data,
    reports: reports.data,
    messages_sent: convs.data,
    interests: interests.data,
  };
}
export async function deleteMyAccount(me: string) {
  const { data: files } = await supabase.storage.from('media').list(me, { limit: 1000 });
  if (files && files.length) await supabase.storage.from('media').remove(files.map((f) => `${me}/${f.name}`));
  const { data: av } = await supabase.storage.from('avatars').list(me, { limit: 100 });
  if (av && av.length) await supabase.storage.from('avatars').remove(av.map((f) => `${me}/${f.name}`));
  check(await supabase.rpc('delete_my_account'));
  await supabase.auth.signOut();
}


/* ---------- Verum Agora: subjects, interests, discovery ---------- */
let subjectsCache: Subject[] | null = null;
export async function getSubjects(): Promise<Subject[]> {
  if (!subjectsCache) {
    const [subs, tops] = await Promise.all([
      supabase.from('subjects').select('*').order('sort'),
      supabase.from('subtopics').select('*').order('name'),
    ]);
    const s = check(subs) as Omit<Subject, 'subtopics'>[];
    const t = check(tops) as Subtopic[];
    subjectsCache = s.map((x) => ({ ...x, subtopics: t.filter((y) => y.subject_id === x.id) }));
  }
  return subjectsCache;
}
export async function getInterests(me: string): Promise<number[]> {
  const rows = check(await supabase.from('user_interests').select('subject_id').eq('user_id', me)) as { subject_id: number }[];
  return rows.map((r) => r.subject_id);
}
export async function setInterests(me: string, ids: number[]) {
  check(await supabase.from('user_interests').delete().eq('user_id', me));
  if (ids.length) check(await supabase.from('user_interests').insert(ids.map((subject_id) => ({ user_id: me, subject_id }))));
}
async function withAuthors(posts: Post[]): Promise<Post[]> {
  await getProfiles(posts.map((p) => p.author_id));
  return posts;
}
const PEACE_SUBJECT = 2;
export async function interestsFeed(interests: number[]): Promise<FeedItem[]> {
  if (!interests.length) return [];
  const posts = check(await supabase.from('posts_v').select(POST_COLS).overlaps('subject_ids', interests).order('created_at', { ascending: false }).limit(40)) as Post[];
  const stories = interests.includes(PEACE_SUBJECT) ? await newestStories(10) : [];
  await withAuthors(posts);
  return merge(stories, posts);
}
export async function latestFeed(): Promise<FeedItem[]> {
  const posts = check(await supabase.from('posts_v').select(POST_COLS).order('created_at', { ascending: false }).limit(40)) as Post[];
  return merge([], await withAuthors(posts));
}
export async function exploreFeed(interests: number[]): Promise<FeedItem[]> {
  let q = supabase.from('posts_v').select(POST_COLS);
  if (interests.length) q = q.not('subject_ids', 'ov', `{${interests.join(',')}}`);
  const posts = check(await q.order('created_at', { ascending: false }).limit(40)) as Post[];
  const stories = interests.includes(PEACE_SUBJECT) ? [] : await newestStories(6);
  await withAuthors(posts);
  return merge(stories, posts);
}
export async function subjectPosts(subjectId: number, subtopicId?: number | null): Promise<Post[]> {
  let q = supabase.from('posts_v').select(POST_COLS).contains('subject_ids', [subjectId]);
  if (subtopicId) q = q.contains('subtopic_ids', [subtopicId]);
  return withAuthors(check(await q.order('created_at', { ascending: false }).limit(60)) as Post[]);
}
export async function subjectCounts(): Promise<Record<number, number>> {
  const rows = check(await supabase.from('post_subjects').select('subject_id').limit(10000)) as { subject_id: number }[];
  const out: Record<number, number> = {};
  rows.forEach((r) => { out[r.subject_id] = (out[r.subject_id] || 0) + 1; });
  return out;
}
export type SearchFilters = { q: string; subject?: number | null; country?: string | null; language?: string | null; kind?: string | null; tag?: string | null };
export async function searchPosts(f: SearchFilters): Promise<Post[]> {
  let q = supabase.from('posts_v').select(POST_COLS);
  if (f.q.trim()) q = q.textSearch('search', f.q.trim(), { type: 'websearch', config: 'simple' });
  if (f.subject) q = q.contains('subject_ids', [f.subject]);
  if (f.country) q = q.eq('country', f.country);
  if (f.language) q = q.eq('language', f.language);
  if (f.kind) q = q.eq('kind', f.kind);
  if (f.tag) q = q.contains('tags', [f.tag]);
  return withAuthors(check(await q.order('created_at', { ascending: false }).limit(50)) as Post[]);
}
export async function relatedPosts(id: number): Promise<Related[]> {
  const rows = check(await supabase.rpc('related_posts', { pid: id, max_results: 10 })) as {
    post_id: number; score: number; shared_subjects: number; shared_subtopics: number; shared_tags: string[]; same_country: boolean;
  }[];
  if (!rows.length) return [];
  const posts = check(await supabase.from('posts_v').select(POST_COLS).in('id', rows.map((r) => r.post_id))) as Post[];
  await withAuthors(posts);
  return rows.flatMap((r) => {
    const post = posts.find((p) => p.id === r.post_id);
    return post ? [{ post, score: Number(r.score), shared_subjects: r.shared_subjects, shared_subtopics: r.shared_subtopics, shared_tags: r.shared_tags || [], same_country: r.same_country }] : [];
  });
}

export async function followList(id: string, which: 'followers' | 'following'): Promise<Profile[]> {
  const col = which === 'followers' ? 'followee_id' : 'follower_id';
  const other = which === 'followers' ? 'follower_id' : 'followee_id';
  const rows = check(await supabase.from('follows').select(other).eq(col, id).order('created_at', { ascending: false }).limit(500)) as Record<string, string>[];
  const ids = rows.map((r) => r[other]);
  const map = await getProfiles(ids);
  return ids.map((x) => map.get(x)).filter((x): x is Profile => !!x);
}
export async function myFollowingSet(me: string): Promise<Set<string>> {
  return new Set(await followingIds(me));
}


/* ---------- Phase 2: information transparency ---------- */
const clean = (t: string) => t.toLowerCase().replace(/^#/, '').replace(/\s+/g, ' ').trim();
export async function addClaim(me: string, postId: number, c: ClaimInput): Promise<number> {
  const value = c.value.trim() ? Number(c.value.replace(/[\s,]/g, '')) : null;
  if (value !== null && (!Number.isFinite(value) || value < 0)) throw new Error('The number must be a positive number.');
  const row = check(await supabase.from('claims').insert({
    post_id: postId, created_by: me, statement: c.statement.trim(),
    event_tag: clean(c.event_tag) || null, metric: clean(c.metric) || null, value, unit: c.unit.trim() || null,
    occurred_on: c.occurred_on || null, location: c.location.trim() || null,
  }).select('id').single()) as { id: number };
  if (c.source.trim()) await addEvidence(me, row.id, { url: c.source.trim(), title: '', stance: 'supports', note: '' });
  return row.id;
}
export async function deleteClaim(id: number) {
  check(await supabase.from('claims').delete().eq('id', id));
}
export async function getClaims(postId: number): Promise<Claim[]> {
  const claims = check(await supabase.from('claims').select('*').eq('post_id', postId).order('id')) as Omit<Claim, 'evidence'>[];
  if (!claims.length) return [];
  const ev = check(await supabase.from('claim_evidence').select('*').in('claim_id', claims.map((c) => c.id)).order('created_at')) as Evidence[];
  await getProfiles(ev.map((e) => e.added_by));
  return claims.map((c) => ({ ...c, evidence: ev.filter((e) => e.claim_id === c.id) }));
}
export async function addEvidence(me: string, claimId: number, e: { url: string; title: string; stance: string; note: string }) {
  if (!/^https?:\/\//i.test(e.url)) throw new Error('Evidence links must start with http:// or https://');
  check(await supabase.from('claim_evidence').insert({ claim_id: claimId, added_by: me, url: e.url, title: e.title.trim() || null, stance: e.stance, note: e.note.trim() || null }));
}
export async function deleteEvidence(id: number) {
  check(await supabase.from('claim_evidence').delete().eq('id', id));
}
export async function getConflicts(postId: number): Promise<Conflict[]> {
  const rows = check(await supabase.rpc('claim_conflicts', { pid: postId })) as Conflict[];
  if (!rows.length) return [];
  const others = check(await supabase.from('claims').select('*').in('id', rows.map((r) => r.other_claim_id))) as Claim[];
  const posts = check(await supabase.from('posts_v').select(POST_COLS).in('id', [...new Set(rows.map((r) => r.other_post_id))])) as Post[];
  await getProfiles(posts.map((p) => p.author_id));
  return rows.map((r) => ({ ...r, other: others.find((o) => o.id === r.other_claim_id), post: posts.find((p) => p.id === r.other_post_id) }));
}
export async function eventClaims(tag: string): Promise<{ claims: EventClaim[]; posts: Post[] }> {
  const claims = check(await supabase.rpc('event_claims', { tag })) as EventClaim[];
  if (!claims.length) return { claims, posts: [] };
  const posts = check(await supabase.from('posts_v').select(POST_COLS).in('id', [...new Set(claims.map((c) => c.post_id))])) as Post[];
  await getProfiles(posts.map((p) => p.author_id));
  return { claims, posts };
}
export async function requestReview(me: string, postId: number, claimId: number | null, text: string) {
  check(await supabase.from('fact_reviews').insert({ post_id: postId, claim_id: claimId, requested_by: me, request_text: text.trim() }));
}
export async function reviewsFor(postId: number): Promise<Review[]> {
  return check(await supabase.from('fact_reviews_v').select('*').eq('post_id', postId).order('created_at', { ascending: false })) as Review[];
}
export async function submitAppeal(me: string, reviewId: number, text: string) {
  check(await supabase.from('appeals').insert({ review_id: reviewId, author_id: me, appeal_text: text.trim() }));
}
// Reviewer desk (moderators only; the database enforces this)
export async function openReviews(): Promise<(Review & { requested_by: string | null })[]> {
  return check(await supabase.from('fact_reviews').select('*').order('created_at', { ascending: false }).limit(200)) as (Review & { requested_by: string | null })[];
}
export async function decideReview(id: number, status: ReviewStatus, text: string) {
  check(await supabase.from('fact_reviews').update({ status, decision_text: text.trim() }).eq('id', id));
}
export async function openAppeals(): Promise<Appeal[]> {
  return check(await supabase.from('appeals').select('*').order('created_at', { ascending: false }).limit(200)) as Appeal[];
}
export async function decideAppeal(id: number, status: 'upheld' | 'overturned', text: string) {
  check(await supabase.from('appeals').update({ status, decision_text: text.trim() }).eq('id', id));
}
export async function contentReports(): Promise<ContentReport[]> {
  return check(await supabase.from('reports').select('*').order('created_at', { ascending: false }).limit(200)) as ContentReport[];
}
export async function decideReport(id: number, status: 'actioned' | 'dismissed', decision: string) {
  check(await supabase.from('reports').update({ status, decision: decision.trim(), decided_at: new Date().toISOString() }).eq('id', id));
}
export async function setHidden(type: 'post' | 'story' | 'comment', id: number, hidden: boolean) {
  const table = type === 'post' ? 'posts' : type === 'story' ? 'stories' : 'comments';
  check(await supabase.from(table).update({ hidden }).eq('id', id));
}
