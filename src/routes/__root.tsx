import { createRootRoute, ScrollRestoration } from '@tanstack/react-router';
import { HeadContent, Scripts } from '@tanstack/react-router';
import AppLayout from '../components/layout/AppLayout';
import '../styles.css';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Ótica Catelan CRM' },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <>
      <HeadContent />
      <AppLayout />
      <ScrollRestoration />
      <Scripts />
    </>
  );
}
