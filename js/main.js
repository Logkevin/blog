/* ==================================================================
   LIN WEI — INTERACTIONS
   Vanilla JS, no build step, no external dependencies.
=================================================================== */
(() => {
  'use strict';

  const SITE = window.SITE || { works: [], posts: [] };
  const works = Array.isArray(SITE.works) ? SITE.works : [];
  const posts = Array.isArray(SITE.posts) ? SITE.posts : [];

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const pad = (number) => String(number).padStart(2, '0');
  const root = document.documentElement;
  const body = document.body;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  const isDialogOpen = (dialog) => Boolean(dialog && dialog.open);

  /* --------------------------------------------------------------- render */
  function renderWorks() {
    const grid = $('#works-grid');
    if (!grid || !works.length) return;

    grid.innerHTML = works.map((work, index) => `
      <article class="work work--p${(index % 4) + 1}" data-category="${work.filter}" data-work-index="${index}" data-reveal style="--d:${(index % 2) * 90}ms">
        <button class="work__open" type="button" data-open-work="${index}" data-cursor="PLAY" aria-label="查看作品：${work.title}，${work.year}">
          <div class="work__media">
            <video class="work__video" muted loop playsinline preload="metadata" poster="${work.poster}" data-src="${work.video}" aria-hidden="true"></video>
            <span class="work__top">
              <span class="work__no">${pad(index + 1)}</span>
              <span>${work.year}</span>
            </span>
            <span class="work__bottom">
              <span class="work__view">VIEW PROJECT ↗</span>
              <span class="work__play" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z"/></svg>
              </span>
            </span>
          </div>
          <div class="work__meta">
            <div>
              <h3>${work.title}</h3>
              <p class="work__meta-en">${work.en}</p>
            </div>
            <div class="work__meta-side">
              <span>${work.categoryEn}</span>
              <span>${work.duration}</span>
            </div>
          </div>
        </button>
      </article>
    `).join('');

    const total = $('#works-total');
    if (total) total.textContent = pad(works.length);

    const filters = $('#filters');
    if (filters) {
      const categories = [{ key: 'all', label: '全部' }];
      const seen = new Set();
      works.forEach((work) => {
        if (!seen.has(work.filter)) {
          seen.add(work.filter);
          categories.push({ key: work.filter, label: work.category });
        }
      });

      filters.innerHTML = categories.map((category, index) => {
        const count = category.key === 'all' ? works.length : works.filter((work) => work.filter === category.key).length;
        return `<button type="button" data-filter="${category.key}" aria-pressed="${index === 0}" data-cursor="">${category.label}<sup>${pad(count)}</sup></button>`;
      }).join('');

      filters.addEventListener('click', (event) => {
        const button = event.target.closest('[data-filter]');
        if (!button) return;
        applyFilter(button.dataset.filter);
      });
    }
  }

  function renderPosts() {
    const grid = $('#journal-grid');
    if (!grid) return;

    grid.innerHTML = posts.map((post, index) => `
      <button class="journal-card" type="button" data-open-post="${index}" data-cursor="READ" data-reveal style="--d:${index * 80}ms" aria-label="阅读手记：${post.title}">
        <span class="journal-card__media">
          <img src="${post.cover}" alt="${post.coverAlt || ''}" loading="lazy" decoding="async">
          <span class="journal-card__index">NOTE ${pad(index + 1)}</span>
        </span>
        <span class="journal-card__meta">
          <span>${post.category}</span>
          <span>${post.date}</span>
          <span>${post.read}</span>
        </span>
        <h3>${post.title}</h3>
        <span class="journal-card__en">${post.en}</span>
        <span class="journal-card__excerpt">${post.excerpt}</span>
        <span class="journal-card__more">阅读全文 <span>↗</span></span>
      </button>
    `).join('');
  }

  /* --------------------------------------------------------------- reveal */
  let revealObserver;

  function initReveal() {
    if (!('IntersectionObserver' in window)) {
      $$('[data-reveal]').forEach((element) => element.classList.add('is-visible'));
      return;
    }

    if (!revealObserver) {
      revealObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        });
      }, { threshold: 0.08, rootMargin: '0px 0px -8% 0px' });
    }

    $$('[data-reveal]:not(.is-visible)').forEach((element) => revealObserver.observe(element));
  }

  /* --------------------------------------------------------------- loader */
  function initLoader() {
    const loader = $('#loader');
    const bar = $('#loader-bar');
    const count = $('#loader-count');
    if (!loader || !bar || !count) {
      body.classList.add('is-ready');
      initReveal();
      return;
    }

    let finished = false;
    const start = performance.now();
    const duration = reducedMotion ? 260 : 1350;

    function tick(now) {
      if (finished) return;
      const progress = clamp((now - start) / duration, 0, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      bar.style.transform = `scaleX(${eased})`;
      count.textContent = pad(Math.round(eased * 100));
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    const finish = () => {
      if (finished) return;
      finished = true;
      bar.style.transform = 'scaleX(1)';
      count.textContent = '100';

      window.setTimeout(() => {
        loader.classList.add('is-done');
        body.classList.add('is-ready');
        initReveal();
        window.setTimeout(() => loader.remove(), 1200);
      }, reducedMotion ? 20 : 280);
    };

    if (document.readyState === 'complete') {
      window.setTimeout(finish, 550);
    } else {
      window.addEventListener('load', () => window.setTimeout(finish, 550), { once: true });
    }
    window.setTimeout(finish, 4200);
  }

  /* --------------------------------------------------------------- theme */
  let heroField = null;

  function initTheme() {
    const toggle = $('#theme-toggle');
    const label = $('#theme-text');
    if (!toggle) return;

    const sync = () => {
      const isDark = root.dataset.theme !== 'paper';
      if (label) label.textContent = isDark ? 'NIGHT' : 'DAY';
      toggle.setAttribute('aria-label', isDark ? '切换到日间模式' : '切换到夜间模式');
      const meta = $('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', isDark ? '#080908' : '#efede4');
      if (heroField) heroField.refresh();
    };

    toggle.addEventListener('click', () => {
      const next = root.dataset.theme === 'paper' ? 'dark' : 'paper';
      root.dataset.theme = next;
      try { localStorage.setItem('lw-theme', next); } catch (error) {}
      sync();
    });

    sync();
  }

  /* --------------------------------------------------------------- cursor */
  function initCursor() {
    if (!finePointer || reducedMotion) return;

    const cursor = $('#cursor');
    if (!cursor) return;
    const dot = $('.cursor__dot', cursor);
    const ring = $('.cursor__ring', cursor);
    const label = $('.cursor__label', cursor);
    if (!dot || !ring || !label) return;

    root.classList.add('has-cursor');

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let ringX = mouseX;
    let ringY = mouseY;
    let visible = false;

    const render = () => {
      ringX += (mouseX - ringX) * 0.18;
      ringY += (mouseY - ringY) * 0.18;
      dot.style.transform = `translate(${mouseX}px, ${mouseY}px) translate(-50%, -50%)`;
      ring.style.transform = `translate(${ringX}px, ${ringY}px) translate(-50%, -50%)`;
      requestAnimationFrame(render);
    };
    requestAnimationFrame(render);

    window.addEventListener('pointermove', (event) => {
      mouseX = event.clientX;
      mouseY = event.clientY;
      if (!visible) {
        visible = true;
        cursor.classList.add('is-visible');
      }
    }, { passive: true });

    document.addEventListener('pointerleave', () => {
      cursor.classList.remove('is-visible');
      visible = false;
    });

    document.addEventListener('pointerover', (event) => {
      const custom = event.target.closest('[data-cursor]');
      if (custom && custom.getAttribute('data-cursor')) {
        cursor.classList.add('is-active');
        cursor.classList.remove('is-link');
        label.textContent = custom.getAttribute('data-cursor');
        return;
      }
      cursor.classList.remove('is-active');
      label.textContent = '';
      const interactive = event.target.closest('a, button, input, textarea, select');
      cursor.classList.toggle('is-link', Boolean(interactive));
    });
  }

  /* --------------------------------------------------------------- magnets */
  function initMagnets() {
    if (!finePointer || reducedMotion) return;

    $$('.magnetic').forEach((element) => {
      let bounds = null;
      element.addEventListener('pointerenter', () => {
        bounds = element.getBoundingClientRect();
        element.style.transition = 'translate 0.18s ease-out';
      });
      element.addEventListener('pointermove', (event) => {
        if (!bounds) return;
        const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 12;
        const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 12;
        element.style.translate = `${x.toFixed(2)}px ${y.toFixed(2)}px`;
      });
      element.addEventListener('pointerleave', () => {
        bounds = null;
        element.style.transition = 'translate 0.55s cubic-bezier(.22,1,.36,1)';
        element.style.translate = '0px 0px';
      });
    });
  }

  /* --------------------------------------------------------------- hero field */
  function initHeroField() {
    const hero = $('.hero');
    const canvas = $('#hero-canvas');
    if (!hero || !canvas) return null;

    const context = canvas.getContext('2d');
    if (!context) return null;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let particles = [];
    let bursts = [];
    let raf = 0;
    let isVisible = true;
    let lastTime = performance.now();
    const mouse = { x: 0, y: 0, active: false };

    const palette = () => root.dataset.theme === 'paper'
      ? ['#4c6700', '#d94216', '#11120f', '#5d3dbd']
      : ['#d7ff3c', '#ff5a2e', '#efeee6', '#a68cff'];

    function createParticle() {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.08 + Math.random() * 0.28;
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: 0.55 + Math.random() * 1.55,
        color: Math.floor(Math.random() * 4),
        trail: [],
        phase: Math.random() * Math.PI * 2
      };
    }

    function seed() {
      const density = width < 640 ? 18000 : 12500;
      const count = clamp(Math.round((width * height) / density), 34, 130);
      particles = Array.from({ length: count }, createParticle);
      bursts = [];
    }

    function resize() {
      const rect = hero.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    }

    function burst(x, y) {
      for (let i = 0; i < 26; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.9 + Math.random() * 3.1;
        bursts.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          r: 0.6 + Math.random() * 1.8,
          color: Math.floor(Math.random() * 4)
        });
      }
      bursts = bursts.slice(-160);
    }

    function draw(timestamp) {
      const delta = clamp((timestamp - lastTime) / 16.6667, 0.5, 2);
      lastTime = timestamp;
      const colors = palette();
      const isPaper = root.dataset.theme === 'paper';
      context.clearRect(0, 0, width, height);
      context.globalCompositeOperation = isPaper ? 'source-over' : 'lighter';

      if (mouse.active && !isPaper) {
        const glow = context.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 180);
        glow.addColorStop(0, 'rgba(215,255,60,0.055)');
        glow.addColorStop(1, 'rgba(215,255,60,0)');
        context.fillStyle = glow;
        context.fillRect(mouse.x - 180, mouse.y - 180, 360, 360);
      }

      for (const particle of particles) {
        const flow = Math.sin(particle.x * 0.0038 + timestamp * 0.00018) * Math.PI
          + Math.cos(particle.y * 0.0042 - timestamp * 0.00014) * Math.PI;
        particle.vx += Math.cos(flow) * 0.017 * delta;
        particle.vy += Math.sin(flow) * 0.017 * delta;

        if (mouse.active) {
          const dx = particle.x - mouse.x;
          const dy = particle.y - mouse.y;
          const distance = Math.hypot(dx, dy) || 1;
          if (distance < 190) {
            const force = (1 - distance / 190) * 0.11;
            particle.vx += (dx / distance) * force * delta;
            particle.vy += (dy / distance) * force * delta;
          }
        }

        particle.vx *= 0.985;
        particle.vy *= 0.985;
        const maxSpeed = 0.9;
        const speed = Math.hypot(particle.vx, particle.vy);
        if (speed > maxSpeed) {
          particle.vx = (particle.vx / speed) * maxSpeed;
          particle.vy = (particle.vy / speed) * maxSpeed;
        }

        particle.x += particle.vx * delta;
        particle.y += particle.vy * delta;

        if (particle.x < -20) particle.x = width + 20;
        if (particle.x > width + 20) particle.x = -20;
        if (particle.y < -20) particle.y = height + 20;
        if (particle.y > height + 20) particle.y = -20;

        particle.trail.unshift({ x: particle.x, y: particle.y });
        if (particle.trail.length > 7) particle.trail.pop();

        for (let index = 1; index < particle.trail.length; index++) {
          const from = particle.trail[index - 1];
          const to = particle.trail[index];
          const alpha = (isPaper ? 0.2 : 0.26) * (1 - index / particle.trail.length);
          context.beginPath();
          context.moveTo(from.x, from.y);
          context.lineTo(to.x, to.y);
          context.strokeStyle = colors[particle.color];
          context.globalAlpha = alpha;
          context.lineWidth = particle.r * (1 - index / (particle.trail.length + 2));
          context.stroke();
        }

        context.globalAlpha = isPaper ? 0.62 : 0.78;
        context.fillStyle = colors[particle.color];
        context.beginPath();
        context.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
        context.fill();
      }

      for (const spark of bursts) {
        spark.x += spark.vx * delta;
        spark.y += spark.vy * delta;
        spark.vx *= 0.972;
        spark.vy *= 0.972;
        spark.life *= 0.965;
        context.globalAlpha = Math.max(0, spark.life) * 0.7;
        context.fillStyle = colors[spark.color];
        context.beginPath();
        context.arc(spark.x, spark.y, spark.r * spark.life + 0.2, 0, Math.PI * 2);
        context.fill();
      }
      bursts = bursts.filter((spark) => spark.life > 0.03);
      context.globalAlpha = 1;
      context.globalCompositeOperation = 'source-over';

      if (isVisible && !document.hidden) raf = requestAnimationFrame(draw);
    }

    function start() {
      cancelAnimationFrame(raf);
      lastTime = performance.now();
      if (!reducedMotion) raf = requestAnimationFrame(draw);
      else draw(performance.now());
    }

    hero.addEventListener('pointermove', (event) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = event.clientX - rect.left;
      mouse.y = event.clientY - rect.top;
      mouse.active = true;
    }, { passive: true });
    hero.addEventListener('pointerleave', () => { mouse.active = false; });
    hero.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'touch') return;
      const rect = canvas.getBoundingClientRect();
      burst(event.clientX - rect.left, event.clientY - rect.top);
    }, { passive: true });

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        isVisible = entries[0].isIntersecting;
        if (isVisible) start();
        else cancelAnimationFrame(raf);
      }, { threshold: 0.02 });
      observer.observe(hero);
    }

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else if (isVisible) start();
    });

    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resize();
        start();
      }, 180);
    });

    resize();
    start();

    return {
      refresh() {
        seed();
        if (reducedMotion) draw(performance.now());
      }
    };
  }

  /* --------------------------------------------------------------- ambient videos */
  const ambientState = new WeakMap();

  function initAmbientVideos() {
    const videos = $$('.ambient-video, #hero-video');
    if (!videos.length) return;

    videos.forEach((video) => {
      video.muted = true;
      video.playsInline = true;
      ambientState.set(video, false);
      if (reducedMotion) {
        video.pause();
        return;
      }

      if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
          const visible = entries[0].isIntersecting;
          ambientState.set(video, visible);
          if (visible && !body.classList.contains('has-modal') && !body.classList.contains('menu-open')) {
            video.play().catch(() => {});
          } else {
            video.pause();
          }
        }, { threshold: 0.08 });
        observer.observe(video);
      } else {
        ambientState.set(video, true);
        video.play().catch(() => {});
      }
    });
  }

  function pauseAmbientVideos() {
    $$('.ambient-video, #hero-video, .work__video, #work-modal-video').forEach((video) => {
      video.pause();
    });
  }

  function resumeAmbientVideos() {
    if (reducedMotion) return;
    $$('.ambient-video, #hero-video').forEach((video) => {
      if (ambientState.get(video)) video.play().catch(() => {});
    });
  }

  /* --------------------------------------------------------------- filters */
  let activeFilter = 'all';

  function applyFilter(key) {
    activeFilter = key;
    const grid = $('#works-grid');
    const counter = $('#works-visible');
    if (!grid) return;

    $$('[data-filter]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.filter === key));
    });

    const isFiltered = key !== 'all';
    grid.classList.toggle('is-filtered', isFiltered);
    let visibleCount = 0;

    $$('.work', grid).forEach((card, index) => {
      const work = works[index];
      const matches = !isFiltered || (work && work.filter === key);
      clearTimeout(card._hideTimer);

      if (matches) {
        visibleCount++;
        card.hidden = false;
        card.removeAttribute('aria-hidden');
        requestAnimationFrame(() => {
          requestAnimationFrame(() => card.classList.remove('is-hidden'));
        });
      } else {
        $('.work__video', card)?.pause();
        card.classList.add('is-hidden');
        card.setAttribute('aria-hidden', 'true');
        card._hideTimer = setTimeout(() => {
          if (activeFilter === key) card.hidden = true;
        }, 360);
      }
    });

    grid.classList.toggle('is-single', visibleCount === 1);
    grid.dataset.count = String(visibleCount);
    if (counter) counter.textContent = pad(visibleCount);
  }

  /* --------------------------------------------------------------- work cards */
  function initWorkCards() {
    $$('.work').forEach((card) => {
      const video = $('.work__video', card);
      const media = $('.work__media', card);

      if (video) {
        if (!video.getAttribute('src')) video.src = video.dataset.src;

        card.addEventListener('pointerenter', (event) => {
          if (!finePointer || event.pointerType === 'touch' || body.classList.contains('has-modal')) return;
          video.play().catch(() => {});
        });
        card.addEventListener('pointerleave', () => {
          video.pause();
        });
      }

      if (media && finePointer && !reducedMotion) {
        card.addEventListener('pointermove', (event) => {
          const rect = media.getBoundingClientRect();
          const x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
          const y = clamp((event.clientY - rect.top) / rect.height, 0, 1);
          media.style.setProperty('--rx', `${((0.5 - y) * 3.4).toFixed(2)}deg`);
          media.style.setProperty('--ry', `${((x - 0.5) * 3.4).toFixed(2)}deg`);
        });
        card.addEventListener('pointerleave', () => {
          media.style.setProperty('--rx', '0deg');
          media.style.setProperty('--ry', '0deg');
        });
      }
    });
  }

  /* --------------------------------------------------------------- work modal */
  let currentWork = 0;

  function fillWorkModal(index) {
    const work = works[index];
    if (!work) return;

    currentWork = index;
    const video = $('#work-modal-video');
    const title = $('#work-modal-title');
    const en = $('#work-modal-en');
    const desc = $('#work-modal-desc');
    const category = $('#work-modal-category');
    const year = $('#work-modal-year');
    const meta = $('#work-modal-meta');
    const indexLabel = $('#work-modal-index');
    const position = $('#work-position');

    if (title) title.textContent = work.title;
    if (en) en.textContent = work.en;
    if (desc) desc.textContent = work.desc;
    if (category) category.textContent = work.categoryEn;
    if (year) year.textContent = work.year;
    if (indexLabel) indexLabel.textContent = `${pad(index + 1)} / ${pad(works.length)}`;
    if (position) position.textContent = `${pad(index + 1)} / ${pad(works.length)}`;
    if (meta) {
      meta.innerHTML = work.meta.map(([key, value]) => `<div><dt>${key}</dt><dd>${value}</dd></div>`).join('');
    }
    if (video) {
      video.pause();
      video.poster = work.poster;
      video.src = work.video;
      video.load();
    }
  }

  function playWorkModalVideo() {
    const video = $('#work-modal-video');
    if (!video) return;
    video.muted = false;
    video.volume = 0.72;
    const attempt = video.play();
    if (attempt && typeof attempt.catch === 'function') {
      attempt.catch(() => {
        video.muted = true;
        video.play().catch(() => {});
      });
    }
  }

  function initWorkModal() {
    const modal = $('#work-modal');
    if (!modal) return;
    const closeButton = $('[data-close-work]', modal);

    const open = (index) => {
      if (!works.length) return;
      pauseAmbientVideos();
      $$('.work__video').forEach((video) => video.pause());
      fillWorkModal(index);
      if (!modal.open) {
        modal.showModal();
        body.classList.add('has-modal');
      }
      playWorkModalVideo();
      if (closeButton) window.setTimeout(() => closeButton.focus({ preventScroll: true }), 60);
    };

    const close = () => {
      if (modal.open) modal.close();
    };

    document.addEventListener('click', (event) => {
      const trigger = event.target.closest('[data-open-work]');
      if (!trigger) return;
      event.preventDefault();
      open(Number(trigger.dataset.openWork));
    });

    if (closeButton) closeButton.addEventListener('click', close);

    modal.addEventListener('click', (event) => {
      if (event.target === modal) close();
    });

    modal.addEventListener('close', () => {
      const video = $('#work-modal-video');
      if (video) {
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
      body.classList.remove('has-modal');
      resumeAmbientVideos();
    });

    $('#prev-work')?.addEventListener('click', () => {
      const next = (currentWork - 1 + works.length) % works.length;
      fillWorkModal(next);
      playWorkModalVideo();
    });
    $('#next-work')?.addEventListener('click', () => {
      const next = (currentWork + 1) % works.length;
      fillWorkModal(next);
      playWorkModalVideo();
    });

    modal.addEventListener('keydown', (event) => {
      if (event.target.closest('video')) return;
      if (event.key === 'ArrowLeft') {
        $('#prev-work')?.click();
      } else if (event.key === 'ArrowRight') {
        $('#next-work')?.click();
      }
    });
  }

  /* --------------------------------------------------------------- reader */
  function initReader() {
    const modal = $('#reader-modal');
    if (!modal) return;
    const scrollArea = $('#reader-scroll');
    const progressBar = $('#reader-progress-bar');
    const closeButton = $('[data-close-reader]', modal);

    const updateProgress = () => {
      if (!scrollArea || !progressBar) return;
      const max = scrollArea.scrollHeight - scrollArea.clientHeight;
      const ratio = max > 0 ? scrollArea.scrollTop / max : 0;
      progressBar.style.transform = `scaleX(${clamp(ratio, 0, 1)})`;
    };

    const open = (index) => {
      const post = posts[index];
      if (!post) return;

      pauseAmbientVideos();
      $$('.work__video').forEach((video) => video.pause());

      const title = $('#reader-title');
      const en = $('#reader-en');
      const bodyContent = $('#reader-body');
      const category = $('#reader-category');
      const date = $('#reader-date');
      const read = $('#reader-read');
      const cover = $('#reader-cover');

      if (title) title.textContent = post.title;
      if (en) en.textContent = post.en;
      if (bodyContent) bodyContent.innerHTML = post.body;
      if (category) category.textContent = post.category;
      if (date) date.textContent = post.date;
      if (read) read.textContent = post.read;
      if (cover) {
        cover.src = post.cover;
        cover.alt = post.coverAlt || '';
      }

      if (!modal.open) modal.showModal();
      if (scrollArea) scrollArea.scrollTop = 0;
      if (progressBar) progressBar.style.transform = 'scaleX(0)';
      window.requestAnimationFrame(() => {
        if (scrollArea) scrollArea.scrollTop = 0;
        updateProgress();
      });

      body.classList.add('has-modal');
      if (closeButton) window.setTimeout(() => closeButton.focus({ preventScroll: true }), 60);
    };

    const close = () => {
      if (modal.open) modal.close();
    };

    document.addEventListener('click', (event) => {
      const trigger = event.target.closest('[data-open-post]');
      if (!trigger) return;
      event.preventDefault();
      open(Number(trigger.dataset.openPost));
    });

    if (closeButton) closeButton.addEventListener('click', close);
    modal.addEventListener('click', (event) => {
      if (event.target === modal) close();
    });
    scrollArea?.addEventListener('scroll', updateProgress, { passive: true });

    modal.addEventListener('close', () => {
      body.classList.remove('has-modal');
      resumeAmbientVideos();
    });
  }

  /* --------------------------------------------------------------- mobile menu */
  function initMenu() {
    const toggle = $('#menu-toggle');
    const menu = $('#mobile-menu');
    const main = $('#main');
    const footer = $('.footer');
    if (!toggle || !menu) return;
    let isOpen = false;

    const setOpen = (next, returnFocus = false) => {
      isOpen = next;
      toggle.setAttribute('aria-expanded', String(next));
      toggle.setAttribute('aria-label', next ? '关闭菜单' : '打开菜单');
      menu.classList.toggle('is-open', next);
      menu.setAttribute('aria-hidden', String(!next));
      body.classList.toggle('menu-open', next);
      if (main) main.inert = next;
      if (footer) footer.inert = next;

      if (next) {
        pauseAmbientVideos();
        $('#site-header')?.classList.remove('is-paper');
        const first = $('a', menu);
        if (first) window.setTimeout(() => first.focus({ preventScroll: true }), 450);
      } else {
        resumeAmbientVideos();
        window.dispatchEvent(new Event('scroll'));
        if (returnFocus) toggle.focus({ preventScroll: true });
      }
    };

    toggle.addEventListener('click', () => setOpen(!isOpen));

    $$('[data-menu-link]', menu).forEach((link) => {
      link.addEventListener('click', () => setOpen(false));
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && isOpen) setOpen(false, true);
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 1080 && isOpen) setOpen(false);
    });
  }

  /* --------------------------------------------------------------- sound */
  function initSound() {
    const button = $('#sound-toggle');
    if (!button) return;
    const label = $('.sound-toggle__text', button);
    let audio = null;
    let master = null;
    let playing = false;

    const build = () => {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      audio = new AudioContext();
      master = audio.createGain();
      master.gain.value = 0;
      master.connect(audio.destination);

      const filter = audio.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      filter.Q.value = 0.7;
      filter.connect(master);

      [55, 82.41, 110].forEach((frequency, index) => {
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        oscillator.type = index === 2 ? 'triangle' : 'sine';
        oscillator.frequency.value = frequency;
        oscillator.detune.value = index * 3 - 3;
        gain.gain.value = index === 0 ? 0.48 : 0.11;
        oscillator.connect(gain);
        gain.connect(filter);
        oscillator.start();
      });

      const lfo = audio.createOscillator();
      const lfoGain = audio.createGain();
      lfo.frequency.value = 0.07;
      lfoGain.gain.value = 90;
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      lfo.start();

      return true;
    };

    button.addEventListener('click', async () => {
      if (!audio && !build()) return;
      try { await audio.resume(); } catch (error) {}
      playing = !playing;
      const now = audio.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setTargetAtTime(playing ? 0.045 : 0, now, 0.35);
      button.setAttribute('aria-pressed', String(playing));
      button.setAttribute('aria-label', playing ? '关闭环境声音' : '开启环境声音');
      if (label) label.textContent = playing ? 'SOUND ON' : 'SOUND OFF';
    });
  }

  /* --------------------------------------------------------------- copy email */
  function showToast(message) {
    const toast = $('#toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => toast.classList.remove('is-visible'), 2600);
  }

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (error) {}
    }
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (error) { ok = false; }
    area.remove();
    return ok;
  }

  function initCopyEmail() {
    const button = $('#copy-mail');
    if (!button) return;
    const email = (SITE.profile && SITE.profile.email) || 'hello@linwei.studio';
    const original = button.innerHTML;

    button.addEventListener('click', async () => {
      const ok = await copyText(email);
      showToast(ok ? '邮箱已复制：' + email : '无法自动复制，请手动选择：' + email);
      button.innerHTML = ok ? '已复制 <span>✓</span>' : '复制失败 <span>!</span>';
      window.setTimeout(() => { button.innerHTML = original; }, 2200);
    });
  }

  /* --------------------------------------------------------------- scroll UI */
  function initScrollUI() {
    const header = $('#site-header');
    const progress = $('#scroll-progress-bar');
    const navLinks = $$('.main-nav a');
    const sectionIds = ['works', 'about', 'journal', 'contact'];
    let ticking = false;

    const update = () => {
      const scrollY = window.scrollY || window.pageYOffset;
      if (header) {
        header.classList.toggle('is-scrolled', scrollY > 24);
        const about = document.getElementById('about');
        const headerHeight = header.offsetHeight || 78;
        const overPaper = about
          && scrollY + headerHeight >= about.offsetTop
          && scrollY + headerHeight < about.offsetTop + about.offsetHeight;
        header.classList.toggle('is-paper', Boolean(overPaper) && !body.classList.contains('menu-open'));
      }

      if (progress) {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        progress.style.transform = `scaleX(${max > 0 ? clamp(scrollY / max, 0, 1) : 0})`;
      }

      const marker = scrollY + window.innerHeight * 0.34;
      let active = '';
      sectionIds.forEach((id) => {
        const section = document.getElementById(id);
        if (section && section.offsetTop <= marker) active = id;
      });
      navLinks.forEach((link) => link.classList.toggle('is-active', link.dataset.nav === active));

      ticking = false;
    };

    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }, { passive: true });

    window.addEventListener('resize', update);
    update();
  }

  /* --------------------------------------------------------------- clock */
  function initClock() {
    const clocks = $$('[data-clock]');
    if (!clocks.length) return;

    const update = () => {
      let value = '';
      try {
        value = new Intl.DateTimeFormat('zh-CN', {
          timeZone: 'Asia/Shanghai',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }).format(new Date());
      } catch (error) {
        value = new Date().toTimeString().slice(0, 5);
      }
      clocks.forEach((clock) => { clock.textContent = value; });
    };

    update();
    window.setInterval(update, 30000);
  }

  /* --------------------------------------------------------------- misc */
  function initMisc() {
    const year = $('#year');
    if (year) year.textContent = String(new Date().getFullYear());

    $$('a[href^="#"]').forEach((link) => {
      link.addEventListener('click', (event) => {
        const id = link.getAttribute('href');
        if (!id || id === '#') return;
        const target = document.querySelector(id);
        if (!target) return;
        event.preventDefault();
        target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
        try { history.replaceState(null, '', id); } catch (error) {}
      });
    });
  }

  /* --------------------------------------------------------------- boot */
  function boot() {
    renderWorks();
    renderPosts();
    initTheme();
    heroField = initHeroField();
    initCursor();
    initMagnets();
    initAmbientVideos();
    initWorkCards();
    initWorkModal();
    initReader();
    initMenu();
    initSound();
    initCopyEmail();
    initScrollUI();
    initClock();
    initMisc();
    initLoader();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
