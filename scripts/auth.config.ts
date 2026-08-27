import { betterAuth } from "better-auth";
import { buildAuthPlugins } from "../src/server/plugins";

export const auth = betterAuth({
  plugins: buildAuthPlugins({} as any),
});
