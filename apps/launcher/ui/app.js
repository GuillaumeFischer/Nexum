const $ = (id) => document.getElementById(id),
  api = window.atelier;
let current = {},
  hostId = null,
  sessionMode = 'host';
const node = (tag, text, cls) => {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (cls) el.className = cls;
  return el;
};
async function call(method, args) {
  try {
    const result = await api.invoke(method, args);
    if (result?.games) render(result);
    return result;
  } catch (e) {
    $("notice").hidden = false;
    $("notice").textContent = String(e.message).replace(
      /^Error invoking remote method '[^']+': Error: /,
      "",
    );
  }
}
function page(which) {
  for (const [id, name] of [
    ["library", "library"],
    ["joinSection", "join"],
    ["settings", "settings"],
  ])
    $(id).hidden = name !== which;
  for (const [id, name] of [
    ["libraryNav", "library"],
    ["joinNav", "join"],
    ["settingsNav", "settings"],
  ])
    $(id).classList.toggle("active", name === which);
  $("pageTitle").textContent = {
    library: "Ta bibliothèque.",
    join: "On se retrouve en jeu.",
    settings: "Ton profil.",
  }[which];
}
function button(label, action, cls = "secondary", disabled = false) {
  const b = node("button", label, cls);
  b.disabled = disabled;
  b.onclick = action;
  return b;
}
async function chooseMine(id, mode) {
  hostId = id;
  sessionMode = mode;
  const mines = await call('mines', {id});
  if (!mines || current.active || $('hostDialog').open) return;
  $('mineChoice').replaceChildren();
  const fresh = node('option','Créer une nouvelle mine');
  fresh.value='';
  $('mineChoice').append(fresh);
  for (const mine of [...mines].reverse()) {
    const option = node('option',mine.title+' · '+mine.players+' mineur'+(mine.players>1?'s':''));
    option.value=mine.id;
    $('mineChoice').append(option);
  }
  if (mines.length) $('mineChoice').value=mines.at(-1).id;
  $('mineModeText').textContent=mode==='solo'?'Ta mine est conservée sur ton PC. Tu pourras aussi l’héberger entre amis.':'Tu héberges la partie et conserves la sauvegarde.';
  $('confirmHost').textContent=mode==='solo'?'Ouvrir la mine':'Héberger la partie';
  $('hostDialog').returnValue='';
  $('hostDialog').showModal();
}
function render(state) {
  current = state;
  $("profileLabel").textContent = state.profileName;
  $("initial").textContent = state.profileName.slice(0, 1).toUpperCase();
  if (document.activeElement !== $("name")) $("name").value = state.profileName;
  $("version").textContent = "Atelier Jeux · " + state.version;
  $("notice").hidden = !state.notice;
  $("notice").textContent = state.notice || "";
  $("gameCount").textContent =
    state.games.length + " jeu" + (state.games.length > 1 ? "x" : "");
  $("games").replaceChildren();
  const busy = !!state.operation;
  for (const game of state.games) {
    const card = node("article", undefined, "game-card"),
      art = node("div", undefined, "game-art");
    if (game.id === "deep-miners") {
      const im = node("img");
      im.src = "../assets/deep-miners.png";
      im.alt = "Les galeries de Deep Miners";
      art.append(im);
    }
    art.append(
      node(
        "span",
        game.multiplayer
          ? "EXPLORATION · COOPÉRATION"
          : "TON PROCHAIN TERRAIN DE JEU",
        "tag",
      ),
    );
    const content = node("div", undefined, "game-content"),
      heading = node("div", undefined, "game-top");
    heading.append(
      node("h2", game.title),
      node("span", "v" + game.version, "game-version"),
    );
    content.append(
      heading,
      node("p", game.description),
      node(
        "div",
        (game.players || "Solo") +
          "   ·   " +
          (game.installedVersion
            ? "Installé sur ton PC"
            : "Prêt à télécharger"),
        "game-meta",
      ),
    );
    const actions = node("div", undefined, "game-actions");
    if (!game.installedVersion)
      actions.append(
        button(
          "Installer le jeu ↓",
          () => call("install", { id: game.id }),
          "primary",
          busy,
        ),
      );
    else {
      if (game.installedVersion !== game.version)
        actions.append(
          button(
            "Mettre à jour ↓",
            () => call("install", { id: game.id }),
            "primary",
            busy || !!state.active,
          ),
        );
      actions.append(
        button(
          "Héberger une partie",
          () => chooseMine(game.id, 'host'),
          game.installedVersion === game.version ? "primary" : "secondary",
          busy || !!state.active,
        ),
      );
      actions.append(
        button(
          "Jouer seul",
          () => chooseMine(game.id, 'solo'),
          "secondary",
          busy || !!state.active,
        ),
      );
    }
    content.append(actions);
    if (state.operation?.gameId === game.id) {
      const p = state.operation;
      content.append(
        node(
          "div",
          p.phase === "download"
            ? "Téléchargement · " +
                Math.min(100, Math.floor(((p.received || 0) / p.total) * 100)) +
                " %"
            : p.phase === "extract"
              ? "Installation du jeu…"
              : p.phase === "join"
                ? "Connexion à ton ami…"
                : "Préparation de la partie…",
          "progress",
        ),
      );
    }
    card.append(art, content);
    $("games").append(card);
  }
  $("join").disabled = busy || !!state.active;
  $("session").hidden = !state.active;
  if (state.active) {
    $("sessionTitle").textContent =
      state.active.kind === "host"
        ? "Tu héberges la partie"
        : state.active.kind === "solo"
          ? "Ta partie solo est ouverte"
          : "Tu joues chez un ami";
    $("sessionText").textContent =
      state.active.kind === "host"
        ? "Garde la partie ouverte pour accueillir tes amis. La mine est sauvegardée sur ton PC."
        : "Reviens au jeu quand tu veux.";
    $("copyInvite").hidden = !state.active.invite;
  }
  const update = state.update;
  $("launcherUpdate").hidden = !["available", "download", "ready"].includes(
    update.status,
  );
  $("launcherUpdate").replaceChildren();
  if (update.status === "available")
    $("launcherUpdate").append(
      node("span", "Une mise à jour du launcher est disponible."),
      button("Télécharger", () => call("update-download"), "secondary"),
    );
  if (update.status === "download")
    $("launcherUpdate").append(
      node(
        "span",
        "Mise à jour du launcher · " + Math.floor(update.percent || 0) + " %",
      ),
    );
  if (update.status === "ready")
    $("launcherUpdate").append(
      node("span", "Le launcher est prêt à être mis à jour."),
      button(
        "Redémarrer et installer",
        () => call("update-install"),
        "primary",
      ),
    );
}
$("libraryNav").onclick = () => page("library");
$("joinNav").onclick = () => page("join");
$("settingsNav").onclick = () => page("settings");
$("refresh").onclick = () => call("refresh");
$("join").onclick = () => call("join", { invite: $("invite").value.trim() });
$("saveProfile").onclick = () => call("profile", { name: $("name").value });
$("openSaves").onclick = () => call("saves");
$("github").onclick = () => call("github");
$("copyInvite").onclick = async () => {
  await call("copy");
  $("copyInvite").textContent = "Invitation copiée ✓";
};
$("showGame").onclick = () => call("focus");
$("stop").onclick = () => call("stop");
$("hostDialog").addEventListener("close", () => {
  if ($("hostDialog").returnValue === "host")
    void call(sessionMode, { id: hostId, mineId: $("mineChoice").value || null });
});
api.onChange(render);
void call("state");
