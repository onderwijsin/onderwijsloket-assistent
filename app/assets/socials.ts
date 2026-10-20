import type { Social } from "../types/socials";

import { getIcon } from "~/utils/icons";

export default [
  {
    label: "LinkedIn",
    url: "https://www.linkedin.com/company/onderwijs-in",
    icon: getIcon("linkedin")
  },
  {
    label: "GitHub",
    url: "https://github.com/onderwijsin",
    icon: getIcon("github")
  }
] satisfies Social[];
