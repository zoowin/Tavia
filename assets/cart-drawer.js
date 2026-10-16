class CartDrawer extends HTMLElement {
  constructor() {
    super();
    this.renderVersion = 0;
    this.addEventListener('keyup', (event) => {
      if (event.code === 'Escape') this.close();
    });
    // Delegation survives Shopify replacing the section contents.
    this.addEventListener('click', (event) => {
      if (event.target.id === 'CartDrawer-Overlay') this.close();
    });
    this.setHeaderCartIconAccessibility();
  }

  setHeaderCartIconAccessibility() {
    const link = document.getElementById('cart-icon-bubble');
    if (!link) return;
    link.setAttribute('role', 'button');
    link.setAttribute('aria-haspopup', 'dialog');
    link.setAttribute('aria-controls', 'CartDrawer');
    link.setAttribute('aria-expanded', 'false');
    link.addEventListener('click', (event) => {
      event.preventDefault();
      this.open(link);
    });
    link.addEventListener('keydown', (event) => {
      if (event.code === 'Space') {
        event.preventDefault();
        this.open(link);
      }
    });
  }

  open(triggeredBy) {
    if (this.classList.contains('active')) return;
    this.setActiveElement(triggeredBy || this.activeElement || document.activeElement);
    this.inert = false;
    this.setAttribute('aria-hidden', 'false');
    this.classList.add('animate', 'active');
    document.body.classList.add('overflow-hidden');
    document.getElementById('cart-icon-bubble')?.setAttribute('aria-expanded', 'true');
    // Do not depend on transitionend: reduced motion may disable transitions.
    requestAnimationFrame(() => {
      if (this.classList.contains('active')) {
        trapFocus(this.querySelector('.drawer__inner'), this.querySelector('.drawer__close'));
      }
    });
    this.querySelector('cart-drawer-items')?.dispatchViewEvent();
  }

  close() {
    if (!this.classList.contains('active')) return;
    this.classList.remove('active');
    const trigger = this.activeElement?.isConnected ? this.activeElement : document.getElementById('cart-icon-bubble');
    removeTrapFocus(trigger);
    this.inert = true;
    this.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('overflow-hidden');
    document.getElementById('cart-icon-bubble')?.setAttribute('aria-expanded', 'false');
  }

  renderContents(parsedState, openDrawer = true) {
    const html = parsedState.sections?.['cart-drawer'];
    const source = html && new DOMParser().parseFromString(html, 'text/html');
    const content = source?.querySelector('#CartDrawer');
    if (!content) {
      // The add may have succeeded even if Shopify could not render a section.
      this.querySelector('cart-drawer-items')?.onCartUpdate(openDrawer);
      return false;
    }
    this.renderVersion += 1;
    this.querySelector('#CartDrawer').innerHTML = content.innerHTML;
    this.classList.toggle('is-empty', !!source.querySelector('cart-drawer.is-empty'));
    const bubbleHTML = parsedState.sections['cart-icon-bubble'];
    const bubble = bubbleHTML && new DOMParser().parseFromString(bubbleHTML, 'text/html').querySelector('.shopify-section');
    if (bubble) document.getElementById('cart-icon-bubble').innerHTML = bubble.innerHTML;
    if (openDrawer && !this.classList.contains('active')) this.open();
    else if (this.classList.contains('active')) {
      trapFocus(this.querySelector('.drawer__inner'), this.querySelector('.drawer__close'));
    }
    return true;
  }

  getSectionInnerHTML(html, selector = '.shopify-section') {
    return new DOMParser().parseFromString(html, 'text/html').querySelector(selector).innerHTML;
  }

  getSectionsToRender() {
    return [{ id: 'cart-drawer', selector: '#CartDrawer' }, { id: 'cart-icon-bubble' }];
  }

  getSectionDOM(html, selector = '.shopify-section') {
    return new DOMParser().parseFromString(html, 'text/html').querySelector(selector);
  }

  setActiveElement(element) {
    this.activeElement = element;
  }
}
customElements.define('cart-drawer', CartDrawer);

class CartDrawerItems extends CartItems {
  constructor() {
    super();
    // Disable checkout immediately, including Dawn's debounced-change window.
    this.addEventListener('change', (event) => {
      if (event.target.matches('.quantity__input')) {
        this.pendingFocusName = document.activeElement?.name;
        this.setBusy(true);
      }
    });
  }

  onChange(event) {
    if (!event.target.matches('.quantity__input')) return;
    const input = event.target;
    const quantity = Number(input.value);
    const minimum = Number(input.dataset.min) || 1;
    const step = Number(input.step) || 1;
    const valid = input.value.trim() !== '' && Number.isInteger(quantity) && quantity >= 0 &&
      (quantity === 0 || (quantity >= minimum && quantity % step === 0)) &&
      (!input.hasAttribute('max') || quantity <= Number(input.max));
    if (!valid) {
      input.value = input.defaultValue;
      this.setBusy(false);
      this.showError(input.dataset.index, window.cartStrings.error);
      return;
    }
    this.updateQuantity(input.dataset.index, quantity, event, document.activeElement?.name, input.dataset.quantityVariantId);
  }

  setBusy(busy) {
    const drawer = this.closest('cart-drawer');
    if (!drawer) return;
    drawer.setAttribute('aria-busy', String(busy));
    const status = drawer.querySelector('[data-cart-status]');
    if (status) {
      status.hidden = !busy;
      status.textContent = busy ? status.dataset.updating : '';
    }
    drawer.querySelectorAll('.quantity__input, .quantity__button, .cart-remove-button, #CartDrawer-Checkout').forEach((control) => {
      if (busy && !control.disabled) {
        control.dataset.cartBusyDisabled = 'true';
        control.disabled = true;
      } else if (!busy && control.dataset.cartBusyDisabled) {
        control.disabled = false;
        delete control.dataset.cartBusyDisabled;
      }
    });
  }

  showError(line, message, uncertain = false) {
    const drawer = document.querySelector('cart-drawer');
    const rowError = drawer.querySelector(`#CartDrawer-LineItemError-${line} .cart-item__error-text`);
    const error = rowError || drawer.querySelector('#CartDrawer-CartErrors');
    if (error) error.textContent = message;
    if (uncertain) {
      const globalError = drawer.querySelector('#CartDrawer-CartErrors');
      globalError.textContent = message + ' ';
      const link = document.createElement('a');
      link.href = routes.cart_url;
      link.textContent = drawer.querySelector('.tavia-cart__secondary a')?.textContent || 'View cart';
      globalError.append(link);
      drawer.querySelector('#CartDrawer-Checkout').disabled = true;
    }
    const status = drawer.querySelector('[data-cart-status]');
    if (status) { status.hidden = false; status.textContent = status.dataset.error; }
  }

  async onCartUpdate(openDrawer = false) {
    const drawer = this.closest('cart-drawer');
    if (!drawer) return false;
    const version = drawer.renderVersion;
    try {
      const response = await fetch(`${routes.cart_url}?sections=cart-drawer,cart-icon-bubble`, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error('Cart refresh failed');
      const sections = await response.json();
      // A bundled add/update response is newer than this background refresh.
      if (drawer.renderVersion !== version) return true;
      if (!sections['cart-drawer'] || !new DOMParser().parseFromString(sections['cart-drawer'], 'text/html').querySelector('#CartDrawer')) throw new Error('Missing cart section');
      drawer.renderContents({ sections }, openDrawer);
      return true;
    } catch (error) {
      if (drawer.renderVersion === version) {
        this.setBusy(false);
        this.showError(null, window.cartStrings.error, true);
        if (openDrawer) drawer.open();
      }
      return false;
    }
  }

  async updateQuantity(line, quantity, event, name, variantId) {
    if (this.mutationPending) return;
    this.mutationPending = true;
    const drawer = this.closest('cart-drawer');
    const input = this.querySelector(`#Drawer-quantity-${line}`);
    const key = input?.dataset.quantityLineKey;
    const focusName = name || this.pendingFocusName || event?.target?.closest('button')?.name;
    this.pendingFocusName = null;
    this.setBusy(true);
    const error = this.querySelector('#CartDrawer-CartErrors');
    if (error) error.textContent = '';
    this.querySelectorAll('.cart-item__error-text').forEach((element) => { element.textContent = ''; });
    const deferred = this.createCartLinesUpdateEvent(quantity === 0 ? 'remove' : 'update', variantId || input?.dataset.quantityVariantId, quantity, key);
    let mutationAccepted = false;
    try {
      const response = await fetch(routes.cart_change_url, {
        ...fetchConfig(),
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({ ...(key ? { id: key } : { line: Number(line) }), quantity, sections: ['cart-drawer', 'cart-icon-bubble'], sections_url: window.location.pathname }),
      });
      const state = await response.json();
      if (!response.ok || state.errors || state.status) {
        const detail = state.errors || state.description || window.cartStrings.error;
        throw Object.assign(new Error(typeof detail === 'string' ? detail : window.cartStrings.error), { invalid: true });
      }
      mutationAccepted = true;
      this.resolveCartLinesUpdate(deferred, state);
      const rendered = state.sections?.['cart-drawer']
        ? drawer.renderContents(state, false)
        : await this.onCartUpdate();
      if (!rendered) throw new Error('Cart changed but could not refresh');
      this.setBusy(false);
      drawer.setAttribute('aria-busy', 'false');
      const status = drawer.querySelector('[data-cart-status]');
      if (status) { status.hidden = false; status.textContent = status.dataset.updated; }
      if (drawer.classList.contains('active')) {
        const updatedInput = [...drawer.querySelectorAll('.quantity__input')].find((element) => element.dataset.quantityLineKey === key);
        const target = quantity > 0 && updatedInput
          ? updatedInput.closest('.cart-item__quantity-wrapper').querySelector(`[name="${focusName === 'plus' || focusName === 'minus' ? focusName : 'updates[]'}"]`)
          : drawer.querySelector('.cart-item__name') || drawer.querySelector('.cart-drawer__empty-content a');
        trapFocus(drawer.querySelector('.drawer__inner'), target || drawer.querySelector('.drawer__close'));
      }
      publish(PUB_SUB_EVENTS.cartUpdate, { source: 'cart-items', cartData: state, variantId });
    } catch (error) {
      if (input?.isConnected) input.value = input.defaultValue;
      this.setBusy(false);
      const message = error.invalid ? error.message : window.cartStrings.error;
      this.showError(line, message, mutationAccepted);
      this.dispatchCartErrorEvent(message, error.invalid ? 'INVALID' : 'SERVICE_UNAVAILABLE');
      if (!mutationAccepted) deferred?.reject(error);
      const restoredInput = drawer.querySelector(`#Drawer-quantity-${line}`);
      if (drawer.classList.contains('active') && restoredInput) restoredInput.focus();
    } finally {
      drawer.setAttribute('aria-busy', 'false');
      this.mutationPending = false;
    }
  }

  getSectionsToRender() {
    return [
      { id: 'CartDrawer', section: 'cart-drawer', selector: '.drawer__inner' },
      { id: 'cart-icon-bubble', section: 'cart-icon-bubble', selector: '.shopify-section' },
    ];
  }
}
customElements.define('cart-drawer-items', CartDrawerItems);
