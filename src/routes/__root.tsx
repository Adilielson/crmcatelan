import { createRootRoute } from '@tanstack/react-router';
import { Head } from '@tanstack/react-start';
import AppLayout from '../components/layout/AppLayout';
import styles from '../styles.css?url';

export const Route = createRootRoute({
  component: () => (
    <>
      <Head>
        <link rel="stylesheet" href={styles} />
      </Head>
      <AppLayout />
    </>
  ),
});
