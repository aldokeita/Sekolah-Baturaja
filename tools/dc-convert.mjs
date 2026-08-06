#!/usr/bin/env node
/**
 * dc-convert.mjs — converts a Claude Design `.dc.html` mockup into a React
 * component + a page CSS file, file-to-file.
 *
 * The mockups are Design Canvas components executed by `support.js` (dc-runtime).
 * React cannot run them directly, so this script performs the *mechanical* part
 * of the port verbatim:
 *
 *   style="a:b;c:d"        -> style={{a:'b',c:'d'}}          (values copied as-is)
 *   style="{{ x.style }}"  -> style={s(x.style)}             (see src/lib/dcStyle.js)
 *   style-hover="..."      -> generated `.hx-<hash>` CSS class + className
 *   style-before="..."     -> an absolutely-positioned child div (same pixels)
 *   class=                 -> className=,  for= -> htmlFor=,  SVG attrs camelCased
 *   <sc-for list="{{a}}" as="b"> -> {a.map((b, $index) => (<Fragment key>...))}
 *   <sc-if value="{{c}}">        -> {c && (<>...</>)}
 *   {{ expr }}                   -> {expr}      (text and attributes)
 *   onClick="{{ f }}"            -> onClick={f}
 *   <style> block                -> src/styles/sdnb-<slug>.css (scoped, base rules dropped)
 *
 * What it deliberately does NOT do: translate the page's `class Component
 * extends DCLogic` block. That state/handler logic is written by hand per page,
 * which is also where backend wiring and routing links get attached.
 *
 * The shared shell (background orbs, sticky nav, footer) is skipped because the
 * app renders it once via PublicLayout; only <section> elements and the trailing
 * <sc-if> modal blocks are emitted.
 *
 * Usage:
 *   node tools/dc-convert.mjs "<path to .dc.html>" <slug> <ComponentName>
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/* ────────────────────────────────────────────────────────────── utilities ── */

const camel = (p) => p.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

const hash = (str) => {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};

/** Split CSS declarations on ';' at paren depth 0. */
function splitDecls(css) {
  const out = [];
  let depth = 0;
  let buf = '';
  for (const ch of css) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ';' && depth === 0) { out.push(buf); buf = ''; continue; }
    buf += ch;
  }
  if (buf.trim()) out.push(buf);
  return out;
}

/** "a:b;c:d" -> "{a:\"b\",c:\"d\"}" — every value stays a string, so units and
 *  gradients survive untouched. */
function styleStringToObject(css) {
  const parts = [];
  for (const decl of splitDecls(css)) {
    const i = decl.indexOf(':');
    if (i < 0) continue;
    const prop = decl.slice(0, i).trim();
    const value = decl.slice(i + 1).trim();
    if (!prop || !value) continue;
    const key = prop.startsWith('--') ? JSON.stringify(prop) : camel(prop);
    parts.push(`${key}: ${JSON.stringify(value)}`);
  }
  return `{ ${parts.join(', ')} }`;
}

/** Interpolated string -> JS template literal source (without backticks). */
const toTemplate = (raw) => raw.replace(/`/g, '\\`').replace(/\{\{\s*([\s\S]*?)\s*\}\}/g, (_, e) => '${' + e.trim() + '}');

const ATTR_RENAME = {
  class: 'className',
  for: 'htmlFor',
  'stroke-width': 'strokeWidth',
  'stroke-linecap': 'strokeLinecap',
  'stroke-linejoin': 'strokeLinejoin',
  'stroke-dasharray': 'strokeDasharray',
  'stroke-dashoffset': 'strokeDashoffset',
  'fill-rule': 'fillRule',
  'clip-rule': 'clipRule',
  'clip-path': 'clipPath',
  'stop-color': 'stopColor',
  'stop-opacity': 'stopOpacity',
  'text-anchor': 'textAnchor',
  'font-size': 'fontSize',
  'font-weight': 'fontWeight',
  'font-family': 'fontFamily',
  'letter-spacing': 'letterSpacing',
  'gradientunits': 'gradientUnits',
  colspan: 'colSpan',
  rowspan: 'rowSpan',
  maxlength: 'maxLength',
  autocomplete: 'autoComplete',
  readonly: 'readOnly',
  tabindex: 'tabIndex',
  srcset: 'srcSet',
  novalidate: 'noValidate',
};

const EVENTS = {
  onclick: 'onClick', onchange: 'onChange', oninput: 'onInput', onsubmit: 'onSubmit',
  onkeydown: 'onKeyDown', onkeyup: 'onKeyUp', onfocus: 'onFocus', onblur: 'onBlur',
  onmouseenter: 'onMouseEnter', onmouseleave: 'onMouseLeave', onmouseover: 'onMouseOver',
  onmouseout: 'onMouseOut',
};

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

const BOOLEAN_ATTRS = new Set(['disabled', 'checked', 'readonly', 'required', 'autofocus', 'novalidate', 'multiple', 'selected']);

/* ─────────────────────────────────────────────────────────── attributes ──── */

const hoverClasses = new Map(); // css -> class name

function parseAttrs(raw) {
  const attrs = [];
  const re = /([:@a-zA-Z_][-:a-zA-Z0-9_]*)(?:\s*=\s*("([^"]*)"|'([^']*)'|[^\s>]+))?/g;
  let m;
  while ((m = re.exec(raw))) {
    const name = m[1];
    const value = m[3] !== undefined ? m[3] : m[4] !== undefined ? m[4] : m[2];
    attrs.push([name, value]);
  }
  return attrs;
}

function convertAttrs(rawAttrs) {
  const out = [];
  let beforeDiv = null;
  const extraClasses = [];
  let classValue = null;

  for (const [nameRaw, valueRaw] of parseAttrs(rawAttrs)) {
    const name = nameRaw.toLowerCase();
    const value = valueRaw === undefined ? null : valueRaw;

    // decorative ::before -> real child div
    if (name === 'style-before') {
      beforeDiv = value;
      continue;
    }
    // :hover -> generated class
    if (name === 'style-hover') {
      const key = value.trim().replace(/;\s*$/, '');
      if (!hoverClasses.has(key)) hoverClasses.set(key, `hx-${hash(key)}`);
      extraClasses.push(hoverClasses.get(key));
      continue;
    }
    // other style-<pseudo> variants are not used by these mockups; skip loudly
    if (name.startsWith('style-')) continue;

    if (name === 'style') {
      if (value == null) continue;
      if (/^\s*\{\{[\s\S]*\}\}\s*$/.test(value)) {
        out.push(`style={__dcs(${value.replace(/^\s*\{\{\s*|\s*\}\}\s*$/g, '')})}`);
      } else if (value.includes('{{')) {
        out.push('style={__dcs(`' + toTemplate(value) + '`)}');
      } else {
        out.push(`style={${styleStringToObject(value)}}`);
      }
      continue;
    }

    if (name === 'class') { classValue = value; continue; }

    if (EVENTS[name]) {
      const expr = value.replace(/^\s*\{\{\s*|\s*\}\}\s*$/g, '');
      out.push(`${EVENTS[name]}={${expr}}`);
      continue;
    }

    const jsxName = ATTR_RENAME[name] || (name.startsWith('data-') || name.startsWith('aria-') ? name : (/[A-Z]/.test(nameRaw) ? nameRaw : name));

    if (value == null) {
      out.push(BOOLEAN_ATTRS.has(name) ? `${jsxName}` : `${jsxName}=""`);
      continue;
    }
    if (/^\s*\{\{[\s\S]*\}\}\s*$/.test(value)) {
      out.push(`${jsxName}={${value.replace(/^\s*\{\{\s*|\s*\}\}\s*$/g, '')}}`);
    } else if (value.includes('{{')) {
      out.push(`${jsxName}={\`${toTemplate(value)}\`}`);
    } else {
      out.push(`${jsxName}=${JSON.stringify(value)}`);
    }
  }

  if (classValue !== null || extraClasses.length) {
    const all = [classValue, ...extraClasses].filter(Boolean).join(' ');
    if (!all) return { attrs: out, beforeDiv };
    // A class list can itself be interpolated (e.g. class="{{ c.cls }}").
    out.unshift(all.includes('{{')
      ? 'className={`' + toTemplate(all) + '`}'
      : `className=${JSON.stringify(all)}`);
  }

  return { attrs: out, beforeDiv };
}

function beforeDivSource(css) {
  const obj = styleStringToObject(css.replace(/content\s*:\s*''\s*;?/, ''));
  return `<div aria-hidden="true" style={${obj}} />`;
}

/* ─────────────────────────────────────────────────────────────── markup ──── */

function convertText(text) {
  if (!text.includes('{{')) return text;
  return text.replace(/\{\{\s*([\s\S]*?)\s*\}\}/g, (_, e) => `{${e.trim()}}`);
}

function convertMarkup(html) {
  let out = '';
  let i = 0;
  const stack = [];

  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt === -1) { out += convertText(html.slice(i)); break; }
    out += convertText(html.slice(i, lt));

    // comment
    if (html.startsWith('<!--', lt)) {
      const end = html.indexOf('-->', lt);
      i = end === -1 ? html.length : end + 3;
      continue;
    }

    const gt = findTagEnd(html, lt);
    if (gt === -1) { out += convertText(html.slice(lt)); break; }

    const tagSrc = html.slice(lt, gt + 1);
    const closing = tagSrc.startsWith('</');
    const nameMatch = tagSrc.match(/^<\/?\s*([a-zA-Z][-a-zA-Z0-9]*)/);
    const tag = nameMatch ? nameMatch[1] : '';
    const lower = tag.toLowerCase();

    if (closing) {
      const opened = stack.pop();
      if (opened === 'sc-for') out += '</React.Fragment>))}';
      else if (opened === 'sc-if') out += '</>)}';
      else out += `</${tag}>`;
      i = gt + 1;
      continue;
    }

    const selfClosed = /\/>$/.test(tagSrc);
    const rawAttrs = tagSrc.replace(/^<\s*[a-zA-Z][-a-zA-Z0-9]*/, '').replace(/\/?>$/, '');

    if (lower === 'sc-for') {
      const a = Object.fromEntries(parseAttrs(rawAttrs).map(([k, v]) => [k.toLowerCase(), v]));
      const list = (a.list || '').replace(/^\s*\{\{\s*|\s*\}\}\s*$/g, '');
      const as = a.as || 'item';
      out += `{(${list} || []).map((${as}, $index) => (<React.Fragment key={$index}>`;
      stack.push('sc-for');
      i = gt + 1;
      continue;
    }

    if (lower === 'sc-if') {
      const a = Object.fromEntries(parseAttrs(rawAttrs).map(([k, v]) => [k.toLowerCase(), v]));
      const cond = (a.value || '').replace(/^\s*\{\{\s*|\s*\}\}\s*$/g, '');
      out += `{(${cond}) && (<>`;
      stack.push('sc-if');
      i = gt + 1;
      continue;
    }

    const { attrs, beforeDiv } = convertAttrs(rawAttrs);
    const attrStr = attrs.length ? ' ' + attrs.join(' ') : '';

    if (selfClosed || VOID.has(lower)) {
      out += `<${tag}${attrStr} />`;
      i = gt + 1;
      continue;
    }

    out += `<${tag}${attrStr}>`;
    if (beforeDiv) out += beforeDivSource(beforeDiv);
    stack.push(tag);
    i = gt + 1;
  }

  return out;
}

/** Find the '>' that ends a tag, skipping quoted attribute values. */
function findTagEnd(html, start) {
  let q = null;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (q) { if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { q = c; continue; }
    if (c === '>') return i;
  }
  return -1;
}

/* ────────────────────────────────────────────────────────────────── CSS ──── */

// Rules already provided by src/styles/sdnb.css — dropped to avoid duplication.
const BASE_SELECTORS = new Set([
  'html', 'body', 'a', 'a:hover', '*',
  '.nav-links', '.nav-links a', '.nav-cta,.nav-login,.nav-brandtitle',
  '.shine', '.shine::after', '.shine:hover::after',
  '.navdd .ddmenu', '.navdd:hover .ddmenu,.navdd:focus-within .ddmenu',
  '.navdd:hover .ddcaret', '.ddcaret', '.ddpanel', '.ddlink', '.ddlink:hover',
  '.ddlink svg', '.ddlink:hover svg', '.nav-loginbtn',
  '.th-toggle', '.th-toggle:hover',
  '.mq-wrap:hover .mq-track',
]);
const BASE_KEYFRAMES = new Set(['floaty', 'sheen', 'marquee', 'driftbg']);

function splitRules(css) {
  const rules = [];
  let depth = 0;
  let buf = '';
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    buf += c;
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) { rules.push(buf.trim()); buf = ''; }
    }
  }
  if (buf.trim()) rules.push(buf.trim());
  return rules;
}

function scopeCss(css, scope) {
  const out = [];
  for (const rule of splitRules(css)) {
    const at = rule.match(/^@([a-z-]+)/i);
    if (at) {
      const kind = at[1].toLowerCase();
      if (kind === 'keyframes') {
        const name = rule.match(/^@keyframes\s+([\w-]+)/i)?.[1];
        if (name && BASE_KEYFRAMES.has(name)) continue;
        out.push(rule);
        continue;
      }
      if (kind === 'media') {
        const open = rule.indexOf('{');
        const prelude = rule.slice(0, open + 1);
        const inner = rule.slice(open + 1, rule.lastIndexOf('}'));
        const scopedInner = scopeCss(inner, scope);
        if (scopedInner.trim()) out.push(`${prelude}\n${scopedInner}\n}`);
        continue;
      }
      out.push(rule);
      continue;
    }

    const open = rule.indexOf('{');
    if (open === -1) continue;
    const selector = rule.slice(0, open).trim();
    const body = rule.slice(open);
    if (BASE_SELECTORS.has(selector.replace(/\s+/g, ' ')) || BASE_SELECTORS.has(selector.replace(/\s+/g, ''))) continue;

    const scoped = selector.split(',').map((sel) => {
      const t = sel.trim();
      if (!t) return t;
      // theme rules must stay anchored to <html>
      if (t.startsWith('html')) return t.replace(/^html(\[[^\]]*\])?\s*/, (mm) => `${mm.trim()} ${scope} `).replace(/\s+/g, ' ').trim();
      return `${scope} ${t}`;
    }).join(', ');

    out.push(`${scoped} ${body}`);
  }
  return out.join('\n');
}

/* ───────────────────────────────────────────────────────────────── main ──── */

const argv = process.argv.slice(2);
// `--whole` emits the entire <x-dc> body instead of just <section> elements.
// Login and Formulir PPDB are standalone full-screen designs with no <section>
// and no shared nav/footer, so they are ported whole rather than slotted into
// PublicLayout.
const WHOLE = argv.includes('--whole');
const [srcPath, slug, componentName] = argv.filter((a) => a !== '--whole');
if (!srcPath || !slug || !componentName) {
  console.error('Usage: node tools/dc-convert.mjs "<src .dc.html>" <slug> <ComponentName> [--whole]');
  process.exit(1);
}

const src = readFileSync(srcPath, 'utf8');

// 1) page CSS
const styleBlock = src.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
const scope = `.sdnb-${slug}`;

// 2) markup: only <section> elements and any trailing <sc-if> modal blocks.
const bodyMatch = src.match(/<x-dc>([\s\S]*)<\/x-dc>/);
if (!bodyMatch) { console.error('No <x-dc> block found'); process.exit(1); }
const body = bodyMatch[1];

// Standalone pages: take everything after </helmet> as one chunk.
const wholeBody = body.replace(/<helmet>[\s\S]*?<\/helmet>/, '').trim();

const chunks = [];
const collect = (tagName) => {
  const openRe = new RegExp(`<${tagName}(\\s|>)`, 'g');
  let m;
  while ((m = openRe.exec(body))) {
    const start = m.index;
    let depth = 0;
    let i = start;
    while (i < body.length) {
      const lt = body.indexOf('<', i);
      if (lt === -1) break;
      const gt = findTagEnd(body, lt);
      if (gt === -1) break;
      const t = body.slice(lt, gt + 1);
      const nm = t.match(/^<\/?\s*([a-zA-Z][-a-zA-Z0-9]*)/)?.[1]?.toLowerCase();
      if (nm === tagName) {
        if (t.startsWith('</')) { depth--; if (depth === 0) { chunks.push({ start, end: gt + 1, html: body.slice(start, gt + 1) }); break; } }
        else if (!/\/>$/.test(t)) depth++;
      }
      i = gt + 1;
    }
    openRe.lastIndex = start + 1;
  }
};
if (!WHOLE) {
  collect('section');
  collect('sc-if');
}

// keep document order, drop sc-if blocks nested inside a section
chunks.sort((a, b) => a.start - b.start);
const top = WHOLE
  ? [{ start: 0, end: wholeBody.length, html: wholeBody }]
  : chunks.filter((c, idx) => !chunks.some((o, j) => j !== idx && o.start < c.start && o.end > c.end));

const jsxParts = top.map((c) => convertMarkup(c.html));

// 3) hover classes discovered during conversion
const hoverCss = [...hoverClasses.entries()]
  .map(([css, cls]) => `.${cls}:hover { ${css.replace(/;\s*$/, '')}; }`)
  .join('\n');

const cssOut = `/* ============================================================================
   sdnb-${slug}.css — GENERATED by tools/dc-convert.mjs from the Claude Design
   mockup. Declarations are copied verbatim; page rules are scoped under
   "${scope}" so pages that reuse a class name (e.g. .mq-track, .gtile) with
   different values do not fight each other. Base rules already in sdnb.css are
   dropped. Do not hand-edit: re-run the converter instead.
   ========================================================================== */

${scopeCss(styleBlock, scope)}

/* --- hover states lifted out of style-hover="..." attributes --- */
${hoverCss}
`;

// Identifiers the markup reads. Loop variables and JS literals are excluded, so
// what remains is exactly the prop contract the page component must satisfy.
const bindings = new Set();
for (const c of top) {
  for (const m of c.html.matchAll(/\{\{\s*([A-Za-z_$][\w$]*)/g)) bindings.add(m[1]);
}
for (const m of body.matchAll(/<sc-for[^>]*\sas="([^"]+)"/g)) bindings.delete(m[1]);
for (const lit of ['true', 'false', 'null', 'undefined']) bindings.delete(lit);
const bindingList = [...bindings].sort();

const jsxOut = `/* eslint-disable */
/**
 * ${componentName} — GENERATED by tools/dc-convert.mjs.
 *
 * Verbatim markup of the Claude Design mockup, minus the shared shell (bg orbs,
 * nav, footer) which PublicLayout renders. Every value comes from the mockup.
 *
 * Do not hand-edit — re-run the converter. Page state/handlers live in the page
 * component that renders this one and are passed in as props.
 */
import React from 'react';
// Aliased: mockups use short loop variables (e.g. sc-for as="s") that would
// otherwise shadow the style helper inside a map callback.
import { s as __dcs } from '@/lib/dcStyle';
import '@/styles/sdnb-${slug}.css';

const ${componentName} = (vals = {}) => {
  const { ${bindingList.join(', ')} } = vals;
  return (
    <>
${jsxParts.join('\n')}
    </>
  );
};

export default ${componentName};
`;

const cssPath = resolve(`src/styles/sdnb-${slug}.css`);
const jsxPath = resolve(`src/components/sdnb/generated/${componentName}.jsx`);
mkdirSync(dirname(jsxPath), { recursive: true });
writeFileSync(cssPath, cssOut, 'utf8');
writeFileSync(jsxPath, jsxOut, 'utf8');

// 4) report, plus a sanity check that no mustache survived the conversion
const leftover = (jsxOut.match(/\{\{\s*[A-Za-z_$][\w$.]*\s*\}\}/g) || []).length;

console.log(`css  -> ${cssPath}`);
console.log(`jsx  -> ${jsxPath}`);
console.log(`sections: ${top.length}`);
console.log(`bindings needed: ${bindingList.join(', ') || '(none)'}`);
if (leftover) console.warn(`WARNING: ${leftover} unconverted {{ ... }} expression(s) remain`);
