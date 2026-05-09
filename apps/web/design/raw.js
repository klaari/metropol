/**
 * Web design tokens — re-exports the mobile raw token set so both
 * apps draw from the same palette, type ramp, spacing, and radius.
 *
 * This file exists only to give web a stable in-package import path;
 * the real source of truth lives at apps/mobile/design/raw.js.
 */
module.exports = require("../../mobile/design/raw.js");
