'use strict';

/* ===== Помощники ===== */
const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

/* ===== Прогресс-бар скролла ===== */
const progress = $('#progressBar');
const updateProgress = () => {
  const h = document.documentElement;
  const p = h.scrollTop / (h.scrollHeight - h.clientHeight || 1);
  progress.style.width = (p * 100).toFixed(2) + '%';
};
window.addEventListener('scroll', updateProgress, { passive: true });
updateProgress();

/* ===== Шапка при скролле ===== */
const header = $('.header');
window.addEventListener('scroll', () => {
  header.classList.toggle('scrolled', window.scrollY > 40);
}, { passive: true });

/* ===== Активный пункт меню ===== */
const navLinks = $$('.nav a');
const spySections = navLinks.map(a => $(a.getAttribute('href'))).filter(Boolean);
const spy = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      navLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id));
    }
  });
}, { rootMargin: '-45% 0px -50% 0px' });
spySections.forEach(s => spy.observe(s));

/* ===== Мобильное меню ===== */
const burger = $('#burger');
const nav = $('#nav');
burger.addEventListener('click', () => {
  nav.classList.toggle('open');
  burger.classList.toggle('open');
  document.body.classList.toggle('menu-open');
});
$$('a', nav).forEach(a => a.addEventListener('click', () => {
  nav.classList.remove('open');
  burger.classList.remove('open');
  document.body.classList.remove('menu-open');
}));

/* ===== Появление блоков при скролле + каскадная задержка ===== */
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target;
    const parent = el.parentElement;
    if (parent && parent.querySelectorAll(':scope > .reveal').length > 1) {
      const idx = [...parent.children].indexOf(el);
      el.style.transitionDelay = Math.min(idx * 90, 540) + 'ms';
    }
    el.classList.add('visible');
    const finish = () => {
      el.classList.remove('reveal', 'visible');
      el.style.transitionDelay = '';
      el.removeEventListener('transitionend', finish);
    };
    el.addEventListener('transitionend', finish);
    io.unobserve(el);
  });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
$$('.reveal').forEach(el => io.observe(el));

/* ===== Печатающийся текст в hero ===== */
const phrases = [
  'сделать сайт, который приносит заявки',
  'вывести сайт в топ Яндекса и Google',
  'поднять конверсию интернет-магазина',
  'настроить аналитику и понять, что работает'
];
const typingEl = $('#typing');
if (typingEl) {
  let p = 0, i = 0, deleting = false;
  const tick = () => {
    const word = phrases[p];
    typingEl.textContent = word.slice(0, i);
    let delay = deleting ? 32 : 60;
    if (!deleting && i === word.length) { delay = 2200; deleting = true; }
    else if (deleting && i === 0) { deleting = false; p = (p + 1) % phrases.length; delay = 450; }
    else i += deleting ? -1 : 1;
    setTimeout(tick, delay);
  };
  setTimeout(tick, 1800);
}

/* ===== Анимация счётчиков ===== */
const counterIO = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target;
    const target = parseInt(el.dataset.target, 10);
    const dur = 1400;
    const start = performance.now();
    const step = (now) => {
      const p = Math.min((now - start) / dur, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    counterIO.unobserve(el);
  });
}, { threshold: 0.6 });
$$('.counter').forEach(el => counterIO.observe(el));

/* ===== Фильтр кейсов по табам ===== */
const tabs = $$('.tab');
const works = $$('.work');
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => {
      t.classList.toggle('active', t === tab);
      t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
    });
    const f = tab.dataset.filter;
    works.forEach(work => {
      const show = f === 'all' || work.dataset.category === f;
      work.classList.toggle('hidden', !show);
      if (show) {
        work.classList.remove('work--in');
        void work.offsetWidth; /* перезапуск анимации появления */
        work.classList.add('work--in');
      }
    });
  });
});


/* ===== Слайдер отзывов ===== */
const track = $('#reviewsTrack');
const prevBtn = $('#sliderPrev');
const nextBtn = $('#sliderNext');
const dotsWrap = $('#sliderDots');
if (track && prevBtn && nextBtn && dotsWrap) {
  const slides = $$('.review', track);
  let idx = 0;
  let auto = null;

  const go = (n) => {
    idx = (n + slides.length) % slides.length;
    track.style.transform = 'translateX(' + (-idx * 100) + '%)';
    $$('.slider__dot', dotsWrap).forEach((d, i) => d.classList.toggle('active', i === idx));
  };
  const startAuto = () => { if (!auto) auto = setInterval(() => go(idx + 1), 6000); };
  const stopAuto = () => { clearInterval(auto); auto = null; };

  slides.forEach((s, i) => {
    const d = document.createElement('button');
    d.className = 'slider__dot' + (i === 0 ? ' active' : '');
    d.setAttribute('aria-label', 'Отзыв ' + (i + 1));
    d.addEventListener('click', () => { stopAuto(); go(i); startAuto(); });
    dotsWrap.appendChild(d);
  });

  prevBtn.addEventListener('click', () => { stopAuto(); go(idx - 1); startAuto(); });
  nextBtn.addEventListener('click', () => { stopAuto(); go(idx + 1); startAuto(); });

  const slider = $('#reviewsSlider');
  slider.addEventListener('mouseenter', stopAuto);
  slider.addEventListener('mouseleave', startAuto);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopAuto();
    else startAuto();
  });
  startAuto();
}

/* ===== Tilt-эффект карточек ===== */
if (window.matchMedia('(hover:hover) and (pointer:fine)').matches) {
  $$('.tilt').forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - .5;
      const y = (e.clientY - r.top) / r.height - .5;
      card.style.setProperty('--rx', (y * -7).toFixed(2) + 'deg');
      card.style.setProperty('--ry', (x * 7).toFixed(2) + 'deg');
    });
    card.addEventListener('mouseleave', () => {
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    });
  });
}

/* ===== Форма заявки ===== */
const form = $('#leadForm');
if (form) {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    let ok = true;
    form.querySelectorAll('input[required]').forEach(inp => {
      const valid = inp.value.trim().length >= 2;
      inp.classList.toggle('error', !valid);
      if (!valid) ok = false;
    });
    if (!ok) {
      const firstError = form.querySelector('input.error');
      if (firstError) firstError.focus();
      return;
    }
    const success = $('#formSuccess');
    success.hidden = false;
    form.querySelectorAll('input, textarea, button').forEach(el => el.disabled = true);
    success.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}

