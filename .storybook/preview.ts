import type { Preview } from "@storybook/react-vite";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-sans/700.css";
import "@fontsource/ibm-plex-sans-jp/400.css";
import "@fontsource/ibm-plex-sans-jp/500.css";
import "@fontsource/ibm-plex-sans-jp/700.css";
import "../web/src/styles.css";

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: "paper",
      values: [
        { name: "paper", value: "#f7f7f5" },
        { name: "surface", value: "#ffffff" },
        { name: "midnight", value: "#101014" },
      ],
    },
    layout: "padded",
    controls: { expanded: true },
    options: {
      storySort: {
        order: ["*", []],
      },
    },
  },
};

export default preview;
