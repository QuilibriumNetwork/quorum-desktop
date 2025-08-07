/**
 * Platform-aware router export
 * Automatically selects the correct router implementation based on platform
 */

// For now, always export the web router since mobile is not implemented yet
// When mobile is ready, this will use platform detection to export the correct router
export { Router } from './Router.web';