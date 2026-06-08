import type { Config } from "tailwindcss";
import { fontFamily } from "tailwindcss/defaultTheme";

export default {
  content: ["./src/**/*.{ts,tsx}", "./index.html"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Plus Jakarta Sans", ...fontFamily.sans],
        jakarta: ["Plus Jakarta Sans", "sans-serif"],
        inter: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
