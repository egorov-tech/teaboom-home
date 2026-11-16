/* Photo galleries: home tiles and the product page share this one module.
   [data-gallery] root · [data-gallery-track] scroller · [data-gallery-frame] photos
   [data-gallery-dot] (tiles, product page on phones) · [data-gallery-thumb] (product page on desktop).
   Photos change only by hand — swipe, dots, thumbnails, arrow keys. No autoplay (п. 15, 12.11). */
(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const behavior = () => (reduceMotion.matches ? "auto" : "smooth");

  document.querySelectorAll("[data-gallery]").forEach((gallery) => {
    const track = gallery.querySelector("[data-gallery-track]");
    const frames = [...gallery.querySelectorAll("[data-gallery-frame]")];
    const markers = [...gallery.querySelectorAll("[data-gallery-dot], [data-gallery-thumb]")];
    const dots = markers.filter((m) => m.hasAttribute("data-gallery-dot"));
    const thumbs = markers.filter((m) => m.hasAttribute("data-gallery-thumb"));
    if (!track || frames.length < 2) return;

    let index = 0;

    // Only the first photo loads with the page; the rest arrive once the gallery is touched,
    // hovered or focused (lazy loading does not hold back images in a sideways scroller).
    const hydrate = () => {
      gallery.querySelectorAll("[data-srcset], [data-src]").forEach((el) => {
        if (el.dataset.srcset) el.srcset = el.dataset.srcset;
        if (el.dataset.src) el.src = el.dataset.src;
        el.removeAttribute("data-srcset");
        el.removeAttribute("data-src");
      });
    };
    ["pointerenter", "touchstart", "focusin"].forEach((type) =>
      gallery.addEventListener(type, hydrate, { once: true, passive: true })
    );
    track.addEventListener("scroll", hydrate, { once: true, passive: true });

    const mark = () => {
      [dots, thumbs].forEach((set) =>
        set.forEach((m, n) => {
          if (n === index) m.setAttribute("aria-current", "true");
          else m.removeAttribute("aria-current");
        })
      );
    };

    const offset = (i) => frames[i].offsetLeft - frames[0].offsetLeft;

    const render = (i) => {
      index = (i + frames.length) % frames.length;
      hydrate();
      track.scrollTo({ left: offset(index), behavior: behavior() });
      mark();
    };

    const go = (i, event) => {
      event?.preventDefault();
      event?.stopPropagation();
      render(i);
    };

    // After a width change (rotation, desktop ↔ phone), park the strip on the current photo.
    new ResizeObserver(() => track.scrollTo({ left: offset(index), behavior: "auto" })).observe(track);

    [dots, thumbs].forEach((set) => set.forEach((m, n) => m.addEventListener("click", (event) => go(n, event))));

    gallery.addEventListener("keydown", (event) => {
      if (!gallery.contains(document.activeElement)) return;
      if (event.key === "ArrowRight") go(index + 1, event);
      else if (event.key === "ArrowLeft") go(index - 1, event);
    });

    // A swipe updates the markers once a photo is mostly in view.
    const seen = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const i = frames.indexOf(entry.target);
          if (i >= 0 && i !== index) {
            index = i;
            mark();
          }
        });
      },
      { root: track, threshold: 0.6 }
    );
    frames.forEach((frame) => seen.observe(frame));
  });
})();
