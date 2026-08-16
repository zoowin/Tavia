if (!window.taviaHomepageInitialized) {
  window.taviaHomepageInitialized = true;

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
