// Claude Code CLI — fabricated reel demo
// Type a prompt, get a scripted-but-realistic Claude response.

const screen = document.getElementById('screen');
const conversation = document.getElementById('conversation');
const input = document.getElementById('promptInput');
const promptBox = document.getElementById('promptBox');
const ctxPercent = document.getElementById('ctxPercent');
const resetBtn = document.getElementById('resetBtn');
const hideBtn = document.getElementById('hideBtn');
const petBtn = document.getElementById('petBtn');
const hud = document.querySelector('.hud');
const pet = document.getElementById('pet');

// ---------- helpers ----------

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function el(tag, cls, html) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (html != null) node.innerHTML = html;
  return node;
}

function scrollDown() {
  screen.scrollTop = screen.scrollHeight;
}

function autosize() {
  // Reset to single-line height, then grow only if content actually overflows.
  input.style.height = '22px';
  // Force a reflow so scrollHeight reflects the just-set height.
  void input.offsetHeight;
  const sh = input.scrollHeight;
  if (sh > 24) {
    input.style.height = Math.min(sh, 160) + 'px';
  }
}

function escapeHTML(s) {
  return s.replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// minimal markdown-ish renderer for bold, code, italic
function renderInline(s) {
  let h = escapeHTML(s);
  h = h.replace(/`([^`]+)`/g, '<code>$1</code>');
  h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  h = h.replace(/(?<!\w)\*([^*\n]+)\*(?!\w)/g, '<em>$1</em>');
  return h;
}

// ---------- output primitives ----------

async function typeInto(node, text, charDelay = 8) {
  node.classList.add('typing-cursor');
  for (let i = 0; i < text.length; i++) {
    node.innerHTML = renderInline(text.slice(0, i + 1));
    if (i % 3 === 0) scrollDown();
    // small randomness for natural feel
    const d = charDelay + (Math.random() * 6 - 3);
    await sleep(Math.max(2, d));
  }
  node.classList.remove('typing-cursor');
  scrollDown();
}

async function addUserMessage(text) {
  const wrap = el('div', 'msg-user fade-in');
  wrap.innerHTML = `<span class="marker">&gt;</span>${escapeHTML(text)}`;
  conversation.appendChild(wrap);
  scrollDown();
}

async function addAssistantParagraph(text, charDelay = 9) {
  const wrap = el('div', 'msg-assistant fade-in');
  const marker = el('span', 'marker', '⏺');
  const body = el('div', 'body');
  wrap.appendChild(marker);
  wrap.appendChild(body);
  conversation.appendChild(wrap);
  await typeInto(body, text, charDelay);
}

async function addThinking(label = 'Pondering', durationMs = 1400) {
  const wrap = el('div', 'thinking fade-in');
  const sp = el('span', 'spinner animated');
  const txt = el('span', '', `${label}…`);
  const tokens = el('span', 'tokens', '(↓ esc to interrupt)');
  wrap.appendChild(sp);
  wrap.appendChild(txt);
  wrap.appendChild(tokens);
  conversation.appendChild(wrap);
  scrollDown();
  await sleep(durationMs);
  wrap.remove();
}

async function addToolCall({ name, arg, status = 'ok', delay = 700 }) {
  const wrap = el('div', 'tool-line fade-in');
  const marker = el('span', 'marker', '⏺');
  const body = el('div');
  body.innerHTML = `<span class="tool-name">${escapeHTML(name)}</span>(<span class="tool-arg">${escapeHTML(arg)}</span>)`;
  const st = el('span', 'tool-status', '');
  wrap.appendChild(marker);
  wrap.appendChild(body);
  wrap.appendChild(st);
  conversation.appendChild(wrap);
  scrollDown();
  await sleep(delay);
  if (status === 'ok') st.textContent = '⎿  done';
  else if (status === 'wrote') st.textContent = '⎿  ✓ wrote 42 lines';
  else st.textContent = `⎿  ${status}`;
  scrollDown();
}

async function addCodeBlock(code, lang = '') {
  const wrap = el('div', 'msg-assistant fade-in');
  const marker = el('span', 'marker', ' ');
  const body = el('div', 'body');
  wrap.appendChild(marker);
  wrap.appendChild(body);
  conversation.appendChild(wrap);

  const block = el('pre', 'code-block');
  block.innerHTML = highlight(code, lang);
  body.appendChild(block);
  scrollDown();
  await sleep(150);
}

async function addDiff(file, lines) {
  const wrap = el('div', 'msg-assistant fade-in');
  const marker = el('span', 'marker', ' ');
  const body = el('div', 'body');
  wrap.appendChild(marker);
  wrap.appendChild(body);

  const block = el('div', 'diff-block');
  block.appendChild(el('div', 'diff-header', `Update(${escapeHTML(file)})`));
  for (const ln of lines) {
    const cls = ln.startsWith('+') ? 'add' : ln.startsWith('-') ? 'del' : '';
    block.appendChild(el('div', `diff-line ${cls}`, escapeHTML(ln)));
  }
  body.appendChild(block);
  conversation.appendChild(wrap);
  scrollDown();
  await sleep(250);
}

function highlight(code, lang) {
  let h = escapeHTML(code);
  if (lang === 'python' || lang === 'py') {
    h = h.replace(/\b(def|class|return|import|from|if|elif|else|for|while|in|not|and|or|with|as|try|except|raise|pass|lambda|None|True|False|self)\b/g, '<span class="kw">$1</span>');
    h = h.replace(/(#[^\n]*)/g, '<span class="com">$1</span>');
    h = h.replace(/('[^'\n]*'|"[^"\n]*")/g, '<span class="str">$1</span>');
    h = h.replace(/\b(\d+)\b/g, '<span class="num">$1</span>');
  } else if (lang === 'js' || lang === 'javascript' || lang === 'ts') {
    h = h.replace(/\b(const|let|var|function|return|if|else|for|while|of|in|new|class|extends|import|from|export|default|async|await|try|catch|throw|true|false|null|undefined)\b/g, '<span class="kw">$1</span>');
    h = h.replace(/(\/\/[^\n]*)/g, '<span class="com">$1</span>');
    h = h.replace(/('[^'\n]*'|"[^"\n]*"|`[^`]*`)/g, '<span class="str">$1</span>');
    h = h.replace(/\b(\d+)\b/g, '<span class="num">$1</span>');
  } else if (lang === 'bash' || lang === 'sh') {
    h = h.replace(/(#[^\n]*)/g, '<span class="com">$1</span>');
    h = h.replace(/('[^'\n]*'|"[^"\n]*")/g, '<span class="str">$1</span>');
  }
  return h;
}

// ---------- response library (fabricated) ----------

const responses = [
  {
    match: /let'?s cook|lets cook/i,
    run: async () => {
      await addThinking('Locking in', 900);
      await addAssistantParagraph(
        "say less. **locked TF in.** 🔒\n\ndrop the spec — we shipping today.",
        9
      );
    },
  },
  {
    match: /snake|game/i,
    run: async () => {
      await addThinking('Designing game loop', 1500);
      await addAssistantParagraph(
        "I'll build a classic Snake game in Python using `pygame`. Here's the plan:",
        7
      );
      await addToolCall({ name: 'Write', arg: 'snake.py', status: 'wrote', delay: 900 });
      await addCodeBlock(
`import pygame, random

WIDTH, HEIGHT = 600, 400
CELL = 20

def main():
    pygame.init()
    screen = pygame.display.set_mode((WIDTH, HEIGHT))
    snake = [(100, 100), (80, 100), (60, 100)]
    food = (200, 200)
    direction = (CELL, 0)
    clock = pygame.time.Clock()
    while True:
        for e in pygame.event.get():
            if e.type == pygame.QUIT: return
        # ... game loop here
        clock.tick(10)`, 'python');
      await addAssistantParagraph(
        "Done. Run it with `python snake.py`. Want me to add a **score counter** or **wrap-around walls**?",
        8
      );
    },
  },
  {
    match: /hello|hi|hey|sup/i,
    run: async () => {
      await addThinking('Thinking', 700);
      await addAssistantParagraph(
        "Hey! I'm Claude. What are we building today?",
        14
      );
    },
  },
  {
    match: /refactor|clean|simplify/i,
    run: async () => {
      await addThinking('Reading the codebase', 1600);
      await addToolCall({ name: 'Glob', arg: '**/*.ts', delay: 600 });
      await addToolCall({ name: 'Read', arg: 'src/api/handler.ts', delay: 700 });
      await addAssistantParagraph(
        "Found three things worth simplifying:",
        7
      );
      await addAssistantParagraph(
        "**1.** `parseRequest` duplicates validation that `zod` already does — remove it.\n**2.** The retry loop in `fetchUser` reinvents `p-retry`. Use the lib.\n**3.** Three handlers share an identical try/catch — extract `withErrorBoundary`.",
        6
      );
      await addDiff('src/api/handler.ts', [
        '@@ -42,15 +42,7 @@',
        '-  if (!body || typeof body !== "object") {',
        '-    throw new Error("invalid body");',
        '-  }',
        '-  if (!body.userId) throw new Error("missing userId");',
        '+  const parsed = RequestSchema.parse(body);',
        '',
        '-  return await handle(body);',
        '+  return await handle(parsed);',
      ]);
      await addAssistantParagraph(
        "Net result: **-58 lines, +12 lines**. Want me to apply the same pattern to the auth routes?",
        7
      );
    },
  },
  {
    match: /bug|fix|broken|error/i,
    run: async () => {
      await addThinking('Reproducing', 1300);
      await addToolCall({ name: 'Bash', arg: 'npm test -- --grep "user-flow"', delay: 1100 });
      await addAssistantParagraph(
        "Got it. The test fails because `getUser` returns `null` for soft-deleted accounts but the caller assumes a `User`. Two-line fix:",
        7
      );
      await addDiff('src/services/user.ts', [
        '@@ -88,6 +88,8 @@',
        '   const user = await getUser(id);',
        '+  if (!user) throw new NotFoundError(`user ${id} not found`);',
        '+',
        '   return user.profile;',
      ]);
      await addAssistantParagraph(
        "Test passes locally. The real question is *why* the soft-delete returns null instead of throwing — that's a wider design call. Want me to flag it as a follow-up?",
        7
      );
    },
  },
  {
    match: /explain|how does|what is/i,
    run: async () => {
      await addThinking('Reading the code', 1200);
      await addToolCall({ name: 'Read', arg: 'src/index.ts', delay: 600 });
      await addAssistantParagraph(
        "Short version: it's an event-driven pipeline. Three stages:",
        8
      );
      await addAssistantParagraph(
        "**Ingest** — webhooks land in `/api/in` and get pushed to a queue.\n**Process** — workers pull from the queue, run validation, persist.\n**Notify** — successful writes fan out via SSE to subscribed clients.",
        7
      );
      await addAssistantParagraph(
        "The clever bit is the *backpressure*: workers ack only after the notify step lands, so a slow consumer slows ingest instead of dropping events.",
        8
      );
    },
  },
  {
    match: /test|tests/i,
    run: async () => {
      await addThinking('Writing tests', 1400);
      await addToolCall({ name: 'Write', arg: 'src/utils/parse.test.ts', status: 'wrote', delay: 800 });
      await addCodeBlock(
`import { describe, it, expect } from 'vitest';
import { parseDuration } from './parse';

describe('parseDuration', () => {
  it('parses seconds', () => {
    expect(parseDuration('30s')).toBe(30000);
  });
  it('parses minutes', () => {
    expect(parseDuration('5m')).toBe(300000);
  });
  it('throws on garbage', () => {
    expect(() => parseDuration('xyz')).toThrow();
  });
});`, 'js');
      await addToolCall({ name: 'Bash', arg: 'npx vitest run parse.test.ts', delay: 1200 });
      await addAssistantParagraph(
        "**3 passing, 0 failing.** Coverage on `parse.ts` is now at 100%.",
        9
      );
    },
  },
];

// fallback responses
const genericResponses = [
  "Got it. Let me take a look at the codebase first.",
  "Interesting — that's a classic pattern. Here's how I'd approach it:",
  "Done. The change touches three files. Want me to walk through them?",
  "Yes — and there's actually a subtle gotcha here worth flagging.",
  "I can do that. Quick question first: should this preserve existing data or start clean?",
];

async function fakeAssistantResponse(userText) {
  // small natural delay
  await sleep(350);

  const matched = responses.find(r => r.match.test(userText));
  if (matched) {
    await matched.run();
    bumpContext();
    return;
  }

  // generic flow
  await addThinking('Thinking', 900 + Math.random() * 800);
  const reply = genericResponses[Math.floor(Math.random() * genericResponses.length)];
  await addAssistantParagraph(reply, 10);
  bumpContext();
}

// ---------- context % ticker ----------
let ctx = 7;
function bumpContext() {
  ctx = Math.max(1, ctx - 1);
  ctxPercent.textContent = `${ctx}% context left`;
}

// ---------- input handling ----------

let busy = false;

async function submit() {
  if (busy) return;
  const text = input.value.trim();
  if (!text) return;
  busy = true;
  input.value = '';
  autosize();

  await addUserMessage(text);
  await fakeAssistantResponse(text);

  busy = false;
  input.focus();
}

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    submit();
  }
});

input.addEventListener('input', autosize);
input.addEventListener('focus', () => promptBox.classList.add('focused'));
input.addEventListener('blur', () => promptBox.classList.remove('focused'));

resetBtn.addEventListener('click', () => {
  conversation.innerHTML = '';
  ctx = 7;
  ctxPercent.textContent = `${ctx}% context left`;
  input.focus();
});

hideBtn.addEventListener('click', () => {
  hud.classList.toggle('hidden');
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'h' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    hud.classList.toggle('hidden');
  }
});

// click anywhere to focus
document.addEventListener('click', (e) => {
  if (e.target.closest('button')) return;
  if (e.target.closest('.prompt-input')) return;
  input.focus();
});

input.focus();
// Defer autosize until after fonts/layout settle.
requestAnimationFrame(() => autosize());

// ===== Claude pet =====
// Pet is purely decorative — static, like the real CLI. Only toggle visibility.
petBtn.addEventListener('click', () => {
  pet.classList.toggle('hidden');
});
