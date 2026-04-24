// ===== Env switcher =====
const envSwitcher = document.getElementById('envSwitcher');
const envTrigger = document.getElementById('envTrigger');
const envOptions = document.querySelectorAll('.env-option');

envTrigger.addEventListener('click', (e) => {
  e.stopPropagation();
  envSwitcher.classList.toggle('open');
  envTrigger.setAttribute('aria-expanded', envSwitcher.classList.contains('open'));
});

document.addEventListener('click', (e) => {
  if (!envSwitcher.contains(e.target)) {
    envSwitcher.classList.remove('open');
    envTrigger.setAttribute('aria-expanded', 'false');
  }
});

envOptions.forEach(opt => opt.addEventListener('click', () => {
  const env = opt.dataset.env;
  envOptions.forEach(o => o.classList.toggle('selected', o === opt));
  envTrigger.querySelector('.env-name').textContent = env;
  envSwitcher.classList.toggle('prod', env === 'production');
  envTrigger.querySelector('.env-lock').style.display = env === 'production' ? '' : 'none';
  envSwitcher.classList.remove('open');
}));

// ===== Config view (read-only) =====
const modal = document.getElementById('modalOverlay');
const modalClose = document.getElementById('modalClose');
const modalTitle = document.getElementById('modalTitle');
const filePath = document.getElementById('filePath');
const yamlPath = document.getElementById('yamlPath');
const yamlContent = document.getElementById('yamlContent');
const inferredLabel = document.getElementById('inferredLabel');
const inferredLines = document.getElementById('inferredLines');
const fileEditLink = document.getElementById('fileEditLink');
const visualGrid = document.getElementById('visualGrid');
const viewVisual = document.getElementById('viewVisual');
const viewRaw = document.getElementById('viewRaw');
const viewTabs = document.querySelectorAll('.view-tab');

const projects = {
  reports: { type: 'dotnet',    version: '8.0',   path: 'src/Acme.Reports',     branch: 'main' },
  worker:  { type: 'dotnet',    version: '8.0',   path: 'src/Acme.Worker',      branch: 'main' },
  api:     { type: 'dotnet',    version: '8.0',   path: 'src/Acme.Api',         branch: 'main' },
  auth:    { type: 'dotnet',    version: '8.0',   path: 'src/Acme.Auth',        branch: 'main' },
  web:     { type: 'ui',        version: null,    path: 'apps/web',             branch: 'main' },
  admin:   { type: 'ui',        version: null,    path: 'apps/admin',           branch: 'main' },
  legacy:  { type: 'dotnet-fw', version: '4.6.1', path: 'legacy/Acme.Billing',  branch: 'main' },
};

const typeLabel = { dotnet: '.NET', 'dotnet-fw': '.NET Framework', ui: 'UI' };

const pipelineCommands = {
  dotnet: [
    '$ dotnet restore',
    '$ dotnet build -c Release',
    '$ dotnet test --logger trx',
    '$ dotnet publish <dim>→ production</dim>',
  ],
  'dotnet-fw': [
    '$ nuget restore {name}.sln',
    '$ msbuild /p:Configuration=Release /p:Platform="Any CPU"',
    '$ vstest.console.exe **/bin/Release/*.Tests.dll',
    '$ msdeploy -source:contentPath -dest: <dim>→ production</dim>',
  ],
  ui: [
    '$ npm ci',
    '$ npm run lint',
    '$ npm run build',
    '$ npm test -- --ci',
    '$ deploy <dim>→ production</dim>',
  ],
};

function buildVisual(name, p) {
  const typeTagClass = p.type;
  const rows = [
    [`name`, `<code>${name}</code>`],
    [`type`, `<span class="type-tag ${typeTagClass}">${typeLabel[p.type]}</span>` + (p.version ? `<span class="vg-version">${p.version}</span>` : '')],
    [`path`, `<code>${p.path}</code>`],
    [`branch`, `<code>${p.branch}</code>`],
    [`env`, `<span class="vg-locked">🔒 production</span> <span class="vg-note">hardcoded for now</span>`],
  ];
  return rows.map(([k, v]) =>
    `<div class="vg-key">${k}</div><div class="vg-val">${v}</div>`
  ).join('');
}

function buildYaml(name, p) {
  const typeYaml = { dotnet: 'dotnet', 'dotnet-fw': 'dotnet-fw', ui: 'ui' }[p.type];
  const lines = [
    `<span class="yaml-comment"># pipelane.yml</span>`,
    `<span class="yaml-key">name:</span>    <span class="yaml-value">${name}</span>`,
    `<span class="yaml-key">type:</span>    <span class="yaml-value">${typeYaml}</span>`,
  ];
  if (p.version) lines.push(`<span class="yaml-key">version:</span> <span class="yaml-value">"${p.version}"</span>`);
  lines.push(`<span class="yaml-key">path:</span>    <span class="yaml-value">${p.path}</span>`);
  lines.push(`<span class="yaml-key">branch:</span>  <span class="yaml-value">${p.branch}</span>`);
  lines.push(`<span class="yaml-key">env:</span>     <span class="yaml-value">production</span>  <span class="yaml-comment"># hardcoded for now</span>`);
  return lines.join('\n');
}

function renderPipeline(name, p) {
  const label = p.version
    ? `derived pipeline · ${typeLabel[p.type]} ${p.version}`
    : `derived pipeline · ${typeLabel[p.type]}`;
  inferredLabel.textContent = label;
  inferredLines.innerHTML = pipelineCommands[p.type].map(line =>
    `<div class="inferred-line">${line
      .replace('{name}', name[0].toUpperCase() + name.slice(1))
      .replace('$', '<span class="prompt">$</span>')
      .replace(/<dim>(.*?)<\/dim>/, '<span class="dim">$1</span>')
    }</div>`
  ).join('');
}

function openModal(name) {
  const p = projects[name];
  if (!p) return;
  const file = `${p.path}/pipelane.yml`;
  modalTitle.textContent = `config · ${name}`;
  filePath.textContent = file;
  yamlPath.textContent = file;
  yamlContent.innerHTML = buildYaml(name, p);
  visualGrid.innerHTML = buildVisual(name, p);
  fileEditLink.href = `#${file}`;
  setView('visual');
  renderPipeline(name, p);
  modal.classList.add('open');
}

function setView(mode) {
  viewTabs.forEach(t => t.classList.toggle('active', t.dataset.view === mode));
  viewVisual.hidden = (mode !== 'visual');
  viewRaw.hidden = (mode !== 'raw');
}
viewTabs.forEach(t => t.addEventListener('click', () => setView(t.dataset.view)));

function closeModal() { modal.classList.remove('open'); }

document.querySelectorAll('.btn-edit').forEach(b => {
  b.addEventListener('click', () => openModal(b.dataset.project));
});

modalClose.addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
