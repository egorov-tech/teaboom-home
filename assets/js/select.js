/* Custom dropdown in the site's style for <select data-select>. The native <select> stays the
   source of truth (forms, no-JS, change events); the button + listbox are its face.
   Keyboard: Enter/Space/↓/↑ open; ↑/↓/Home/End move; Enter/Space pick; Esc/Tab close. */
(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let uid = 0;

  document.querySelectorAll("select[data-select]").forEach((select) => {
    const id = `select-${++uid}`;
    const wrap = document.createElement("div");
    wrap.className = "select";
    select.parentNode.insertBefore(wrap, select);
    wrap.append(select);
    select.classList.add("select__native");
    select.tabIndex = -1;
    select.setAttribute("aria-hidden", "true");

    const label = select.closest("label");
    const labelText = label?.querySelector("span")?.textContent.trim() || "";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "select__button press";
    button.setAttribute("aria-haspopup", "listbox");
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-controls", `${id}-list`);
    button.innerHTML = '<span class="select__value"></span><svg class="select__chevron" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true" focusable="false"><path d="M2.5 4.5 6 8l3.5-3.5"/></svg>';
    const value = button.querySelector(".select__value");

    const list = document.createElement("ul");
    list.className = "select__list reveal";
    list.id = `${id}-list`;
    list.setAttribute("role", "listbox");
    list.tabIndex = -1;
    if (labelText) list.setAttribute("aria-label", labelText);
    list.hidden = true;

    const options = [...select.options].map((opt, i) => {
      const li = document.createElement("li");
      li.className = "select__option";
      li.id = `${id}-opt-${i}`;
      li.setAttribute("role", "option");
      li.dataset.value = opt.value;
      li.textContent = opt.textContent;
      list.append(li);
      return li;
    });
    wrap.append(button, list);
    // The visible label now names the button.
    if (label) {
      const lab = label.querySelector("span");
      if (lab) {
        lab.id = `${id}-label`;
        button.setAttribute("aria-labelledby", `${id}-label ${id}-value`);
        value.id = `${id}-value`;
      }
    }

    let active = 0;
    let timer = 0;

    const sync = () => {
      const i = Math.max(select.selectedIndex, 0);
      value.textContent = select.options[i].textContent;
      options.forEach((o, n) => o.setAttribute("aria-selected", String(n === i)));
    };

    const highlight = (i) => {
      active = (i + options.length) % options.length;
      options.forEach((o, n) => o.classList.toggle("is-active", n === active));
      list.setAttribute("aria-activedescendant", options[active].id);
      options[active].scrollIntoView({ block: "nearest" });
    };

    const isOpen = () => button.getAttribute("aria-expanded") === "true";

    const open = () => {
      if (isOpen()) return;
      clearTimeout(timer);
      button.setAttribute("aria-expanded", "true");
      list.classList.remove("is-closing");
      list.hidden = false;
      highlight(Math.max(select.selectedIndex, 0));
      // Focus once the list is visible (.reveal keeps it hidden until .is-open).
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
      const keys = { ArrowDown: active + 1, ArrowUp: active - 1, Home: 0, End: options.length - 1 };
      if (e.key in keys) { e.preventDefault(); highlight(keys[e.key]); }
      else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(active); }
      else if (e.key === "Escape") { e.preventDefault(); close(); }
      else if (e.key === "Tab") close({ focus: false });
    });
    options.forEach((o, i) => {
      o.addEventListener("click", () => pick(i));
      o.addEventListener("pointermove", () => highlight(i));
    });
    document.addEventListener("pointerdown", (e) => { if (!wrap.contains(e.target)) close({ focus: false }); });
    // Another script set the value (Back/Forward on the category page).
    select.addEventListener("change", sync);
    select.addEventListener("sync", sync);
    sync();

    // The button keeps the width of its longest option (all labels sit, invisible, in the same
    // grid cell as the value), so picking a shorter one never shifts what stands beside it.
    const face = document.createElement("span");
    face.className = "select__face";
    value.replaceWith(face);
    face.append(value);
    options.forEach((o) => {
      const ghost = document.createElement("span");
      ghost.className = "select__ghost";
      ghost.setAttribute("aria-hidden", "true");
      ghost.textContent = o.textContent;
      face.append(ghost);
    });
  });
})();
