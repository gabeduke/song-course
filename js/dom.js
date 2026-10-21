// Tiny DOM helpers. h('div.card#id', {onclick}, children...)

const SVG_NS = 'http://www.w3.org/2000/svg';

function build(ns, tag, props, children) {
  const m = /^([a-zA-Z0-9-]+)?((?:[.#][^.#]+)*)$/.exec(tag);
  const name = m?.[1] || 'div';
  const el = ns ? document.createElementNS(ns, name) : document.createElement(name);
  if (m?.[2]) {
    for (const part of m[2].match(/[.#][^.#]+/g)) {
      if (part[0] === '.') el.classList.add(part.slice(1));
      else el.id = part.slice(1);
    }
  }
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'class') el.classList.add(...String(v).split(/\s+/).filter(Boolean));
      else if (k === 'style' && typeof v === 'object') {
        for (const [sk, sv] of Object.entries(v)) {
          if (sk.startsWith('--')) el.style.setProperty(sk, sv);
          else el.style[sk] = sv;
        }
      }
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k === 'html') el.innerHTML = v;
      else if (!ns && k in el && typeof v !== 'string') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function h(tag, props, ...children) {
  if (props instanceof Node || Array.isArray(props) || typeof props !== 'object' || props === null) {
    return build(null, tag, null, [props, ...children]);
  }
  return build(null, tag, props, children);
}

export function s(tag, props, ...children) {
  if (props instanceof Node || Array.isArray(props) || typeof props !== 'object' || props === null) {
    return build(SVG_NS, tag, null, [props, ...children]);
  }
  return build(SVG_NS, tag, props, children);
}

/** Like el.append, but skips null/false children. */
export function put(el, ...kids) {
  el.append(...kids.flat(Infinity).filter((k) => k !== null && k !== undefined && k !== false));
  return el;
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

export function download(filename, data, type = 'application/json') {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function toast(msg) {
  let t = document.querySelector('.toast');
  if (!t) {
    t = h('div.toast', { role: 'status', 'aria-live': 'polite' });
    document.body.append(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2600);
}

/** Segmented control: [{value,label}] */
export function segmented(name, options, value, onChange, { small = false } = {}) {
  return h(`div.seg${small ? '.seg-sm' : ''}`, { role: 'radiogroup', 'aria-label': name },
    options.map((o) => h('button', {
      type: 'button',
      role: 'radio',
      'aria-checked': String(o.value === value),
      class: o.value === value ? 'on' : '',
      title: o.title,
      onclick: () => onChange(o.value),
    }, o.label)));
}
