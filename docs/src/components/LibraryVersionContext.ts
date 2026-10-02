import {createContext} from 'react';
import type {LibraryVersion} from '../utils/libraryVersions';

export const LibraryVersionContext = createContext<LibraryVersion | undefined>(undefined);
