// Nodynamic runs: skip any @dynamic tests via built-in tag filtering.
import { livedoc } from './livedoc';

// Ensure exclude list exists and includes 'dynamic'
const exclude = livedoc.options.filters.exclude || [];
if (!exclude.includes('dynamic')) {
	exclude.push('dynamic');
}
livedoc.options.filters.exclude = exclude;

// Reuse the standard setup (globals registration)
import './setup';
