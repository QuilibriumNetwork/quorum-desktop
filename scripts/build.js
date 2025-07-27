#!/usr/bin/env node

import { spawn } from 'child_process';

// Parse command line arguments
const args = process.argv.slice(2);
const includePlayground = args.includes('--playground');

// Set environment variable based on flag
const env = {
  ...process.env,
  INCLUDE_PLAYGROUND: includePlayground ? 'true' : 'false'
};

// Run vite build with the environment variable
const buildProcess = spawn('vite', ['build'], {
  stdio: 'inherit',
  env: env,
  shell: true
});

buildProcess.on('error', (error) => {
  console.error('Failed to start build process:', error);
  process.exit(1);
});

buildProcess.on('exit', (code) => {
  process.exit(code);
});