// The sky wash, full screen, with the editor on top. Route: /dev/sky/wash
//
// For tuning src/app/sky-wash.css: drag the glows, pick colours, slide
// strengths and sizes, then Save (writes the file) or Save + bake (also
// renders the bitmap the other pages paint). The gallery chrome is hidden
// behind it on purpose, so what you see is exactly the page background.

import { WashEditor } from "./editor";

export default function SkyWashPage() {
  return <WashEditor />;
}
