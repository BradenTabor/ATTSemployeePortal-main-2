import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";

export default (ctx = {}) => {
  if (!ctx.options) {
    ctx.options = {};
  }
  if (ctx.options.from === undefined) {
    ctx.options.from = "inline.css";
  }

  return {
    plugins: [tailwindcss(), autoprefixer()],
  };
};
