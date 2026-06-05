"use client";

import { useEffect } from "react";

const PREVIEW_CHROME_SELECTORS = [
    "[data-global-chrome]",
    "nextjs-portal",
    "[data-nextjs-dev-tools-button]",
    "[data-nextjs-dev-tools-indicator]",
    "[data-nextjs-build-indicator]",
    "[data-nextjs-toast]",
    "[data-nextjs-react-dev-overlay]",
];

export default function EmbeddedPreviewChromeHider() {
    useEffect(() => {
        const hiddenElements = new Map<HTMLElement, string>();

        const hidePreviewChrome = () => {
            PREVIEW_CHROME_SELECTORS.forEach((selector) => {
                document.querySelectorAll<HTMLElement>(selector).forEach((element) => {
                    if (!hiddenElements.has(element)) {
                        hiddenElements.set(element, element.style.display);
                    }
                    element.style.display = "none";
                });
            });
        };

        hidePreviewChrome();

        const observer = new MutationObserver(hidePreviewChrome);
        observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
        });

        return () => {
            observer.disconnect();
            hiddenElements.forEach((display, element) => {
                element.style.display = display;
            });
        };
    }, []);

    return null;
}
