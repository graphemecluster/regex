import {regex, pattern, processRegex} from '../../dist/regex.mjs';

// So specs can be shared with the browser test runner
Object.assign(globalThis, {regex, pattern, processRegex});
