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
         font-size:13px; cursor:pointer; }
button:hover { opacity:.9; }
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
<form method="post" action="/admin/settings/model">
<select name="model" id="model-select" style="min-width:320px;padding:6px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px">
<option value="">(use OPENROUTER_MODEL env default)</option>
<option value="{{.CurrentModel}}" selected>{{.CurrentModel}}</option>
</select>
<button type="submit">Save</button>
</form>
<p id="model-load-status" style="color:var(--muted);font-size:12px;margin-bottom:0">Loading available models…</p>
</div>
<script>
(function () {
  var select = document.getElementById('model-select');
  var status = document.getElementById('model-load-status');
  // The admin_token cookie is HttpOnly and scoped to /admin, so a
  // same-origin fetch under /admin/settings/models sends it automatically —
  // no need to read/forward it from JS.
  fetch('/admin/settings/models')
    .then(function (r) { if (!r.ok) throw new Error('failed'); return r.json(); })
    .then(function (models) {
      var current = select.value;
      select.length = 1;
      models.forEach(function (m) {
        var opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = m.name ? (m.name + ' (' + m.id + ')') : m.id;
        if (m.id === current) opt.selected = true;
        select.appendChild(opt);
      });
      status.textContent = models.length + ' models available.';
    })
    .catch(function () {
      status.textContent = 'Could not load the model list from OpenRouter — you can still type/save a model id above by editing this page\'s selected option value.';
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
