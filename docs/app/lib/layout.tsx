import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { Coffee, Heart } from "lucide-react";

import LogoMark from "@/components/logo-mark";

export const baseOptions: BaseLayoutProps = {
  nav: {
    title: (
      <>
        <LogoMark className="size-[18px] shrink-0" />
        <span className="text-sm font-semibold tracking-tight">headplane</span>
      </>
    ),
  },
  githubUrl: "https://github.com/tale/headplane",
  links: [
    { text: "Changelog", url: "/CHANGELOG" },
    {
      type: "icon",
      text: "Sponsor",
      icon: <Heart />,
      url: "https://github.com/sponsors/tale",
      external: true,
    },
    {
      type: "icon",
      text: "Ko-fi",
      icon: <Coffee />,
      url: "https://ko-fi.com/atale",
      external: true,
    },
  ],
};
