const $ = (id) => document.getElementById(id),
  api = window.atelier;
const paths = {
  home: "m3 10 9-7 9 7v11h-6v-7H9v7H3z",
  library:
    "M6 6h12l4 12c1 4-3 5-5 2l-2-3H9l-2 3c-2 3-6 2-5-2L6 6M7 9v6M4 12h6M16 10h.1M19 13h.1",
  people:
    "M16 21v-3c0-3-3-5-7-5s-7 2-7 5v3M14 4a4 4 0 0 1 0 8M22 21v-3c0-2-1-4-4-5M13 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  download: "M12 3v12m-5-5 5 5 5-5M3 16v5h18v-5",
  settings:
    "m9 3 1-1h4l1 4 3 1 3 1v4l-3 2-1 3-2 4h-4l-2-4-3-1-3-2v-4l3-2 1-3zM16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  search: "M16 16 22 22M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  refresh:
    "M21 4v6h-6M3 20v-6h6M5 8a8 8 0 0 1 13-3l3 5M3 14l3 5a8 8 0 0 0 13-3",
  chevron: "m6 9 6 6 6-6",
  play: "m8 4 13 8-13 8z",
  link: "m10 14 4-4M8 16l-2 2a4 4 0 0 1-6-6l6-6a4 4 0 0 1 6 0M16 8l2-2a4 4 0 0 1 6 6l-6 6a4 4 0 0 1-6 0",
  arrow: "M4 12h16m-6-6 6 6-6 6",
  save: "M4 3h14l3 3v15H3V3h1M7 3v7h10V3M7 21v-7h10v7",
  check: "m5 12 4 4L20 5",
  folder: "M3 5h7l2 3h9v13H3z",
  external: "M14 3h7v7M21 3 10 14M11 3H3v18h18v-8",
  clock: "M12 7v5l4 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  package: "m3 7 9-5 9 5v11l-9 5-9-5V7m0 0 9 5 9-5M12 12v11M7 5l10 5",
};
function icon(name) {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", "0 0 24 24");
  s.setAttribute("class", "icon");
  s.setAttribute("aria-hidden", "true");
  const p = document.createElementNS(s.namespaceURI, "path");
  p.setAttribute("d", paths[name] || paths.library);
  s.append(p);
  return s;
}
const node = (tag, text, cls) => {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  if (cls) n.className = cls;
  return n;
};
for (const el of document.querySelectorAll("[data-icon]"))
  el.replaceChildren(icon(el.dataset.icon));
let current = { games: [], update: {} },
  view = "home",
  selectedId = "deep-miners",
  hostId = null,
  sessionMode = "host",
  lastActive = null;
let history;
try {
  history = JSON.parse(localStorage.getItem("nexum-last-played") || "{}");
} catch {
  history = {};
}
const formatSize = (size) =>
  size
    ? new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(
        size / 1e6,
      ) + " Mo"
    : "—";
const locked = () => !!current.operation || !!current.active;
async function call(method, args) {
  try {
    const result = await api.invoke(method, args);
    if (result?.games) render(result);
    return result;
  } catch (error) {
    $("notice").hidden = false;
    $("notice").textContent = String(error.message).replace(
      /^Error invoking remote method '[^']+': Error: /,
      "",
    );
  }
}
function button(label, action, kind = "secondary", disabled = false, symbol) {
  const b = node("button", undefined, kind);
  if (symbol) b.append(icon(symbol));
  b.append(document.createTextNode(label));
  b.disabled = disabled;
  b.onclick = action;
  return b;
}
function page(next) {
  view = next;
  for (const [id, show] of [
    ["home", next === "home"],
    ["library", next === "home" || next === "library"],
    ["joinSection", next === "join"],
    ["downloads", next === "downloads"],
    ["settings", next === "settings"],
  ])
    $(id).hidden = !show;
  for (const el of document.querySelectorAll("[data-page]"))
    el.classList.toggle("active", el.dataset.page === next);
  $("pageTitle").textContent = {
    home: "Accueil NEXUM",
    library: "Bibliothèque",
    join: "Multijoueur",
    downloads: "Téléchargements",
    settings: "Paramètres",
  }[next];
}
async function chooseMine(id, mode) {
  if (locked()) return;
  hostId = id;
  sessionMode = mode;
  const mines = await call("mines", { id });
  if (!mines || current.active || $("hostDialog").open) return;
  $("mineChoice").replaceChildren();
  const fresh = node("option", "Créer une nouvelle mine");
  fresh.value = "";
  $("mineChoice").append(fresh);
  for (const mine of [...mines].reverse()) {
    const option = node(
      "option",
      mine.title +
        " · " +
        mine.players +
        " mineur" +
        (mine.players > 1 ? "s" : ""),
    );
    option.value = mine.id;
    $("mineChoice").append(option);
  }
  if (mines.length) $("mineChoice").value = mines.at(-1).id;
  $("mineModeText").textContent =
    mode === "solo"
      ? "Votre mine est conservée sur votre PC. Vous pourrez aussi l’héberger entre amis."
      : "Vous hébergez la partie et conservez la sauvegarde.";
  $("confirmHost").textContent =
    mode === "solo" ? "Ouvrir la mine" : "Héberger la partie";
  $("hostDialog").returnValue = "";
  $("hostDialog").showModal();
}
async function hostGame(game) {
  if (!game.installedVersion) {
    const result = await call("install", { id: game.id });
    if (!result) return;
  }
  return chooseMine(game.id, "host");
}
function logo(game) {
  const title = node("h2", undefined, "game-logo");
  if (game.id === "deep-miners")
    title.append(
      node("span", "DEEP", "deep"),
      node("span", "MINERS", "miners"),
    );
  else title.textContent = game.title;
  return title;
}
function renderHero(game) {
  $("hero").replaceChildren();
  if (!game) return;
  const copy = node("div", undefined, "hero-copy");
  copy.append(logo(game), node("p", game.description, "hero-description"));
  const chips = node("div", undefined, "chips");
  for (const text of ["Exploration", "Survie", "Coopération", "Construction"])
    chips.append(node("span", text, "chip"));
  copy.append(chips);
  const actions = node("div", undefined, "hero-actions"),
    playing = current.active?.gameId === game.id;
  actions.append(
    button(
      playing
        ? "Revenir au jeu"
        : !game.installedVersion
          ? "Installer"
          : game.installedVersion !== game.version
            ? "Mettre à jour"
            : "Jouer",
      () =>
        playing
          ? call("focus")
          : !game.installedVersion || game.installedVersion !== game.version
            ? call("install", { id: game.id })
            : chooseMine(game.id, "solo"),
      "primary",
      !!current.operation || (!!current.active && !playing),
      playing ? "arrow" : !game.installedVersion ? "download" : "play",
    ),
    button("Héberger", () => hostGame(game), "secondary", locked(), "people"),
    button("Rejoindre", () => page("join"), "secondary", locked(), "link"),
  );
  copy.append(actions);
  $("hero").append(copy);
  const info = node("aside", undefined, "hero-info");
  info.append(
    node("div", undefined, "info-art"),
    node("div", "Version disponible", "info-eyebrow"),
    node("h3", "v" + game.version),
    node("div", undefined, "info-divider"),
  );
  for (const [symbol, label, value] of [
    ["people", "Coopération", game.players || "Solo"],
    ["package", "Téléchargement", formatSize(game.size)],
    ["save", "Sauvegardes", "Sur votre PC"],
    [
      "check",
      "Installation",
      game.installedVersion ? "Installé" : "À télécharger",
    ],
  ]) {
    const row = node("div", undefined, "info-row");
    row.append(icon(symbol), node("span", label), node("strong", value));
    info.append(row);
  }
  info.append(
    button(
      "Gérer le jeu",
      () => page("downloads"),
      "info-link",
      false,
      "arrow",
    ),
  );
  $("hero").append(info);
}
function futureCover(index, small = false) {
  return node(
    "div",
    undefined,
    (small ? "mini-cover" : "cover") + " world world-" + index,
  );
}
function renderLibrary() {
  const query = $("search").value.trim().toLocaleLowerCase("fr"),
    games = current.games.filter((g) =>
      g.title.toLocaleLowerCase("fr").includes(query),
    );
  if ($("sort").value === "name")
    games.sort((a, b) => a.title.localeCompare(b.title, "fr"));
  else games.sort((a, b) => (history[b.id] || 0) - (history[a.id] || 0));
  $("games").replaceChildren();
  $("gameCount").textContent =
    current.games.length + " jeu" + (current.games.length > 1 ? "x" : "");
  $("emptySearch").hidden = games.length > 0;
  for (const game of games) {
    const card = node("article", undefined, "game-card"),
      art = node("div", undefined, "cover");
    if (game.id === "deep-miners") {
      const mark = node("div", "DEEP", "cover-title");
      mark.append(node("span", "MINERS"));
      art.append(mark);
    }
    const details = node("div", undefined, "card-details"),
      meta = node("div", undefined, "card-meta");
    meta.append(
      icon(game.installedVersion ? "check" : "download"),
      node("span", game.installedVersion ? "Installé" : formatSize(game.size)),
    );
    details.append(node("h3", game.title), meta);
    const action = button(
      "",
      () => {
        selectedId = game.id;
        page("home");
        renderHero(game);
        window.scrollTo({ top: 0, behavior: "smooth" });
      },
      "card-action",
    );
    action.setAttribute("aria-label", "Afficher " + game.title);
    card.append(art, details, action);
    $("games").append(card);
  }
  if (!query)
    for (let i = 0; i < 4; i++) {
      const card = node("article", undefined, "coming-card"),
        details = node("div", undefined, "card-details");
      details.append(
        node("h3", "Projet à venir"),
        node("div", "Prochainement", "card-meta"),
      );
      card.append(futureCover(i), details);
      $("games").append(card);
    }
}
function renderSidebar() {
  const list = $("sidebarGames");
  list.replaceChildren();
  for (const game of current.games) {
    const item = node(
      "button",
      undefined,
      "sidebar-game" + (game.id === selectedId ? " active" : ""),
    );
    const art = node("div", undefined, "mini-cover");
    if (game.id === "deep-miners") art.classList.add("mine-cover");
    item.append(art, node("span", game.title));
    item.onclick = () => {
      selectedId = game.id;
      page("home");
      renderHero(game);
      renderSidebar();
    };
    list.append(item);
  }
  for (let i = 0; i < 3; i++) {
    const item = node("div", undefined, "sidebar-game coming");
    item.append(futureCover(i, true), node("span", "Projet à venir"));
    list.append(item);
  }
}
function progressText(p) {
  if (p.phase === "download")
    return (
      "Téléchargement · " +
      Math.min(100, Math.floor(((p.received || 0) / p.total) * 100)) +
      " %"
    );
  if (p.phase === "extract") return "Installation du jeu…";
  return p.phase === "join"
    ? "Connexion à votre ami…"
    : "Préparation de la partie…";
}
function renderDownloads() {
  const list = $("downloadList");
  list.replaceChildren();
  for (const game of current.games) {
    const row = node("article", undefined, "download-row"),
      copy = node("div", undefined, "download-copy"),
      p = current.operation?.gameId === game.id ? current.operation : null;
    copy.append(
      node("h3", game.title),
      node(
        "p",
        game.installedVersion
          ? "Installé · v" +
              game.installedVersion +
              " · " +
              formatSize(game.size)
          : "Disponible · v" + game.version + " · " + formatSize(game.size),
      ),
    );
    if (p) {
      copy.append(node("div", progressText(p), "progress-copy"));
      if (p.phase === "download") {
        const progress = node("progress");
        progress.max = p.total || 1;
        progress.value = p.received || 0;
        copy.append(progress);
      }
    }
    row.append(node("div", undefined, "download-art"), copy);
    if (!game.installedVersion || game.installedVersion !== game.version)
      row.append(
        button(
          game.installedVersion ? "Mettre à jour" : "Installer",
          () => call("install", { id: game.id }),
          "primary",
          locked(),
          "download",
        ),
      );
    else row.append(node("span", "À jour", "card-meta"));
    list.append(row);
  }
  if (!current.games.length)
    list.append(node("p", "Le catalogue se prépare…", "empty"));
}
function renderHosts() {
  const list = $("hostGames");
  list.replaceChildren();
  for (const game of current.games.filter((g) => g.multiplayer)) {
    const row = node("div", undefined, "host-game"),
      text = node("div");
    text.append(node("strong", game.title), node("small", game.players));
    row.append(
      node("div", undefined, "mini"),
      text,
      button(
        game.installedVersion ? "Héberger" : "Installer",
        () => hostGame(game),
        "primary",
        locked(),
      ),
    );
    list.append(row);
  }
}
function renderUpdate() {
  const box = $("launcherUpdate"),
    update = current.update;
  box.replaceChildren();
  box.hidden = !["available", "download", "ready"].includes(update.status);
  if (update.status === "available")
    box.append(
      node("span", "NEXUM " + update.version + " est disponible."),
      button(
        "Télécharger",
        () => call("update-download"),
        "secondary",
        locked(),
        "download",
      ),
    );
  if (update.status === "download")
    box.append(
      node(
        "span",
        "Mise à jour de NEXUM · " + Math.floor(update.percent || 0) + " %",
      ),
    );
  if (update.status === "ready")
    box.append(
      node("span", "NEXUM est prêt à être mis à jour."),
      button(
        "Redémarrer et installer",
        () => call("update-install"),
        "primary",
        locked(),
      ),
    );
}
function render(state) {
  current = state;
  $("profileLabel").textContent = state.profileName;
  $("initial").textContent = state.profileName.slice(0, 1).toUpperCase();
  if (document.activeElement !== $("name")) $("name").value = state.profileName;
  $("version").textContent = "NEXUM · " + state.version;
  $("notice").hidden = !state.notice;
  $("notice").textContent = state.notice || "";
  const key = state.active?.url;
  if (key && key !== lastActive) {
    history[state.active.gameId] = Date.now();
    try {
      localStorage.setItem("nexum-last-played", JSON.stringify(history));
    } catch {}
  }
  lastActive = key;
  const selected =
    state.games.find((g) => g.id === selectedId) || state.games[0];
  if (selected) selectedId = selected.id;
  renderHero(selected);
  renderSidebar();
  renderLibrary();
  renderHosts();
  renderDownloads();
  renderUpdate();
  $("join").disabled = locked();
  $("downloadBadge").hidden =
    !["download", "extract"].includes(state.operation?.phase) &&
    state.update.status !== "download";
  $("session").hidden = !state.active;
  if (state.active) {
    $("sessionTitle").textContent =
      state.active.kind === "host"
        ? "Vous hébergez la partie"
        : state.active.kind === "solo"
          ? "Votre partie solo est ouverte"
          : "Vous jouez chez un ami";
    $("sessionText").textContent =
      state.active.kind === "host"
        ? "Partagez l’invitation et gardez votre partie ouverte pour accueillir vos amis."
        : "Votre aventure vous attend.";
    $("copyInvite").hidden = !state.active.invite;
    $("copyInvite").textContent = "Copier l’invitation";
  }
}
for (const nav of document.querySelectorAll("[data-page]"))
  nav.onclick = () => page(nav.dataset.page);
document.querySelector(".brand").onclick = (e) => {
  e.preventDefault();
  page("home");
};
$("profileButton").onclick = () => page("settings");
$("refresh").onclick = () => call("refresh");
$("search").addEventListener("input", () => {
  page("library");
  renderLibrary();
});
$("sort").onchange = renderLibrary;
$("join").onclick = () => call("join", { invite: $("invite").value.trim() });
$("saveProfile").onclick = () => call("profile", { name: $("name").value });
$("openSaves").onclick = () => call("saves");
$("github").onclick = () => call("github");
$("copyInvite").onclick = async () => {
  if (await call("copy")) $("copyInvite").textContent = "Invitation copiée ✓";
};
$("showGame").onclick = () => call("focus");
$("stop").onclick = () => call("stop");
$("hostDialog").addEventListener("close", () => {
  if ($("hostDialog").returnValue === "host")
    void call(sessionMode, {
      id: hostId,
      mineId: $("mineChoice").value || null,
    });
});
api.onChange(render);
void call("state");
