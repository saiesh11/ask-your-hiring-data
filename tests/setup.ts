// Registers @testing-library/jest-dom matchers on Vitest's `expect`.
// Harmless in the Node environment (matchers only touch the DOM when called);
// component tests that opt into jsdom rely on it.
import "@testing-library/jest-dom/vitest";
