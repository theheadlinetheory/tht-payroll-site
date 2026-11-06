// What the CFO Hub modules borrow from the CRM's app shell, and nothing more.
//
// cfo.js / cac.js / margins.js / overhead.js / margin-costs.js are copied
// verbatim from tht-crm/js (only their import lines differ) so the hub looks
// and behaves exactly as it does in the CRM. In the CRM they read a global
// `state` bag and call `render()` to repaint the page; here those two names
// resolve to this file.
export const state = {};

let painter = () => {};
/** main.js registers the function that repaints the current page. */
export function setPainter(fn) { painter = fn; }
export function render() { painter(); }
