import React, {useContext, type ReactNode} from 'react';
import Heading from '@theme-original/Heading';
import type {Props} from '@theme/Heading';
import {LibraryVersionContext} from '../../components/LibraryVersionContext';
import styles from './styles.module.css';

export default function VersionedHeading(props: Props): ReactNode {
  const version = useContext(LibraryVersionContext);
  return (
    <>
      <Heading {...props} />
      {props.as === 'h1' && version && (
        <p className={styles.libraryVersion} data-docs-library-version
          title="Source package version for this documentation build; not a claim about the latest published release.">
          Docs for {version.label} <span className={styles.version}>v{version.version}</span>
        </p>
      )}
    </>
  );
}
