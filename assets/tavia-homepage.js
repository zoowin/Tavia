if (!window.taviaHomepageInitialized) {
  window.taviaHomepageInitialized = true;

  const updateSliderState = (section) => {
    const rail = section.querySelector('[data-tavia-slider-rail]');
    const previousButton = section.querySelector('[data-tavia-slider-button="previous"]');
    const nextButton = section.querySelector('[data-tavia-slider-button="next"]');

    if (!rail) return;

    const hasOverflow = rail.scrollWidth > rail.clientWidth + 1;
    const atStart = rail.scrollLeft <= 1;
    const atEnd = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 1;

    section.classList.toggle('tavia-products--scrollable', hasOverflow);

    if (previousButton) previousButton.disabled = !hasOverflow || atStart;
    if (nextButton) nextButton.disabled = !hasOverflow || atEnd;
  };

  const initializeSliders = () => {
    document.querySelectorAll('[data-tavia-slider]').forEach((section) => {
      const rail = section.querySelector('[data-tavia-slider-rail]');

      updateSliderState(section);

      if (rail && !rail.dataset.taviaSliderInitialized) {
        rail.dataset.taviaSliderInitialized = 'true';
        rail.addEventListener('scroll', () => updateSliderState(section), { passive: true });
      }
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSliders, { once: true });
  } else {
    initializeSliders();
  }

  window.addEventListener('resize', () => {
    document.querySelectorAll('[data-tavia-slider]').forEach(updateSliderState);
  });

  document.addEventListener('shopify:section:load', initializeSliders);

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-tavia-slider-button]');

    if (!button) return;

    const section = button.closest('[data-tavia-slider]');
    const rail = section?.querySelector('[data-tavia-slider-rail]');

    if (!rail) return;

    const direction = button.dataset.taviaSliderButton === 'previous' ? -1 : 1;
    const card = rail.querySelector('.tavia-product-card');
    const gap = parseFloat(window.getComputedStyle(rail).columnGap) || 0;
    const distance = card ? card.getBoundingClientRect().width + gap : rail.clientWidth * 0.85;

    rail.scrollBy({ left: direction * distance, behavior: 'smooth' });
  });
}
