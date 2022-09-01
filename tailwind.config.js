const colors = require("./themes/congo/node_modules/tailwindcss/colors");
const config = require("./themes/congo/tailwind.config.js");

config.theme.colors = {
  ...config.theme.colors,
  ...{
    purple: config.theme.colors.primary,
    black: colors.black,
    white: colors.white,
    gray: colors.gray,
    emerald: colors.emerald,
    red: colors.red,
    indigo: colors.indigo,
    yellow: colors.yellow,
    teal: colors.teal,
    orange: colors.orange,
    green: colors.green,
  },
};

module.exports = config;
