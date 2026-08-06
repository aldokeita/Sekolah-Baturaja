/**
 * Runtime helper for pages ported from the Claude Design mockups.
 *
 * The mockups' logic classes return inline styles as CSS *strings* (e.g.
 * `f.iconStyle`). React needs objects, so the generated markup wraps those
 * values in `s(...)`. Static style strings are converted at build time by
 * tools/dc-convert.mjs; this helper only handles the dynamic ones.
 */

const CUSTOM_PROP = /^--/;

const camel = (prop) => prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

/** Convert a CSS declaration string into a React style object. */
export function s(css) {
  if (!css) return undefined;
  if (typeof css === 'object') return css;
  const out = {};
  let depth = 0;
  let buf = '';
  const decls = [];
  // Split on ';' at paren depth 0 so gradients/functions stay intact.
  for (const ch of String(css)) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ';' && depth === 0) { decls.push(buf); buf = ''; continue; }
    buf += ch;
  }
  if (buf.trim()) decls.push(buf);

  for (const decl of decls) {
    const i = decl.indexOf(':');
    if (i < 0) continue;
    const prop = decl.slice(0, i).trim();
    const value = decl.slice(i + 1).trim();
    if (!prop || !value) continue;
    out[CUSTOM_PROP.test(prop) ? prop : camel(prop)] = value;
  }
  return out;
}

export default s;
