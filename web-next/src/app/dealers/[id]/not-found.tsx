import { ButtonLink, EmptyState } from '@/components/ui';

export default function DealerNotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <EmptyState title="Dealer not found" action={<ButtonLink href="/cars">Browse cars</ButtonLink>} />
    </div>
  );
}
