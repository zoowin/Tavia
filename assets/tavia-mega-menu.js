(() => {
  if (customElements.get('tavia-mega-menu-controller')) return;

  class TaviaMegaMenuController extends HTMLElement {
    connectedCallback() {
      this.navigation = this.closest('nav');
      if (!this.navigation) return;
      this.abortController = new AbortController();
      this.timers = new Set();
      this.hoverQuery = window.matchMedia('(min-width: 990px) and (hover: hover) and (pointer: fine)');
      this.menus = [...this.navigation.querySelectorAll('header-menu > details.mega-menu')];
      const options = { signal: this.abortController.signal };

      this.menus.forEach((details) => {
        const host = details.parentElement;
        const summary = details.querySelector(':scope > summary');
        let enterTimer;
        let leaveTimer;

        host.addEventListener('pointerenter', (event) => {
          this.cancelTimer(leaveTimer);
          if (!this.hoverQuery.matches || event.pointerType === 'touch') return;
          this.cancelTimer(enterTimer);
          enterTimer = this.schedule(() => this.open(details), 120);
        }, options);

        host.addEventListener('pointerleave', (event) => {
          this.cancelTimer(enterTimer);
          if (!this.hoverQuery.matches || event.pointerType === 'touch') return;
          this.cancelTimer(leaveTimer);
          leaveTimer = this.schedule(() => {
            if (!details.contains(document.activeElement)) this.close(details);
          }, 240);
        }, options);

        details.addEventListener('focusin', () => {
          this.cancelTimer(leaveTimer);
        }, options);

        details.addEventListener('toggle', () => {
          summary.setAttribute('aria-expanded', String(details.open));
          if (details.open) this.closeOthers(details);
        }, options);

        details.addEventListener('keydown', (event) => {
          if (event.key === 'Escape' && details.open) {
            event.preventDefault();
            this.clearTimers();
            this.close(details);
            summary.focus();
          } else if (event.key === 'ArrowDown' && event.target === summary) {
            event.preventDefault();
            this.clearTimers();
            this.open(details);
            details.querySelector('a[href]')?.focus();
          }
        }, options);
      });

      document.addEventListener('pointerdown', (event) => {
        if (!this.navigation.contains(event.target)) this.closeOthers();
      }, options);

      this.hoverQuery.addEventListener('change', () => {
        this.clearTimers();
        this.closeOthers();
      }, options);
    }

    open(details) {
      this.closeOthers(details);
      details.open = true;
      details.querySelector(':scope > summary').setAttribute('aria-expanded', 'true');
    }

    close(details) {
      details.open = false;
      details.querySelector(':scope > summary').setAttribute('aria-expanded', 'false');
    }

    closeOthers(except) {
      this.menus.forEach((details) => {
        if (details !== except && details.open) this.close(details);
      });
    }

    schedule(callback, delay) {
      const timer = window.setTimeout(() => {
        this.timers.delete(timer);
        callback();
      }, delay);
      this.timers.add(timer);
      return timer;
    }

    cancelTimer(timer) {
      window.clearTimeout(timer);
      this.timers.delete(timer);
    }

    clearTimers() {
      this.timers?.forEach((timer) => window.clearTimeout(timer));
      this.timers?.clear();
    }

    disconnectedCallback() {
      this.abortController?.abort();
      this.clearTimers();
    }
  }

  customElements.define('tavia-mega-menu-controller', TaviaMegaMenuController);
})();
