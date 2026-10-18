export function transferCount(draft, key, available) {
  const max = Math.max(0, Math.min(9999, Math.floor(available)));
  const count = max
    ? Math.max(1, Math.min(max, draft.values.get(key) || 1))
    : 0;
  draft.values.set(key, count);
  return count;
}

export function drawTransferQuantity({
  machine,
  resource,
  name,
  direction,
  available,
  draft,
  node,
  button,
  act,
  refresh,
}) {
  const key = `${machine.id}-${resource}-${direction}`;
  const id = "transfer-" + key;
  const max = Math.max(0, Math.min(9999, Math.floor(available)));
  const verb = direction === "deposit" ? "Déposer" : "Prendre";
  const control = node("div", undefined, "transfer-control");
  const label = node("label", verb);
  label.htmlFor = id;
  const output = node("output");
  output.htmlFor = id;
  label.append(output);
  const slider = node("input");
  slider.type = "range";
  slider.id = id;
  slider.min = max ? "1" : "0";
  slider.max = String(max);
  slider.step = "1";
  slider.value = String(transferCount(draft, key, max));
  slider.dataset.transferKey = id;
  slider.setAttribute(
    "aria-label",
    `Quantité à ${direction === "deposit" ? "déposer" : "prendre"} · ${name}`,
  );
  const confirm = button(
    verb,
    () =>
      act("transfer", {
        id: machine.id,
        resource,
        direction,
        count: transferCount(draft, key, max),
      }),
    !max,
  );
  confirm.id = id + "-confirm";
  slider.disabled = confirm.disabled;
  function update() {
    const count = Math.max(
      0,
      Math.min(max, Math.floor(Number(slider.value) || 0)),
    );
    draft.values.set(key, count);
    output.textContent = `${count} / ${max}`;
    confirm.textContent = count ? `${verb} · ${count}` : verb;
    slider.setAttribute("aria-valuetext", `${count} sur ${max} disponibles`);
  }
  slider.addEventListener("input", update);
  slider.addEventListener("pointerdown", () => {
    draft.editing = true;
  });
  const finish = () => {
    draft.editing = false;
    refresh();
  };
  slider.addEventListener("pointerup", finish);
  slider.addEventListener("pointercancel", finish);
  slider.addEventListener("change", finish);
  slider.addEventListener("blur", () => {
    if (draft.editing) finish();
  });
  update();
  control.append(label, slider, confirm);
  return control;
}
