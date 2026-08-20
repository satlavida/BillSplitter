package api

import "html/template"

const adminLayoutHTML = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>BillSplitter Admin</title>
<style>
:root { --accent:#2563eb; --border:#e2e8f0; --bg:#f8fafc; --text:#1e293b; --muted:#64748b; }
* { box-sizing:border-box; }
body { margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
       background:var(--bg); color:var(--text); }
nav { background:#fff; border-bottom:1px solid var(--border); padding:12px 24px; display:flex; gap:16px; }
nav a { color:var(--accent); text-decoration:none; font-weight:600; font-size:14px; }
nav a:hover { text-decoration:underline; }
main { max-width:1100px; margin:24px auto; padding:0 20px; }
h1 { font-size:20px; margin:0 0 16px; }
h2 { font-size:15px; color:var(--muted); margin:24px 0 8px; text-transform:uppercase; letter-spacing:.04em; }
.card { background:#fff; border:1px solid var(--border); border-radius:8px; padding:16px 20px; margin-bottom:16px; }
.stat-grid { display:flex; gap:12px; flex-wrap:wrap; }
.stat-grid .card { flex:1 1 160px; text-align:center; }
.stat-grid .value { font-size:24px; font-weight:700; }
.stat-grid .label { font-size:12px; color:var(--muted); }
table { width:100%; border-collapse:collapse; background:#fff; font-size:13px; }
table th, table td { padding:8px 12px; border-bottom:1px solid var(--border); text-align:left; }
table th { color:var(--muted); font-weight:600; font-size:12px; text-transform:uppercase; }
.table-wrap { overflow-x:auto; border:1px solid var(--border); border-radius:8px; }
.badge { display:inline-block; padding:2px 8px; border-radius:999px; font-size:11px; font-weight:600; }
.badge-yes { background:#dcfce7; color:#15803d; }
.badge-no  { background:#f1f5f9; color:var(--muted); }
.badge-fail { background:#fee2e2; color:#b91c1c; }
.admin-search { padding:6px 10px; border:1px solid var(--border); border-radius:6px; font-size:13px;
                margin-bottom:8px; width:280px; }
button { background:var(--accent); color:#fff; border:none; border-radius:6px; padding:6px 12px;
         font-size:13px; cursor:pointer; margin-right:8px; }
button:hover { opacity:.9; }
button[type="button"] { background:#fff; color:var(--text); border:1px solid var(--border); }
.combobox { position:relative; display:block; margin-bottom:4px; }
.combobox-options { position:absolute; top:100%; left:0; width:380px; max-height:280px; overflow-y:auto;
                     background:#fff; border:1px solid var(--border); border-top:none; border-radius:0 0 8px 8px;
                     box-shadow:0 4px 10px rgba(0,0,0,.08); z-index:20; }
.combobox-option { padding:6px 10px; cursor:pointer; }
.combobox-option:hover { background:var(--bg); }
.combobox-option .id { font-size:13px; font-weight:600; }
.combobox-option .name { font-size:11px; color:var(--muted); }
</style>
</head>
<body>
<nav>
<a href="/admin">Sessions</a>
<a href="/admin/stats">Stats</a>
<a href="/admin/bill-processor">Bill Scanner</a>
<a href="/admin/settings">Settings</a>
<a href="/admin/jobs">Jobs</a>
</nav>
<main>
{{template "content" .}}
</main>
<script>
document.querySelectorAll('.admin-search').forEach(function (input) {
  var table = document.getElementById(input.dataset.target);
  if (!table) return;
  input.addEventListener('input', function () {
    var q = input.value.toLowerCase();
    table.querySelectorAll('tbody tr').forEach(function (tr) {
      tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });
});
</script>
</body>
</html>`

const adminSessionsContentHTML = `{{define "content"}}
<h1>Sessions</h1>
<input type="text" class="admin-search" data-target="sessions-table" placeholder="Filter sessions…">
<div class="table-wrap">
<table id="sessions-table">
<thead><tr><th>Code</th><th>Title</th><th>Created</th><th>Last Access</th><th>Settled</th><th></th></tr></thead>
<tbody>
{{range .Sessions}}
<tr>
<td>{{.ID}}</td>
<td>{{.Title}}</td>
<td>{{.CreatedAt}}</td>
<td>{{.LastAccessAt}}</td>
<td>{{if .IsSettled}}<span class="badge badge-yes">yes</span>{{else}}<span class="badge badge-no">no</span>{{end}}</td>
<td>
<form method="post" action="/admin/sessions/{{.ID}}/purge" style="display:inline">
<button type="submit">Purge</button>
</form>
</td>
</tr>
{{end}}
</tbody>
</table>
</div>
{{end}}`

const adminStatsContentHTML = `{{define "content"}}
<h1>Stats</h1>
<div class="stat-grid">
<div class="card"><div class="value">{{.SessionCount}}</div><div class="label">Sessions</div></div>
<div class="card"><div class="value">{{.BillCount}}</div><div class="label">Bills</div></div>
<div class="card"><div class="value">{{printf "%.2f" .AvgBillsPerSession}}</div><div class="label">Avg bills/session</div></div>
<div class="card"><div class="value">{{.ImageCount}}</div><div class="label">Images</div></div>
</div>
{{end}}`

const adminScanContentHTML = `{{define "content"}}
<h1>Bill Scanner</h1>
<h2>Last 30 days</h2>
<div class="stat-grid">
<div class="card"><div class="value">{{.Last30Days.RequestCount}}</div><div class="label">Requests</div></div>
<div class="card"><div class="value">{{.Last30Days.PromptTokens}}</div><div class="label">Prompt tokens</div></div>
<div class="card"><div class="value">{{.Last30Days.CompletionTokens}}</div><div class="label">Completion tokens</div></div>
<div class="card"><div class="value">{{.Last30Days.TotalTokens}}</div><div class="label">Total tokens</div></div>
</div>
<h2>All-time</h2>
<div class="stat-grid">
<div class="card"><div class="value">{{.SuccessCount}}</div><div class="label">Successful</div></div>
<div class="card"><div class="value">{{.FailureCount}}</div><div class="label">Failed</div></div>
</div>
<h2>Recent requests</h2>
<input type="text" class="admin-search" data-target="scan-requests-table" placeholder="Filter requests…">
<div class="table-wrap">
<table id="scan-requests-table">
<thead><tr><th>Requested At</th><th>Model</th><th>Success</th><th>Prompt</th><th>Completion</th><th>Total</th></tr></thead>
<tbody>
{{range .RecentRequests}}
<tr>
<td>{{.RequestedAt}}</td>
<td>{{.Model}}</td>
<td>{{if .Success}}<span class="badge badge-yes">yes</span>{{else}}<span class="badge badge-no">no</span>{{end}}</td>
<td>{{.PromptTokens}}</td>
<td>{{.CompletionTokens}}</td>
<td>{{.TotalTokens}}</td>
</tr>
{{end}}
</tbody>
</table>
</div>
{{end}}`

const adminSettingsContentHTML = `{{define "content"}}
<h1>Settings</h1>

<h2>Receipt-scan model</h2>
<div class="card">
<p style="margin-top:0;color:var(--muted);font-size:13px">
Current: <strong>{{.CurrentModel}}</strong>
{{if .Overridden}}(admin override){{else}}(from OPENROUTER_MODEL env, default "{{.EnvDefaultModel}}"){{end}}
</p>
<form method="post" action="/admin/settings/model" id="model-form">
<div class="combobox" id="model-combobox">
<input type="text" id="model-search" class="admin-search" autocomplete="off" placeholder="Search models by id or name…" value="{{.CurrentModel}}" style="width:380px;margin-bottom:0">
<input type="hidden" name="model" id="model-hidden" value="{{.CurrentModel}}">
<div id="model-options" class="combobox-options" hidden></div>
</div>
<div style="margin:8px 0">
<label style="font-size:12px;color:var(--muted);margin-right:14px">
<input type="checkbox" id="model-filter-image" checked style="vertical-align:middle"> Image input only (needed for receipt scanning)
</label>
<label style="font-size:12px;color:var(--muted)">
<input type="checkbox" id="model-filter-text" style="vertical-align:middle"> Text-only
</label>
</div>
<button type="submit">Save</button>
<button type="button" id="model-clear">Use env default</button>
<p id="model-load-status" style="color:var(--muted);font-size:12px;margin-bottom:0;margin-top:8px">Loading available models…</p>
</form>
</div>

<h2>Session &amp; log retention</h2>
<div class="stat-grid">
<div class="card"><div class="value">{{.IdleRetentionDays}}</div><div class="label">Idle session retention (days)</div></div>
<div class="card"><div class="value">{{.SettledRetentionDays}}</div><div class="label">Settled session retention (days)</div></div>
<div class="card"><div class="value">{{.LogRetentionDays}}</div><div class="label">Log &amp; error retention (days)</div></div>
</div>
<p style="color:var(--muted);font-size:12px">
Set via IDLE_SESSION_RETENTION_DAYS / SETTLED_SESSION_RETENTION_DAYS / LOG_RETENTION_DAYS env vars — not editable from this page.
</p>

<script>
(function () {
  var searchInput = document.getElementById('model-search');
  var hiddenInput = document.getElementById('model-hidden');
  var optionsBox = document.getElementById('model-options');
  var status = document.getElementById('model-load-status');
  var imageFilter = document.getElementById('model-filter-image');
  var textFilter = document.getElementById('model-filter-text');
  var clearBtn = document.getElementById('model-clear');
  var allModels = [];
  var activeIndex = -1;

  function modalities(m) {
    return (m.architecture && m.architecture.input_modalities) || [];
  }
  function isImageCapable(m) { return modalities(m).indexOf('image') !== -1; }
  function isTextOnly(m) {
    var mods = modalities(m);
    return mods.indexOf('image') === -1;
  }
  function capabilityBadge(m) {
    return isImageCapable(m) ? '📷 image+text' : '📝 text only';
  }

  function filteredModels() {
    var q = searchInput.value.trim().toLowerCase();
    return allModels.filter(function (m) {
      if (imageFilter.checked && !isImageCapable(m)) return false;
      if (textFilter.checked && !isTextOnly(m)) return false;
      if (!q) return true;
      return m.id.toLowerCase().indexOf(q) !== -1 || (m.name || '').toLowerCase().indexOf(q) !== -1;
    });
  }

  function renderOptions() {
    var matches = filteredModels().slice(0, 50);
    optionsBox.innerHTML = '';
    activeIndex = -1;
    if (matches.length === 0) {
      optionsBox.hidden = true;
      return;
    }
    matches.forEach(function (m, i) {
      var row = document.createElement('div');
      row.className = 'combobox-option';
      row.dataset.id = m.id;
      row.innerHTML = '<div class="id">' + m.id + '</div><div class="name">' + (m.name || '') + ' &middot; ' + capabilityBadge(m) + '</div>';
      row.addEventListener('mousedown', function (e) {
        e.preventDefault();
        selectModel(m.id);
      });
      optionsBox.appendChild(row);
    });
    optionsBox.hidden = false;
  }

  function selectModel(id) {
    hiddenInput.value = id;
    searchInput.value = id;
    optionsBox.hidden = true;
  }

  searchInput.addEventListener('input', function () {
    hiddenInput.value = searchInput.value;
    renderOptions();
  });
  searchInput.addEventListener('focus', renderOptions);
  searchInput.addEventListener('blur', function () {
    setTimeout(function () { optionsBox.hidden = true; }, 100);
  });
  imageFilter.addEventListener('change', function () {
    if (imageFilter.checked) textFilter.checked = false;
    renderOptions();
  });
  textFilter.addEventListener('change', function () {
    if (textFilter.checked) imageFilter.checked = false;
    renderOptions();
  });
  clearBtn.addEventListener('click', function () {
    hiddenInput.value = '';
    searchInput.value = '';
    searchInput.placeholder = '(use OPENROUTER_MODEL env default)';
  });

  // The admin_token cookie is HttpOnly and scoped to /admin, so a
  // same-origin fetch under /admin/settings/models sends it automatically —
  // no need to read/forward it from JS.
  fetch('/admin/settings/models')
    .then(function (r) { if (!r.ok) throw new Error('failed'); return r.json(); })
    .then(function (models) {
      allModels = models;
      var current = hiddenInput.value;
      var currentIsImage = models.some(function (m) { return m.id === current && isImageCapable(m); });
      // Don't hide the currently-saved model behind the image-only filter if
      // it isn't actually image-capable (e.g. picked before this filter existed).
      if (current && !currentIsImage) imageFilter.checked = false;
      status.textContent = models.length + ' models available (' + models.filter(isImageCapable).length + ' image-capable).';
    })
    .catch(function () {
      status.textContent = 'Could not load the model list from OpenRouter — you can still type/save a model id above.';
    });
})();
</script>
{{end}}`

const adminJobsContentHTML = `{{define "content"}}
<h1>Background Jobs</h1>
<div class="table-wrap">
<table>
<thead><tr><th>Job</th><th>Status</th><th>Started</th><th>Finished</th><th>Message</th></tr></thead>
<tbody>
{{range .Runs}}
<tr>
<td>{{.JobName}}</td>
<td>
{{if eq .Status "success"}}<span class="badge badge-yes">success</span>
{{else if eq .Status "failed"}}<span class="badge badge-fail">failed</span>
{{else}}<span class="badge badge-no">{{.Status}}</span>{{end}}
</td>
<td>{{.StartedAt}}</td>
<td>{{if .FinishedAt}}{{.FinishedAt}}{{else}}—{{end}}</td>
<td>{{if .Message}}{{.Message}}{{else}}—{{end}}</td>
</tr>
{{end}}
</tbody>
</table>
</div>
{{end}}`

var adminBaseTemplate = template.Must(template.New("layout").Parse(adminLayoutHTML))

var adminSessionsTemplate = template.Must(template.Must(adminBaseTemplate.Clone()).Parse(adminSessionsContentHTML))
var adminStatsTemplate = template.Must(template.Must(adminBaseTemplate.Clone()).Parse(adminStatsContentHTML))
var adminScanTemplate = template.Must(template.Must(adminBaseTemplate.Clone()).Parse(adminScanContentHTML))
var adminSettingsTemplate = template.Must(template.Must(adminBaseTemplate.Clone()).Parse(adminSettingsContentHTML))
var adminJobsTemplate = template.Must(template.Must(adminBaseTemplate.Clone()).Parse(adminJobsContentHTML))
