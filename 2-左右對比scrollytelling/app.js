document.addEventListener('DOMContentLoaded', () => {
  const scrollytellingContainer = document.getElementById('scrollytellingContainer');
  const narrativeSteps = document.querySelectorAll('.narrative-step');
  const afterWrapper = document.getElementById('afterWrapper');
  const sliderHandle = document.getElementById('sliderHandle');
  const progressBarFill = document.getElementById('progressBarFill');

  function updateRevealProgress(progress) {
    const clampedProgress = Math.max(0, Math.min(1, progress));
    const barPosPercent = (1 - clampedProgress) * 100;

    afterWrapper.style.clipPath = `inset(${barPosPercent}% 0 0 0)`;
    sliderHandle.style.top = `${barPosPercent}%`;

    progressBarFill.style.width = `${Math.round(clampedProgress * 100)}%`;
  }

  function onScroll() {
    const containerRect = scrollytellingContainer.getBoundingClientRect();
    const windowHeight = window.innerHeight;

    const startY = containerRect.top;
    const totalScrollableHeight = containerRect.height - windowHeight * 0.6;

    if (totalScrollableHeight <= 0) return;

    const scrolled = -startY + (windowHeight * 0.15);
    const progress = scrolled / totalScrollableHeight;

    updateRevealProgress(progress);
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
    rootMargin: '-30% 0px -40% 0px',
    threshold: 0.1
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        narrativeSteps.forEach((step) => step.classList.remove('active'));
        entry.target.classList.add('active');
      }
    });
  }, observerOptions);

  narrativeSteps.forEach((step) => observer.observe(step));

  onScroll();
});
