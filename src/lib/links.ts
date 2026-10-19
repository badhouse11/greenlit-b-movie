/** The full GREENLIT game. Set VITE_GREENLIT_URL in Netlify when it moves to a proper domain. */
export const GREENLIT_URL: string = import.meta.env.VITE_GREENLIT_URL || 'https://fancy-lily-73a6e5.netlify.app';

/** This site's own address, for the share text. */
export const SITE_URL = () => (typeof window === 'undefined' ? '' : `${window.location.origin}`);
