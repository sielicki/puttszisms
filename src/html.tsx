import { raw } from "hono/html";
import type { Child, FC } from "hono/jsx";
import { avatarURL, type User } from "./auth";

export interface PickerUser {
  display_name: string;
  avatar: string | null;
  discord_id: string;
}

export interface QuoteRow {
  id: number;
  text: string;
  attributed_to: string;
  context: string | null;
  date_said: string;
  submitted_by: string;
  created_at: string;
  submitter_name: string;
  submitter_avatar: string | null;
  avg_stars: number | null;
  rating_count: number;
  comment_count: number;
}

export interface CommentRow {
  id: number;
  text: string;
  created_at: string;
  username: string;
  display_name: string;
  avatar: string | null;
  discord_id: string;
}

const CSS = `
.star-form{display:inline-flex;direction:rtl;gap:2px}
.star-form input{display:none}
.star-form label{cursor:pointer;font-size:1.3rem;opacity:.2;transition:opacity .1s,color .1s}
.star-form label:hover,.star-form label:hover~label,.star-form input:checked~label{color:#f0a500;opacity:1}
.user-picker-list{display:none;position:absolute;top:calc(100% + 4px);left:0;right:0;max-height:240px;overflow-y:auto;z-index:20}
.user-picker-list.open{display:block}
`;

const FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Ccircle cx='32' cy='32' r='30' fill='%23181c25' stroke='%2338bdf8' stroke-width='3'/%3E%3Ctext x='32' y='44' text-anchor='middle' font-family='system-ui,sans-serif' font-weight='700' font-size='38' fill='%2338bdf8'%3EP%3C/text%3E%3C/svg%3E";

const doctype = raw("<!DOCTYPE html>\n");

const Layout: FC<{ title: string; user?: User; children?: Child }> = ({
  title,
  user,
  children,
}) => (
  <>
    {doctype}
    <html lang="en" class="dark">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>{title} - Puttszisms</title>
        <link rel="icon" type="image/svg+xml" href={FAVICON} />
        <script src="https://cdn.tailwindcss.com" />
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
      </head>
      <body class="bg-gray-950 text-gray-100 min-h-screen">
        <nav class="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <a href="/" class="font-bold text-xl text-gray-100 no-underline">
            Puttsz<span class="text-sky-400">isms</span>
          </a>
          {user && (
            <div class="flex items-center gap-3">
              <img src={avatarURL(user)} alt="" class="w-8 h-8 rounded-full" />
              <span class="text-sm text-gray-400">{user.display_name}</span>
              <a
                href="/logout"
                class="text-xs border border-gray-600 hover:border-sky-400 text-gray-400 px-2.5 py-1 rounded-lg transition-colors"
              >
                Log out
              </a>
            </div>
          )}
        </nav>
        <main class="max-w-4xl mx-auto px-4 py-8">{children}</main>
      </body>
    </html>
  </>
);

function formatDate(iso: string): string {
  try {
    const normalized = iso.includes("T") ? iso : `${iso.replace(" ", "T")}Z`;
    const d = new Date(normalized);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return iso;
  }
}

function defaultAvatar(discordId: string): string {
  return `https://cdn.discordapp.com/embed/avatars/${(BigInt(discordId) >> 22n) % 6n}.png`;
}

const StarsDisplay: FC<{ avg: number | null; count: number }> = ({
  avg,
  count,
}) => {
  if (!count) return <span class="text-xs text-gray-500">No ratings yet</span>;
  const rounded = Math.round(avg!);
  return (
    <>
      <span class="text-amber-400 text-base tracking-wider">
        {Array.from({ length: 5 }, (_, i) =>
          i < rounded ? (
            "\u2605"
          ) : (
            <span key={i} class="opacity-20">
              {"\u2605"}
            </span>
          ),
        )}
      </span>
      <span class="text-xs text-gray-500 ml-1">
        {avg!.toFixed(1)} ({count})
      </span>
    </>
  );
};

const QuoteCard: FC<{ q: QuoteRow }> = ({ q }) => {
  const avatar = q.submitter_avatar || defaultAvatar(q.submitted_by);
  return (
    <div class="bg-gray-900 border border-gray-800 rounded-lg p-5 mb-4 hover:border-sky-400 transition-colors cursor-pointer">
      <a href={`/quotes/${q.id}`} class="no-underline text-inherit">
        <div
          class={`text-lg italic border-l-2 border-sky-400 pl-4 mb-3 before:content-['\u201C'] after:content-['\u201D']`}
        >
          {q.text}
        </div>
        <p class="flex flex-wrap gap-2 items-center text-xs text-gray-500 mb-2">
          <strong class="text-gray-300">
            {"\u2014"} {q.attributed_to}
          </strong>
        </p>
        {q.context && <div class="text-sm text-gray-500 mb-3">{q.context}</div>}
        <p class="flex flex-wrap gap-2 items-center text-xs text-gray-500 m-0">
          <span>{formatDate(q.date_said)}</span>
          <span class="flex items-center gap-1">
            added by <img src={avatar} alt="" class="w-5 h-5 rounded-full" />{" "}
            {q.submitter_name}
          </span>
        </p>
        <div class="flex justify-between items-center mt-3 pt-3 border-t border-gray-800">
          <div>
            <StarsDisplay avg={q.avg_stars} count={q.rating_count} />
          </div>
          <span class="text-xs text-gray-500">
            {q.comment_count} comment{q.comment_count === 1 ? "" : "s"}
          </span>
        </div>
      </a>
    </div>
  );
};

const DiscordIcon: FC = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 71 55"
    fill="white"
    role="img"
    aria-label="Discord"
  >
    <path d="M60.1 4.9A58.5 58.5 0 0045.4.2a.2.2 0 00-.2.1 40.8 40.8 0 00-1.8 3.7 54 54 0 00-16.2 0A37.4 37.4 0 0025.4.3a.2.2 0 00-.2-.1A58.4 58.4 0 0010.5 5a.2.2 0 00-.1 0C1.5 18.7-.9 32 .3 45.1v.1a58.8 58.8 0 0017.9 9.1.2.2 0 00.3-.1 42.1 42.1 0 003.6-5.9.2.2 0 00-.1-.3 38.8 38.8 0 01-5.5-2.6.2.2 0 01 0-.4l1.1-.9a.2.2 0 01.2 0 42 42 0 0035.8 0 .2.2 0 01.2 0l1.1.9a.2.2 0 010 .3 36.4 36.4 0 01-5.5 2.7.2.2 0 00-.1.3 47.3 47.3 0 003.6 5.9.2.2 0 00.2.1A58.6 58.6 0 0071 45.2v-.1C72.4 30.1 68.4 16.9 60.2 5a.2.2 0 000 0zM23.7 37c-3.5 0-6.4-3.2-6.4-7.1s2.8-7.2 6.4-7.2 6.5 3.2 6.4 7.2c0 3.9-2.8 7.1-6.4 7.1zm23.7 0c-3.5 0-6.4-3.2-6.4-7.1s2.8-7.2 6.4-7.2 6.5 3.2 6.4 7.2c0 3.9-2.8 7.1-6.4 7.1z" />
  </svg>
);

export function loginPage() {
  return (
    <Layout title="Login">
      <div class="text-center pt-[20vh] px-4">
        <h1 class="text-4xl font-bold mb-2">
          Puttsz<span class="text-sky-400">isms</span>
        </h1>
        <p class="text-gray-500 mb-8">
          A curated collection of the finest quotes from Puttsz. Members only.
        </p>
        <a
          href="/login"
          class="inline-flex items-center gap-2 px-8 py-3 bg-[#5865F2] hover:bg-[#4752c4] text-white rounded-lg text-lg no-underline transition-colors"
        >
          <DiscordIcon />
          Log in with Discord
        </a>
      </div>
    </Layout>
  );
}

export function notMemberPage() {
  return (
    <Layout title="Access Denied">
      <div class="text-center pt-[20vh] px-4">
        <h1 class="text-4xl font-bold mb-2">Not a Member</h1>
        <p class="text-gray-500 mb-8">
          You need to be a member of the Discord server to access Puttszisms.
          Ask someone for an invite!
        </p>
        <a
          href="/logout"
          class="border border-gray-600 hover:border-sky-400 text-gray-300 px-4 py-2 rounded-lg no-underline transition-colors"
        >
          Log out
        </a>
      </div>
    </Layout>
  );
}

export function errorPage(message: string, user?: User) {
  return (
    <Layout title="Error" user={user}>
      <div class="bg-gray-900 border border-red-500 rounded-lg p-5 mb-4">
        <p class="text-red-400 m-0">{message}</p>
      </div>
      <a
        href="/"
        class="border border-gray-600 hover:border-sky-400 text-gray-300 px-4 py-2 rounded-lg no-underline transition-colors"
      >
        {"\u2190"} Back to home
      </a>
    </Layout>
  );
}

export function homePage(quotes: QuoteRow[], user: User, sort: string) {
  const sortOptions = [
    ["newest", "Newest"],
    ["rating", "Top Rated"],
    ["comments", "Most Discussed"],
  ] as const;

  return (
    <Layout title="Home" user={user}>
      <div class="flex justify-between items-center flex-wrap gap-3 mb-6">
        <h2 class="text-2xl font-bold m-0">The Quotes</h2>
        <div class="flex gap-3 items-center flex-wrap">
          <div class="flex gap-1">
            {sortOptions.map(([key, label]) => (
              <a
                key={key}
                href={`/?sort=${key}`}
                class={`px-2 py-1 rounded text-sm no-underline transition-colors ${sort === key ? "text-gray-100 bg-gray-800" : "text-gray-500 hover:text-gray-100 hover:bg-gray-800"}`}
              >
                {label}
              </a>
            ))}
          </div>
          <a
            href="/quotes/new"
            class="bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-lg no-underline transition-colors"
          >
            + Add Quote
          </a>
        </div>
      </div>
      {quotes.length === 0 ? (
        <p class="text-center text-gray-500 py-12">
          No quotes yet. Be the first to immortalize Puttsz's wisdom.
        </p>
      ) : (
        quotes.map((q) => <QuoteCard key={q.id} q={q} />)
      )}
    </Layout>
  );
}

const QUOTE_PLACEHOLDERS = [
  "What did he say this time?",
  "Oh god, what now?",
  "Type the unhinged thing he said...",
  "Another one for the history books...",
  "This better be good.",
  "Please tell me someone else heard this.",
  "He really said this out loud?",
  "For the permanent record...",
  "Future generations need to see this.",
  "And I quote...",
  "He said WHAT?",
  "His parents would be so proud.",
];

const CONTEXT_PLACEHOLDERS = [
  "What was happening when this gem was uttered?",
  "What circumstances led to this disaster?",
  "Set the scene for the jury.",
  "Explain how we got here.",
  "What game was he losing?",
  "Please provide context so we can judge appropriately.",
  "In his defense... actually, go ahead.",
  "What were the warning signs?",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function userPickerAvatar(u: PickerUser): string {
  return u.avatar || defaultAvatar(u.discord_id);
}

const PICKER_SCRIPT = `(function(){
var btn=document.getElementById('picker-btn'),
    list=document.getElementById('picker-list'),
    hidden=document.getElementById('attributed_to'),
    items=list.querySelectorAll('.user-picker-item');
btn.addEventListener('click',function(){list.classList.toggle('open')});
items.forEach(function(item){
  item.addEventListener('click',function(){
    hidden.value=item.dataset.value;
    btn.querySelector('img').src=item.querySelector('img').src;
    btn.querySelector('span').textContent=item.dataset.value;
    items.forEach(function(i){i.classList.remove('bg-sky-500/20')});
    item.classList.add('bg-sky-500/20');
    list.classList.remove('open');
  });
});
document.addEventListener('click',function(e){
  if(!btn.contains(e.target)&&!list.contains(e.target))list.classList.remove('open');
});
})();`;

export function newQuotePage(user: User, knownUsers: PickerUser[]) {
  const hasDefault = knownUsers.some((u) => u.display_name === "Puttsz");
  const users: PickerUser[] = hasDefault
    ? knownUsers
    : [
        { display_name: "Puttsz", avatar: null, discord_id: "0" },
        ...knownUsers,
      ];
  const du = users.find((u) => u.display_name === "Puttsz") || users[0];

  return (
    <Layout title="Add Quote" user={user}>
      <a
        href="/"
        class="inline-block text-sm border border-gray-600 hover:border-sky-400 text-gray-400 px-3 py-1.5 rounded-lg mb-4 no-underline transition-colors"
      >
        {"\u2190"} Back
      </a>
      <h2 class="text-2xl font-bold mb-6">Add a Puttszism</h2>
      <form method="post" action="/quotes" class="space-y-4">
        <div>
          <label
            for="text"
            class="block text-sm font-medium text-gray-300 mb-1"
          >
            The Quote
          </label>
          <textarea
            id="text"
            name="text"
            required
            placeholder={pick(QUOTE_PLACEHOLDERS)}
            class="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 focus:border-sky-400 focus:outline-none w-full min-h-[100px]"
          />
        </div>
        <div>
          <label
            for="attributed_to"
            class="block text-sm font-medium text-gray-300 mb-1"
          >
            Who Said It
          </label>
          <input
            type="hidden"
            name="attributed_to"
            id="attributed_to"
            value={du.display_name}
            required
          />
          <div class="relative" id="picker">
            <button
              type="button"
              class="flex items-center gap-2 w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 text-sm cursor-pointer text-left hover:border-sky-400 focus:border-sky-400 focus:outline-none"
              id="picker-btn"
            >
              <img
                src={userPickerAvatar(du)}
                alt=""
                class="w-6 h-6 rounded-full"
              />
              <span>{du.display_name}</span>
              <span class="ml-auto text-xs text-gray-500">{"\u25BC"}</span>
            </button>
            <div
              class="user-picker-list bg-gray-900 border border-gray-700 rounded-lg shadow-2xl"
              id="picker-list"
            >
              {users.map((u) => (
                <div
                  key={u.discord_id}
                  class={`user-picker-item flex items-center gap-2 px-3 py-2 cursor-pointer text-sm hover:bg-gray-800 transition-colors ${u.display_name === du.display_name ? "bg-sky-500/20" : ""}`}
                  data-value={u.display_name}
                >
                  <img
                    src={userPickerAvatar(u)}
                    alt=""
                    class="w-6 h-6 rounded-full"
                  />
                  <span>{u.display_name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div>
          <label
            for="context"
            class="block text-sm font-medium text-gray-300 mb-1"
          >
            Context
          </label>
          <textarea
            id="context"
            name="context"
            placeholder={pick(CONTEXT_PLACEHOLDERS)}
            rows={3}
            class="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 focus:border-sky-400 focus:outline-none w-full"
          />
        </div>
        <div>
          <label
            for="date_said"
            class="block text-sm font-medium text-gray-300 mb-1"
          >
            Date Said
          </label>
          <input
            type="date"
            id="date_said"
            name="date_said"
            required
            class="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 focus:border-sky-400 focus:outline-none w-full"
          />
        </div>
        <script
          dangerouslySetInnerHTML={{
            __html: "document.getElementById('date_said').valueAsDate=new Date",
          }}
        />
        <button
          type="submit"
          class="bg-sky-500 hover:bg-sky-600 text-white px-6 py-2.5 rounded-lg transition-colors font-medium"
        >
          Add Quote
        </button>
      </form>
      <script dangerouslySetInnerHTML={{ __html: PICKER_SCRIPT }} />
    </Layout>
  );
}

export function quoteDetailPage(
  q: QuoteRow,
  comments: CommentRow[],
  userRating: number | null,
  user: User,
) {
  const avatar = q.submitter_avatar || defaultAvatar(q.submitted_by);

  return (
    <Layout title="Quote" user={user}>
      <a
        href="/"
        class="inline-block text-sm border border-gray-600 hover:border-sky-400 text-gray-400 px-3 py-1.5 rounded-lg mb-4 no-underline transition-colors"
      >
        {"\u2190"} Back
      </a>
      <div class="bg-gray-900 border border-sky-400 rounded-lg p-5 mb-6">
        <div
          class={`text-xl italic border-l-2 border-sky-400 pl-4 mb-3 before:content-['\u201C'] after:content-['\u201D']`}
        >
          {q.text}
        </div>
        <p class="flex flex-wrap gap-2 items-center text-xs text-gray-500 mb-2">
          <strong class="text-gray-300">
            {"\u2014"} {q.attributed_to}
          </strong>
        </p>
        {q.context && <div class="text-sm text-gray-500 mb-3">{q.context}</div>}
        <p class="flex flex-wrap gap-2 items-center text-xs text-gray-500 m-0">
          <span>{formatDate(q.date_said)}</span>
          <span class="flex items-center gap-1">
            added by <img src={avatar} alt="" class="w-5 h-5 rounded-full" />{" "}
            {q.submitter_name}
          </span>
        </p>
        <div class="flex justify-between items-center mt-3 pt-3 border-t border-gray-800">
          <div>
            <StarsDisplay avg={q.avg_stars} count={q.rating_count} />
          </div>
          <div class="flex items-center gap-2 text-sm">
            Your rating:
            <form
              method="post"
              action={`/quotes/${q.id}/rate`}
              class="star-form"
            >
              {[5, 4, 3, 2, 1].map((i) => (
                <>
                  <input
                    type="radio"
                    name="stars"
                    value={String(i)}
                    id={`s${i}`}
                    checked={userRating === i}
                    onchange="this.form.submit()"
                  />
                  <label for={`s${i}`}>{"\u2605"}</label>
                </>
              ))}
            </form>
          </div>
        </div>
      </div>

      <h3 class="text-lg font-bold mb-3">Comments ({comments.length})</h3>
      {comments.length === 0 ? (
        <p class="text-xs text-gray-500 my-4">No comments yet.</p>
      ) : (
        comments.map((c) => {
          const cAvatar = c.avatar || defaultAvatar(c.discord_id);
          return (
            <div key={c.id} class="border border-gray-800 rounded-lg p-3 mb-2">
              <div class="flex items-center gap-2 text-xs text-gray-500 mb-1">
                <img
                  src={cAvatar}
                  alt=""
                  class="w-[18px] h-[18px] rounded-full"
                />
                <strong class="text-gray-300">
                  {c.display_name || c.username}
                </strong>
                <span>{formatDate(c.created_at)}</span>
              </div>
              <p class="text-sm m-0">{c.text}</p>
            </div>
          );
        })
      )}

      <form
        method="post"
        action={`/quotes/${q.id}/comments`}
        class="mt-4 space-y-3"
      >
        <textarea
          name="text"
          required
          placeholder="Add a comment..."
          class="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 focus:border-sky-400 focus:outline-none w-full"
        />
        <button
          type="submit"
          class="border border-gray-600 hover:border-sky-400 text-gray-300 px-4 py-2 rounded-lg transition-colors"
        >
          Post Comment
        </button>
      </form>
    </Layout>
  );
}
