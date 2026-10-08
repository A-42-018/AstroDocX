/* ============================================================
   ASTRODOCX — TEAM (#contact)
   The 6 member cards are rendered from this array. Drop the real
   data in here, no markup changes needed.

   Fields: name, role, github (full URL), linkedin (full URL),
           photo (path to an image, e.g. 'assets/team/name.webp').
   Empty github / linkedin / photo are simply not shown.
   A card with name '' is shown as a placeholder.
============================================================ */
const TEAM = [
  { name: 'Alif Mahmud', role: 'Team Lead · Full-stack', github: 'https://github.com/A-42-018', linkedin: '', photo: '' },
  { name: '', role: 'Role', github: '', linkedin: '', photo: '' },
  { name: '', role: 'Role', github: '', linkedin: '', photo: '' },
  { name: '', role: 'Role', github: '', linkedin: '', photo: '' },
  { name: '', role: 'Role', github: '', linkedin: '', photo: '' },
  { name: '', role: 'Role', github: '', linkedin: '', photo: '' }
];

(function () {
  'use strict';
  var grid = document.getElementById('teamGrid');
  if (!grid) return;
  var esc = function (s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };
  var safeUrl = function (u) { return /^https?:\/\//i.test(u) ? u : ''; };
  var initials = function (n, i) {
    var parts = String(n).trim().split(/\s+/).filter(Boolean);
    return parts.length ? (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() : 'M' + (i + 1);
  };
  grid.innerHTML = TEAM.map(function (m, i) {
    var placeholder = !m.name;
    var avatar = m.photo
      ? '<img class="team-avatar team-photo" src="' + esc(m.photo) + '" alt="" loading="lazy" decoding="async" width="52" height="52">'
      : '<span class="team-avatar" aria-hidden="true">' + esc(initials(m.name, i)) + '</span>';
    var links = '';
    if (safeUrl(m.github)) links += '<a href="' + esc(m.github) + '" target="_blank" rel="noopener" class="team-link">GitHub &#8599;</a>';
    if (safeUrl(m.linkedin)) links += '<a href="' + esc(m.linkedin) + '" target="_blank" rel="noopener" class="team-link">LinkedIn &#8599;</a>';
    return '<li class="team-card' + (placeholder ? ' is-placeholder' : '') + '">' + avatar +
      '<div class="team-meta"><h3>' + esc(placeholder ? 'Team member ' + (i + 1) : m.name) + '</h3>' +
      '<p class="team-role">' + esc(m.role) + '</p>' +
      (links ? '<p class="team-links">' + links + '</p>' : '') + '</div></li>';
  }).join('');
})();
