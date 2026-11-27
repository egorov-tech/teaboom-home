/* Custom dropdown in the site's style for <select data-select>. The native <select> stays the
   source of truth (forms, no-JS, change events); the button + listbox are its face.
   Keyboard: Enter/Space/↓/↑ open; ↑/↓/Home/End move; Enter/Space pick; Esc/Tab close.
   window.TeaboomSelect.enhanceAll / .refresh — for selects filled after load (checkout intervals). */
(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let uid = 0;
  const CHEVRON = '<svg class="select__chevron" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true" focusable="false"><path d="M2.5 4.5 6 8l3.5-3.5"/></svg>';

  const enhance = (select) => {
    if (!(select instanceof HTMLSelectElement)) return null;
    if (select.dataset.selectReady === "1") return select._teaboomSelect || null;

    select.setAttribute("data-select", "");
    const id = `select-${++uid}`;
    const wrap = document.createElement("div");
    wrap.className = "select";
    select.parentNode.insertBefore(wrap, select);
    wrap.append(select);
    select.classList.add("select__native");
    select.tabIndex = -1;
    select.setAttribute("aria-hidden", "true");
    select.dataset.selectReady = "1";

    const fieldLabel = select.closest(".field")?.querySelector(".field__label");
    const label = select.closest("label");
    const labelText = fieldLabel?.textContent.trim()
      || label?.querySelector("span")?.textContent.trim()
      || "";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "select__button press";
    button.setAttribute("aria-haspopup", "listbox");
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-controls", `${id}-list`);
    button.innerHTML = `<span class="select__value"></span>${CHEVRON}`;
    let value = button.querySelector(".select__value");

    const list = document.createElement("ul");
    list.className = "select__list reveal";
    list.id = `${id}-list`;
    list.setAttribute("role", "listbox");
    list.tabIndex = -1;
    if (labelText) list.setAttribute("aria-label", labelText);
    list.hidden = true;

    wrap.append(button, list);

    if (fieldLabel) {
      if (!fieldLabel.id) fieldLabel.id = `${id}-label`;
      value.id = `${id}-value`;
      button.setAttribute("aria-labelledby", `${fieldLabel.id} ${id}-value`);
    } else if (label) {
      const lab = label.querySelector("span");
      if (lab) {
        lab.id = `${id}-label`;
        value.id = `${id}-value`;
        button.setAttribute("aria-labelledby", `${id}-label ${id}-value`);
      }
    }

    let options = [];
    let face = null;
    let active = 0;
    let timer = 0;

    const sync = () => {
      if (!select.options.length) {
        value.textContent = "";
        return;
      }
      const i = Math.max(select.selectedIndex, 0);
      value.textContent = select.options[i]?.textContent || "";
      options.forEach((o, n) => o.setAttribute("aria-selected", String(n === i)));
    };

    const rebuildOptions = () => {
      list.replaceChildren();
      options = [...select.options].map((opt, i) => {
        const li = document.createElement("li");
        li.className = "select__option";
        li.id = `${id}-opt-${i}`;
        li.setAttribute("role", "option");
        li.dataset.value = opt.value;
        li.textContent = opt.textContent;
        li.addEventListener("click", () => pick(i));
        li.addEventListener("pointermove", () => highlight(i));
        list.append(li);
        return li;
      });

      if (!face) {
        face = document.createElement("span");
        face.className = "select__face";
        value.replaceWith(face);
        face.append(value);
      } else {
        face.querySelectorAll(".select__ghost").forEach((g) => g.remove());
      }
      options.forEach((o) => {
        const ghost = document.createElement("span");
        ghost.className = "select__ghost";
        ghost.setAttribute("aria-hidden", "true");
        ghost.textContent = o.textContent;
        face.append(ghost);
      });
      sync();
    };

    const highlight = (i) => {
      if (!options.length) return;
      active = (i + options.length) % options.length;
      options.forEach((o, n) => o.classList.toggle("is-active", n === active));
      list.setAttribute("aria-activedescendant", options[active].id);
      options[active].scrollIntoView({ block: "nearest" });
    };

    const isOpen = () => button.getAttribute("aria-expanded") === "true";

    const open = () => {
      if (isOpen() || !options.length) return;
      clearTimeout(timer);
      button.setAttribute("aria-expanded", "true");
      list.classList.remove("is-closing");
      list.hidden = false;
      highlight(Math.max(select.selectedIndex, 0));
      const show = () => {
        list.classList.add("is-open");
        list.focus({ preventScroll: true });
      };
      if (reduceMotion.matches) show();
      else requestAnimationFrame(() => requestAnimationFrame(show));
    };

    const close = ({ focus = true } = {}) => {
      if (!isOpen()) return;
      button.setAttribute("aria-expanded", "false");
      list.removeAttribute("aria-activedescendant");
      list.classList.remove("is-open");
      if (reduceMotion.matches) list.hidden = true;
      else {
        list.classList.add("is-closing");
        timer = setTimeout(() => { list.hidden = true; list.classList.remove("is-closing"); }, 220);
      }
      if (focus) button.focus({ preventScroll: true });
    };

    const pick = (i) => {
      if (select.selectedIndex !== i) {
        select.selectedIndex = i;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
      sync();
      close();
    };

    button.addEventListener("click", () => (isOpen() ? close() : open()));
    button.addEventListener("keydown", (e) => {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) { e.preventDefault(); open(); }
    });
    list.addEventListener("keydown", (e) => {
      if (!options.length) return;
      const keys = { ArrowDown: active + 1, ArrowUp: active - 1, Home: 0, End: options.length - 1 };
      if (e.key in keys) { e.preventDefault(); highlight(keys[e.key]); }
      else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(active); }
      else if (e.key === "Escape") { e.preventDefault(); close(); }
      else if (e.key === "Tab") close({ focus: false });
    });
    document.addEventListener("pointerdown", (e) => { if (!wrap.contains(e.target)) close({ focus: false }); });
    select.addEventListener("change", sync);
    select.addEventListener("sync", sync);

    rebuildOptions();

    const api = { sync, rebuildOptions, wrap, button };
    select._teaboomSelect = api;
    return api;
  };

  const enhanceAll = (root = document) => {
    (root.querySelectorAll ? root : document).querySelectorAll("select[data-select]").forEach(enhance);
  };

  const refresh = (select) => {
    if (!(select instanceof HTMLSelectElement)) return null;
    select.setAttribute("data-select", "");
    const api = enhance(select);
    api?.rebuildOptions();
    return api;
  };

  enhanceAll();
  window.TeaboomSelect = { enhance, enhanceAll, refresh };
})();
