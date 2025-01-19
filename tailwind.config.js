/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}', './node_modules/@quilibrium/quilibium-js-sdk-channels/dist/**/*.{js,ts,jsx,tsx}'],
  safelist: [
    {
      pattern: /^(absolute|text-center|top-0|left-0|w-full|p-4|font-light|text-xl|left-1\/3|w-1\/3|border|border-t-0|border-stone-300\/20|border-stone-300\/30|bg-stone-200.*|bg-stone-300.*|drop-shadow-2xl|rounded-none|rounded-b-2xl|fixed|text-stone|text-white|top-0|left-0|backdrop-blur-lg|transition|ease-in-out|duration-600|w-full|h-full|bg-stone-900.*|relative|z-100|inline-block|font-bold|transition|ease-in-out|duration-300|mb-4|border|border-stone-100.*|rounded-full|p-2|bg-cover|mx-4|bg-red-600|border-red-300|bg-stone-800.*|border-stone-800.*|bg-green-600|border-green-200)$/,
      variants: ['md', 'hover']
    }
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
