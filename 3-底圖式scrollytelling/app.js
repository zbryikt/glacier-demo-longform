document.addEventListener('DOMContentLoaded', () => {
  const afterWrapper = document.getElementById('afterWrapper');
  const sliderHandle = document.getElementById('sliderHandle');
  const progressBarFill = document.getElementById('progressBarFill');
  const narrativeCards = document.querySelectorAll('.narrative-card');

  function onScroll() {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;

    if (scrollHeight <= 0) return;

    const progress = Math.max(0, Math.min(1, scrollTop / scrollHeight));
    const barPosPercent = (1 - progress) * 100;

    afterWrapper.style.clipPath = `inset(${barPosPercent}% 0 0 0)`;
    sliderHandle.style.top = `${barPosPercent}%`;

    progressBarFill.style.width = `${Math.round(progress * 100)}%`;
  }

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        onScroll();
        ticking = false;
      });
      ticking = true;
    }
  });

  const observerOptions = {
    root: null,
    rootMargin: '-35% 0px -40% 0px',
    threshold: 0.15
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        narrativeCards.forEach((card) => card.classList.remove('active'));
        entry.target.classList.add('active');
      }
    });
  }, observerOptions);

  narrativeCards.forEach((card) => observer.observe(card));

  onScroll();
});
