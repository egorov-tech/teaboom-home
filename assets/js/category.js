/* п. 17: sorting and pages over the demo set. State lives in the address (?sort=…&page=…),
   so Back/Forward and a shared link restore it. The shop does the same on its server. */
(() => {
  "use strict";

  const root = document.querySelector("[data-category]");
  if (!root) return;

  const list = root.querySelector("[data-list]");
  const items = [...list.querySelectorAll("[data-item]")];
  const select = root.querySelector("[data-sort]");
  const count = root.querySelector("[data-count]");
  const links = [...root.querySelectorAll("[data-page]")];
  const per = Number(root.dataset.perPage) || 12;
  const pages = Math.max(1, Math.ceil(items.length / per));
  const sorts = [...select.options].map((o) => o.value);
  const collator = new Intl.Collator("ru");

  const compare = {
    effective_price: (a, b) => a.dataset.price - b.dataset.price || a.dataset.order - b.dataset.order,
    "-effective_price": (a, b) => b.dataset.price - a.dataset.price || a.dataset.order - b.dataset.order,
    name: (a, b) => collator.compare(a.dataset.name, b.dataset.name),
    "-name": (a, b) => collator.compare(b.dataset.name, a.dataset.name),
  };

  const read = () => {
    const q = new URLSearchParams(location.search);
    const sort = sorts.includes(q.get("sort")) ? q.get("sort") : sorts[0];
    // Out-of-range or broken page numbers fall back to the nearest real page.
    const page = Math.min(Math.max(parseInt(q.get("page"), 10) || 1, 1), pages);
    return { sort, page };
  };

  const href = (sort, page) => {
    const q = new URLSearchParams();
    if (sort !== sorts[0]) q.set("sort", sort);
    if (page > 1) q.set("page", page);
    const s = q.toString();
    return s ? `?${s}` : location.pathname.split("/").pop() || "./";
  };

  const render = ({ sort, page }) => {
    select.value = sort;
    select.dispatchEvent(new Event("sync"));
    const ordered = [...items].sort(compare[sort]);
    ordered.forEach((li) => list.append(li));
    ordered.forEach((li, i) => {
      li.hidden = Math.floor(i / per) + 1 !== page;
    });
    const from = (page - 1) * per + 1;
    const to = Math.min(page * per, items.length);
    count.textContent = `Товары ${from}–${to} из ${items.length}`;
    links.forEach((a) => {
      const n = Number(a.dataset.page);
      a.href = href(sort, n);
      if (n === page) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  };

  const go = (state, { push = true, scroll = false } = {}) => {
    render(state);
    const url = href(state.sort, state.page);
    if (push) history.pushState(state, "", url);
    else history.replaceState(state, "", url);
    if (scroll) root.querySelector(".category__bar").scrollIntoView({ block: "start" });
  };

  select.addEventListener("change", () => go({ sort: select.value, page: 1 }));
  links.forEach((a) =>
    a.addEventListener("click", (event) => {
      event.preventDefault();
      go({ sort: select.value, page: Number(a.dataset.page) }, { scroll: true });
    })
  );
  window.addEventListener("popstate", () => render(read()));

  go(read(), { push: false });
})();
