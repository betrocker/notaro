const fontFamily = {
  sans: ["Inter-Regular", "sans-serif"],
  regular: ["Inter-Regular", "sans-serif"],
  medium: ["Inter-Medium", "sans-serif"],
  semibold: ["Inter-SemiBold", "sans-serif"],
  bold: ["Inter-Bold", "sans-serif"],

  // Backward compatibility.
  inter: ["Inter-Regular", "sans-serif"],
  "inter-medium": ["Inter-Medium", "sans-serif"],
  "inter-semibold": ["Inter-SemiBold", "sans-serif"],
  "inter-bold": ["Inter-Bold", "sans-serif"],
};

const typography = {
  "large-title": [
    "26px",
    { lineHeight: "32px", letterSpacing: "-0.3px", fontFamily: "Inter-Bold" },
  ],
  "body-lg": [
    "17px",
    { lineHeight: "22px", letterSpacing: "-0.2px", fontFamily: "Inter-SemiBold" },
  ],
  "body-md": [
    "17px",
    { lineHeight: "22px", letterSpacing: "-0.16px", fontFamily: "Inter-Regular" },
  ],
  label: [
    "15px",
    { lineHeight: "20px", letterSpacing: "-0.08px", fontFamily: "Inter-SemiBold" },
  ],
  "label-sm": [
    "15px",
    { lineHeight: "20px", letterSpacing: "-0.08px", fontFamily: "Inter-Regular" },
  ],
  footer: [
    "13px",
    { lineHeight: "18px", letterSpacing: "-0.04px", fontFamily: "Inter-Regular" },
  ],
  tiny: [
    "11px",
    { lineHeight: "14px", letterSpacing: "-0.02px", fontFamily: "Inter-Regular" },
  ],
};

const aliasTypography = {
  "display-xl": typography["large-title"],
  "display-lg": typography["large-title"],
  "title-lg": typography["body-lg"],
  "title-md": typography["body-lg"],
  "title-sm": typography["body-lg"],
  "body-base": typography["body-md"],
  "body-sm": typography["label-sm"],
  "label-md": typography.label,
  caption: typography.footer,
  "caption-xs": typography.tiny,
  "button-md": typography.label,
  "button-sm": typography["label-sm"],
};

const legacyTypography = {
  "things-title-large": typography["large-title"],
  "things-title-section": typography["body-lg"],
  "things-body": typography["body-md"],
  "things-entry": typography["body-lg"],
  "things-entry-compact": typography["label-sm"],
  "things-notes": typography["body-md"],
  "things-tag": typography.footer,
  "things-modal-title": typography["body-lg"],
  "things-modal-body": typography["body-md"],
  "things-modal-body-relaxed": typography["body-md"],
  "things-modal-label": typography.label,
  "things-modal-caption": typography.footer,
  "things-modal-header": typography["body-lg"],
  "things-modal-section": typography.label,
};

const colors = {
  primary: {
    DEFAULT: "var(--color-primary-default)",
  },
  btn: {
    secondary: "var(--color-btn-secondary)",
  },
  icon: {
    inbox: "var(--color-icon-inbox)",
  },
  bg: {
    base: "var(--color-bg-base)",
    modal: "var(--color-bg-modal)",
    input: "var(--color-bg-input)",
    popup: "var(--color-bg-popup)",
    overlay: "var(--color-bg-overlay)",
  },
  text: {
    primary: "var(--color-text-primary)",
    secondary: "var(--color-text-secondary)",
  },
  border: {
    DEFAULT: "var(--color-border-default)",
  },

  // Backward compatibility.
  things: {
    inbox: "var(--color-icon-inbox)",
    today: "var(--color-text-secondary)",
    upcoming: "var(--color-text-secondary)",
    anytime: "var(--color-text-secondary)",
    someday: "var(--color-text-secondary)",
    logbook: "var(--color-text-secondary)",
    bg: "var(--color-bg-base)",
    card: "var(--color-bg-modal)",
    sidebar: "var(--color-bg-modal)",
    text: "var(--color-text-primary)",
    muted: "var(--color-text-secondary)",
    border: "var(--color-border-default)",
    tag: "var(--color-bg-input)",
    checkbox: "var(--color-border-default)",
  },
};

module.exports = {
  fontFamily,
  typography: {
    ...typography,
    ...aliasTypography,
  },
  legacyTypography,
  colors,
};
