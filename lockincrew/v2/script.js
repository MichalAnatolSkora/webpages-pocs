// ===== Live prompt =====
const promptInput = document.getElementById('promptInput');
const replyStream = document.getElementById('replyStream');

const sectionMap = {
  '/manifesto': 't-manifesto',
  '/services': 't-services',
  '/crew': 't-crew',
  '/receipts': 't-receipts',
  '/hire': 't-hire',
};

const replies = [
  {
    match: /^\/lockin/i,
    run: () => {
      openLockin();
      return 'entering <b>LOCK_IN_MODE</b> · notifications muted · slack not even open';
    },
  },
  {
    match: /^\/pricing/i,
    run: () => `<b>pricing</b> — strike team €60-120k fixed · rescue op €180/h t&m · ai pilot €25-45k · embedded €18-26k/mo. brief is better than spreadsheet.`,
  },
  {
    match: /^\/timezone/i,
    run: () => `<b>timezones</b> — warsaw (UTC+1), lisbon (UTC+0). overlap with EU + US east. async-first, sync when it actually moves something.`,
  },
  {
    match: /^\/stack/i,
    run: () => `<b>stack we reach for</b> — typescript, rust, python, go · postgres, redis · react, svelte · terraform, fly.io, aws · claude opus, sonnet, haiku · linear, github, signal. no jira.`,
  },
  {
    match: /^\/availability/i,
    run: () => `<b>next open slot</b> — strike cell: 2026-Q3 · rescue op: this month (1 slot) · embedded: q3 · ai pilot: q2 (waitlist).`,
  },
  {
    match: /^\/standup/i,
    run: () => `<b>standup</b> — we don't. one written brief on monday, one demo on friday, async in between. presence is not output.`,
  },
  {
    match: /^\/help|\?$/i,
    run: () => `<b>commands</b> — /manifesto · /services · /crew · /receipts · /hire · /lockin · /pricing · /timezone · /stack · /availability · /standup · /clear`,
  },
  {
    match: /^\/clear/i,
    run: () => {
      replyStream.innerHTML = '';
      return null;
    },
  },
  {
    match: /^\/(manifesto|services|crew|receipts|hire)/i,
    run: (cmd) => {
      const key = cmd.toLowerCase().split(' ')[0];
      const id = sectionMap[key];
      if (id) {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return `jumping to <b>${key}</b>…`;
      }
    },
  },
  {
    match: /meeting|standup|sync|jira/i,
    run: () => `we don't do that here. one brief, one demo, the rest is the keyboard.`,
  },
  {
    match: /hire|work|engage|brief/i,
    run: () => `say less. type <b>/hire</b> or mail <a href="mailto:lockin@lockincrew.io">lockin@lockincrew.io</a> with deadline + budget shape.`,
  },
  {
    match: /.*/,
    run: (cmd) => `unknown command: <b>${escapeHtml(cmd)}</b> · try <b>/help</b>`,
  },
];

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function appendReply(html) {
  if (!html) return;
  const div = document.createElement('div');
  div.className = 'reply';
  div.innerHTML = `<span class="resp-mark">✻</span> ${html}`;
  replyStream.appendChild(div);
  while (replyStream.children.length > 6) {
    replyStream.firstElementChild.remove();
  }
}

function runCommand(raw) {
  const cmd = raw.trim();
  if (!cmd) return;
  for (const r of replies) {
    if (r.match.test(cmd)) {
      const out = r.run(cmd);
      appendReply(out);
      return;
    }
  }
}

promptInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    runCommand(promptInput.value);
    promptInput.value = '';
  } else if (e.key === 'Escape') {
    promptInput.value = '';
  }
});

// ===== Global shortcuts =====
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.key === '/') {
    e.preventDefault();
    promptInput.focus();
  } else if (e.key.toLowerCase() === 'l') {
    openLockin();
  } else if (e.key === '?') {
    runCommand('/help');
  }
});

// ===== Lockin overlay =====
const lockinOverlay = document.getElementById('lockinOverlay');
const lockinClose = document.getElementById('lockinClose');
function openLockin() {
  lockinOverlay.hidden = false;
}
function closeLockin() {
  lockinOverlay.hidden = true;
}
lockinClose.addEventListener('click', closeLockin);
lockinOverlay.addEventListener('click', (e) => {
  if (e.target === lockinOverlay) closeLockin();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !lockinOverlay.hidden) closeLockin();
});

// ===== Hire form =====
const hireForm = document.getElementById('hireForm');
hireForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const fd = new FormData(hireForm);
  const name = (fd.get('name') || 'anon').toString().trim() || 'anon';
  appendReply(`brief queued · <b>${escapeHtml(name)}</b>, we'll be in touch within 5 days.`);
  hireForm.reset();
});

// ===== Token counter drift =====
const tokensEl = document.getElementById('tokens');
let tokens = 12840;
setInterval(() => {
  tokens += Math.floor(Math.random() * 7);
  tokensEl.textContent = tokens.toLocaleString();
}, 2200);
