'use client';

import { ErrorPage } from '@/components/ErrorPage';

export default function RouteError() {
  return (
    <ErrorPage
      code="Oops"
      title="Something went wrong"
      description="Please refresh the page. If it keeps happening, try again in a little while."
    />
  );
}
