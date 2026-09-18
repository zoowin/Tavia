if (!customElements.get('tavia-us-sizes')) {
  class TaviaUsSizes extends HTMLElement {
    static conversion = {
  "35": [
    3.5,
    5,
    226
  ],
  "36": [
    4,
    5.5,
    232
  ],
  "37": [
    5,
    6.5,
    239
  ],
  "38": [
    5.5,
    7,
    246
  ],
  "39": [
    6.5,
    8,
    252
  ],
  "40": [
    7,
    8.5,
    259
  ],
  "41": [
    8,
    9.5,
    266
  ],
  "42": [
    8.5,
    10,
    272
  ],
  "43": [
    9.5,
    11,
    279
  ],
  "44": [
    10,
    11.5,
    288
  ],
  "45": [
    11,
    12.5,
    292
  ],
  "46": [
    12,
    13.5,
    299
  ],
  "47": [
    12.5,
    14,
    305
  ],
  "48": [
    13.5,
    15,
    312
  ]
};

    connectedCallback() {
      if (this.dataset.enhanced) return;
      this.select = this.querySelector('select');
      this.product = this.closest('product-info');
      if (!this.select || !this.product) return;
      this.options = Array.from(this.select.options);
      this.eu = (value) => value.trim().replace(/^EU\s*/i, '');
      if (!this.options.length || !this.options.every((option) => TaviaUsSizes.conversion[this.eu(option.value)])) return;
      const key = `${this.product.dataset.productId}:${this.select.name}`;
      this.product.taviaSizeStates ||= new Map();
      if (!this.product.taviaSizeStates.has(key)) {
        this.product.taviaSizeStates.set(key, {
          gender: 'female',
          chosen: new URLSearchParams(window.location.search).has('variant'),
        });
      }
      this.state = this.product.taviaSizeStates.get(key);
      this.dataset.enhanced = 'true';
      const system = document.createElement('div');
      system.className = 'tavia-us-system';
      system.setAttribute('role', 'group');
      system.setAttribute('aria-label', this.dataset.systemLabel);
      const label = document.createElement('p');
      label.className = 'form__label';
      label.textContent = this.dataset.systemLabel;
      system.append(label);
      this.genderButtons = ['female', 'male'].map((gender) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = this.dataset[`${gender}Label`];
        button.addEventListener('click', () => {
          this.state.gender = gender;
          this.refresh();
        });
        system.append(button);
        return button;
      });
      this.prepend(system);
      const nativeLabel = this.querySelector('.tavia-size-label label');
      if (nativeLabel) nativeLabel.textContent = this.dataset.sizeLabel;
      this.grid = document.createElement('div');
      this.grid.className = 'tavia-us-grid';
      this.grid.setAttribute('role', 'group');
      this.grid.setAttribute('aria-label', this.dataset.sizeLabel);
      this.grid.addEventListener('keydown', (event) => {
        const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
        if (!keys.includes(event.key)) return;
        const enabled = this.sizeButtons.filter((button) => !button.disabled);
        const current = enabled.indexOf(event.target);
        if (current < 0) return;
        event.preventDefault();
        let next = current + (['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1);
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = enabled.length - 1;
        enabled[(next + enabled.length) % enabled.length]?.focus();
      });
      this.sizeButtons = this.options.map((option) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.disabled = option.dataset.sizeUnavailable === 'true' || option.disabled;
        button.addEventListener('click', () => {
          this.state.chosen = true;
          this.select.value = option.value;
          this.refresh();
          this.select.dispatchEvent(new Event('change', { bubbles: true }));
        });
        this.grid.append(button);
        return button;
      });
      const nativeSelect = this.select.closest('.select');
      nativeSelect.hidden = true;
      nativeSelect.after(this.grid);
      this.summary = document.createElement('p');
      this.summary.className = 'tavia-us-summary';
      this.summary.setAttribute('aria-live', 'polite');
      this.error = document.createElement('p');
      this.error.className = 'tavia-us-error';
      this.error.setAttribute('role', 'alert');
      this.error.hidden = true;
      this.grid.after(this.summary, this.error);
      this.refresh();
    }

    refresh() {
      const gender = this.state.gender;
      this.genderButtons.forEach((button, index) => button.setAttribute('aria-pressed', String(index === (gender === 'female' ? 0 : 1))));
      this.sizeButtons.forEach((button, index) => {
        const option = this.options[index];
        const eu = this.eu(option.value);
        const us = TaviaUsSizes.conversion[eu][gender === 'male' ? 0 : 1];
        button.textContent = `US ${us}`;
        button.setAttribute('aria-label', `${this.dataset[`${gender}Label`]} US ${us}, EU ${eu}`);
        button.setAttribute('aria-pressed', String(this.state.chosen && option.value === this.select.value));
      });
      const eu = this.eu(this.select.value);
      this.summary.textContent = this.state.chosen && TaviaUsSizes.conversion[eu]
        ? `${this.dataset[`${gender}Label`]} US ${TaviaUsSizes.conversion[eu][gender === 'male' ? 0 : 1]} / EU ${eu}`
        : '';
      this.error.hidden = true;
    }

    validateSelection() {
      if (this.state.chosen && this.options.some((option, index) => option.value === this.select.value && !this.sizeButtons[index].disabled)) return true;
      this.error.textContent = this.dataset.requiredMessage;
      this.error.hidden = false;
      this.grid.scrollIntoView({ behavior: 'auto', block: 'center' });
      this.sizeButtons.find((button) => !button.disabled)?.focus({ preventScroll: true });
      return false;
    }
  }
  customElements.define('tavia-us-sizes', TaviaUsSizes);
}

if (!customElements.get('tavia-size-chart')) {
  class TaviaSizeChart extends HTMLElement {
    connectedCallback() {
      if (this.initialized) return;
      this.initialized = true;
      this.unit = 'cm';
      const conversion = customElements.get('tavia-us-sizes').conversion;
      let sizes = [];
      try { sizes = JSON.parse(this.dataset.sizes || '[]'); } catch {}
      this.rows = [...new Set(sizes.map(value => String(value).trim().replace(/^EU\s*/i, '')))]
        .filter(eu => conversion[eu]).sort((a, b) => Number(a) - Number(b));
      this.querySelector('tbody').replaceChildren(...this.rows.map(eu => {
        const [male, female, mm] = conversion[eu];
        const tr = document.createElement('tr');
        [female, male, mm / 10, eu].forEach((value, index) => {
          const cell = document.createElement(index === 3 ? 'th' : 'td');
          if (index === 3) cell.scope = 'row';
          if (index === 2) cell.dataset.lengthMm = String(mm);
          cell.textContent = String(value);
          tr.append(cell);
        });
        return tr;
      }));
      this.querySelector('[data-chart-empty]').hidden = this.rows.length > 0;
      this.querySelector('[data-chart-table]').hidden = this.rows.length === 0;
      this.querySelectorAll('[data-chart-unit]').forEach(button => {
        button.addEventListener('click', () => this.setUnit(button.dataset.chartUnit));
      });
      this.setUnit('cm');
    }
    setUnit(unit) {
      if (!['cm', 'in'].includes(unit)) return;
      this.unit = unit;
      this.querySelectorAll('[data-chart-unit]').forEach(button => {
        button.setAttribute('aria-pressed', String(button.dataset.chartUnit === unit));
      });
      this.querySelector('[data-length-heading]').textContent = this.dataset[unit === 'cm' ? 'headingCm' : 'headingIn'];
      this.querySelectorAll('[data-length-mm]').forEach(cell => {
        const mm = Number(cell.dataset.lengthMm);
        cell.textContent = unit === 'cm' ? (mm / 10).toFixed(1) : (mm / 25.4).toFixed(2);
      });
    }
  }
  customElements.define('tavia-size-chart', TaviaSizeChart);
}
