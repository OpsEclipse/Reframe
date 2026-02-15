import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  plugins: [
    plugin(({ addVariant }) => {
      // Variants for the staged intro -> final transition driven by data attributes.
      addVariant("ch26-final", '#ch26-home[data-ch26-stage="final"] &');
    }),
  ],
  theme: {
    extend: {
      keyframes: {
        "ch26-greeting-flicker": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "10%": { opacity: "0.86", transform: "translateY(1px)" },
          "14%": { opacity: "0.18", transform: "translateY(3px)" },
          "20%": { opacity: "0.96", transform: "translateY(0px)" },
          "28%": { opacity: "0.52", transform: "translateY(1px)" },
          "36%": { opacity: "0.98", transform: "translateY(0px)" },
          "100%": { opacity: "1", transform: "translateY(0px)" },
        },
      },
      animation: {
        // Fast initial flicker, then decelerate into the final resting state.
        "ch26-greeting-flicker":
          "ch26-greeting-flicker 2800ms cubic-bezier(0.16, 1, 0.3, 1) both",
      },
    },
  },
} satisfies Config;
