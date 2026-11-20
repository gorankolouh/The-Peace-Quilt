import { supabase } from './supabase';
import type { Comment, Conversation, FeedItem, Message, Post, Profile, Region, Story, Theme } from './types';

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
    supabase.from('posts_v').select('*').in('author_id', ids).order('created_at', { ascending: false }).limit(40),
  ]);
  const s = check(stories) as Story[];
  const p = check(posts) as Post[];
  await getProfiles([...s.map((x) => x.author_id), ...p.map((x) => x.author_id)]);
  return merge(s, p);
}
export async function everythingFeed(): Promise<FeedItem[]> {
  const [stories, posts] = await Promise.all([
    supabase.from('stories_v').select('*').order('created_at', { ascending: false }).limit(30),
    supabase.from('posts_v').select('*').order('created_at', { ascending: false }).limit(30),
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
  const p = check(await supabase.from('posts_v').select('*').eq('kind', 'article').order('created_at', { ascending: false }).limit(30)) as Post[];
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
  return check(await supabase.from('posts_v').select('*').eq('author_id', author).order('created_at', { ascending: false })) as Post[];
}
export async function getStory(id: number): Promise<Story | null> {
  const s = check(await supabase.from('stories_v').select('*').eq('id', id).maybeSingle()) as Story | null;
  if (s) await getProfiles([s.author_id]);
  return s;
}
export async function getPost(id: number): Promise<Post | null> {
  const p = check(await supabase.from('posts_v').select('*').eq('id', id).maybeSingle()) as Post | null;
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
export async function createPost(row: {
  author_id: string; kind: 'post' | 'article'; title: string | null; body: string; media_path: string | null; media_kind: string | null;
}): Promise<number> {
  const res = check(await supabase.from('posts').insert(row).select('id').single()) as { id: number };
  return res.id;
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
export async function sendMessage(me: string, conv: string, body: string) {
  check(await supabase.from('messages').insert({ conversation_id: conv, sender_id: me, body }));
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
  const [profile, stories, posts, comments, likes, follows, blocks, reports, convs] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', me).single(),
    supabase.from('stories').select('*').eq('author_id', me),
    supabase.from('posts').select('*').eq('author_id', me),
    supabase.from('comments').select('*').eq('author_id', me),
    supabase.from('likes').select('*').eq('user_id', me),
    supabase.from('follows').select('*').or(`follower_id.eq.${me},followee_id.eq.${me}`),
    supabase.from('blocks').select('*').eq('blocker_id', me),
    supabase.from('reports').select('*').eq('reporter_id', me),
    supabase.from('messages').select('*').eq('sender_id', me),
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
  };
}
export async function deleteMyAccount(me: string) {
  const { data: files } = await supabase.storage.from('media').list(me, { limit: 1000 });
  if (files && files.length) await supabase.storage.from('media').remove(files.map((f) => `${me}/${f.name}`));
  check(await supabase.rpc('delete_my_account'));
  await supabase.auth.signOut();
}
