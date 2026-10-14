// ============================================================
// Kancelaria Wnętrzak — v2 · interactions (polished)
// ============================================================

// ---------- Mobile nav ----------
const burger = document.getElementById('burger');
const mobileMenu = document.getElementById('mobileMenu');
burger.addEventListener('click', () => {
  const open = burger.classList.toggle('open');
  mobileMenu.classList.toggle('open', open);
});
mobileMenu.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', () => {
    burger.classList.remove('open');
    mobileMenu.classList.remove('open');
  });
});

// ---------- Nav hide/show on scroll direction ----------
let lastY = 0;
const nav = document.getElementById('nav');
const progressFill = document.getElementById('progressFill');
const sideRail = document.getElementById('sideRail');

// ---------- Split-text (word-by-word reveal) ----------
document.querySelectorAll('[data-split]').forEach(el => {
  // Walk through child nodes preserving <br>, <em>, <sup> etc.
  const walk = (node) => {
    const out = [];
    node.childNodes.forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent;
        const parts = text.split(/(\s+)/);
        parts.forEach(part => {
          if (part.trim() === '' && part.length > 0) {
            out.push(document.createTextNode(part));
          } else if (part.length > 0) {
            const wrap = document.createElement('span');
            wrap.className = 'split-word';
            const inner = document.createElement('span');
            inner.textContent = part;
            wrap.appendChild(inner);
            out.push(wrap);
          }
        });
      } else if (child.nodeName === 'BR') {
        out.push(child.cloneNode(true));
      } else if (child.nodeName === 'EM' || child.nodeName === 'I') {
        const em = document.createElement(child.nodeName.toLowerCase());
        walk(child).forEach(n => em.appendChild(n));
        out.push(em);
      } else {
        // Keep other elements (like <sup>, <span class="display__line">) intact but process inside
        const clone = child.cloneNode(false);
        walk(child).forEach(n => clone.appendChild(n));
        out.push(clone);
      }
    });
    return out;
  };

  const newNodes = walk(el);
  el.innerHTML = '';
  newNodes.forEach(n => el.appendChild(n));
});

// ---------- Reveal observer ----------
// Auto-add data-reveal to secondary elements
document.querySelectorAll('.bento__card, .contact__item, .contact__figure, .about__figure, .section-head, .hero__lead, .hero__actions, .hero__sub, .about__copy p, .motto__translation').forEach((el, i) => {
  if (!el.hasAttribute('data-reveal') && !el.hasAttribute('data-split')) {
    el.setAttribute('data-reveal', '');
    el.style.transitionDelay = `${(i % 6) * 60}ms`;
  }
});

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });

document.querySelectorAll('[data-reveal], [data-split]').forEach(el => revealObserver.observe(el));

// ---------- Magnetic buttons ----------
document.querySelectorAll('[data-magnetic]').forEach(el => {
  const strength = 0.22;
  el.addEventListener('mousemove', (e) => {
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left - r.width / 2;
    const y = e.clientY - r.top - r.height / 2;
    el.style.transform = `translate(${x * strength}px, ${y * strength}px)`;
  });
  el.addEventListener('mouseleave', () => {
    el.style.transform = '';
  });
});

// ---------- Bento radial-mouse tracking ----------
document.querySelectorAll('.bento__card').forEach(card => {
  card.addEventListener('mousemove', (e) => {
    const r = card.getBoundingClientRect();
    const mx = ((e.clientX - r.left) / r.width) * 100;
    const my = ((e.clientY - r.top) / r.height) * 100;
    card.style.setProperty('--mx', `${mx}%`);
    card.style.setProperty('--my', `${my}%`);
  });
});

// ---------- Parallax on hero figure (subtle) ----------
const heroFigure = document.querySelector('.hero__figure-wrap img');
const canParallax = heroFigure && window.matchMedia('(min-width: 1024px)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- Section spy ----------
const sections = [
  { id: 'top', el: document.getElementById('top') },
  { id: 'o-mnie', el: document.getElementById('o-mnie') },
  { id: 'oferta', el: document.getElementById('oferta') },
  { id: 'kontakt', el: document.getElementById('kontakt') },
];
const navLinks = document.querySelectorAll('.nav__menu a');
const railItems = document.querySelectorAll('.side-rail__items span');

function updateActiveSection() {
  const y = window.scrollY + window.innerHeight * 0.35;
  let current = 'top';
  sections.forEach(s => {
    if (s.el && s.el.offsetTop <= y) current = s.id;
  });

  navLinks.forEach(link => {
    const href = link.getAttribute('href').replace('#', '');
    link.classList.toggle('active', href === current);
  });
  railItems.forEach(item => {
    item.classList.toggle('active', item.dataset.section === current);
  });

  // Switch rail color when over the dark contact section
  const contactEl = document.getElementById('kontakt');
  const footerEl = document.querySelector('.footer');
  if (contactEl && footerEl) {
    const contactTop = contactEl.offsetTop;
    const footerBottom = footerEl.offsetTop + footerEl.offsetHeight;
    const viewportMid = window.scrollY + window.innerHeight / 2;
    sideRail.classList.toggle('on-dark', viewportMid >= contactTop && viewportMid <= footerBottom);
  }
}

// ---------- Unified scroll handler ----------
let ticking = false;
function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    const y = window.scrollY;
    const docH = document.documentElement.scrollHeight - window.innerHeight;

    // Progress bar
    if (progressFill) {
      const pct = Math.min(100, Math.max(0, (y / docH) * 100));
      progressFill.style.width = pct + '%';
    }

    // Nav scrolled state (paper bg + hairline)
    nav.classList.toggle('scrolled', y > 40);

    // Nav over dark section (contact + footer) — invert colors
    const contactEl = document.getElementById('kontakt');
    const footerEl = document.querySelector('.footer');
    if (contactEl && footerEl) {
      const darkTop = contactEl.offsetTop;
      const darkBottom = footerEl.offsetTop + footerEl.offsetHeight;
      const navLine = y + 40; // nav vertical anchor
      nav.classList.toggle('on-dark', navLine >= darkTop && navLine <= darkBottom);
    }

    // Side rail visibility
    if (sideRail) {
      sideRail.classList.toggle('visible', y > 400);
    }

    // Section spy
    updateActiveSection();

    // Parallax
    if (canParallax && y < 800) {
      heroFigure.style.transform = `translateY(${y * 0.08}px) scale(${1 + y * 0.0001})`;
    }

    lastY = y;
    ticking = false;
  });
}

window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', updateActiveSection);
onScroll();

// ---------- Smooth scroll with nav offset ----------
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', (e) => {
    const hash = link.getAttribute('href');
    if (hash.length > 1) {
      const target = document.querySelector(hash);
      if (target) {
        e.preventDefault();
        window.scrollTo({
          top: target.offsetTop - 40,
          behavior: 'smooth'
        });
      }
    }
  });
});
