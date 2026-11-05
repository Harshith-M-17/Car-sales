'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Car, CarFront, CircleCheckBig, Clock, Search, Store, Users as UsersIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import Link from '@/components/Link';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { StatCard } from '@/components/StatCard';
import { Badge, Button, cn, EmptyState, ErrorNotice, Input, PageHeader, Select, Spinner, Textarea } from '@/components/ui';
import { useToast } from '@/components/toast';
import { api, errorMessage } from '@/lib/api';
import { formatAddress, formatDate, formatNumber, formatPriceShort, timeAgo } from '@/lib/format';
import { useDebouncedValue } from '@/lib/hooks';
import type { AdminStats, CursorPage, ListingStatus, OwnerListing, Role, User, UserStatus } from '@/lib/types';

type Tab = 'moderation' | 'users';

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('moderation');
  const stats = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: ({ signal }) => api<AdminStats>('/admin/stats', { signal }),
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <PageHeader title="Admin console" description="Moderate listings, verify dealers and manage users." />

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard icon={UsersIcon} tone="sky" label="Buyers" value={stats.data?.users.buyer ?? 0} />
        <StatCard icon={Store} tone="violet" label="Dealers" value={stats.data?.users.seller ?? 0} />
        <StatCard icon={CarFront} tone="brand" label="Live listings" value={stats.data?.listings.active ?? 0} />
        <StatCard
          icon={Clock}
          tone="amber"
          label="Awaiting review"
          value={stats.data?.listings.pending ?? 0}
          highlight={(stats.data?.listings.pending ?? 0) > 0}
        />
        <StatCard icon={CircleCheckBig} tone="emerald" label="Sold" value={stats.data?.listings.sold ?? 0} />
      </div>

      <div className="mt-8 flex gap-1 border-b border-slate-200" role="tablist">
        {(['moderation', 'users'] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              '-mb-px border-b-2 px-4 py-2 text-sm font-medium capitalize',
              tab === t ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800',
            )}
          >
            {t === 'moderation' ? 'Listings' : 'Users'}
          </button>
        ))}
      </div>
      <div className="mt-6">
        {tab === 'users' ? (
          <Users />
        ) : stats.isPending ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : (
          <Moderation counts={stats.data?.listings} />
        )}
      </div>
    </div>
  );
}

const MODERATION_STATUSES: [ListingStatus, string][] = [
  ['pending', 'Awaiting review'],
  ['active', 'Live'],
  ['rejected', 'Rejected'],
  ['inactive', 'Paused'],
  ['sold', 'Sold'],
  ['expired', 'Expired'],
];

function Moderation({ counts }: { counts?: AdminStats['listings'] }) {
  // Open on the review queue when it has work, otherwise on live listings.
  const [status, setStatus] = useState<ListingStatus>(counts && !counts.pending ? 'active' : 'pending');
  const qc = useQueryClient();
  const toast = useToast();
  const [rejecting, setRejecting] = useState<OwnerListing | null>(null);
  const [reason, setReason] = useState('');

  const query = useInfiniteQuery({
    queryKey: ['admin', 'listings', status],
    queryFn: ({ pageParam, signal }) =>
      api<CursorPage<OwnerListing>>('/admin/listings', { query: { status, cursor: pageParam, limit: 20 }, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const takeDown = status === 'active';
  const items = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);

  const act = useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: 'approve' | 'reject'; reason?: string }) =>
      api(`/admin/listings/${id}/${action}`, { method: 'POST', body: action === 'reject' ? { reason } : undefined }),
    onSuccess: (_d, v) => {
      toast(v.action === 'approve' ? 'Listing approved' : 'Listing rejected');
      setRejecting(null);
      setReason('');
      void qc.invalidateQueries({ queryKey: ['admin'] });
      void qc.invalidateQueries({ queryKey: ['listings'] });
    },
    onError: (err) => toast(errorMessage(err), 'error'),
  });

  return (
    <div>
      <Select value={status} onChange={(e) => setStatus(e.target.value as ListingStatus)} className="w-56" aria-label="Status">
        {MODERATION_STATUSES.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
            {counts && ` (${formatNumber(counts[value] ?? 0)})`}
          </option>
        ))}
      </Select>

      <div className="mt-4">
        {query.isError && <ErrorNotice message={errorMessage(query.error)} />}
        {query.isPending ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Car className="size-7" />}
            title={status === 'pending' ? 'Nothing to review' : 'No listings here'}
          />
        ) : (
          <ul className="space-y-3">
            {items.map((l) => (
              <li key={l.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card md:flex-row md:items-center">
                <Link href={`/cars/${l.id}`} target="_blank" className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="h-16 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                    {l.thumbUrl && <img src={l.thumbUrl} alt="" loading="lazy" className="size-full object-cover" />}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{l.title}</p>
                    <p className="text-sm text-slate-600">
                      {formatPriceShort(l.price)} · {l.city} · {l.seller.businessName ?? 'Dealer'}
                    </p>
                    <p className="text-xs text-slate-400">Submitted {timeAgo(l.createdAt)}</p>
                    {l.rejectionReason && <p className="text-xs text-red-600">Rejected: {l.rejectionReason}</p>}
                  </div>
                </Link>
                <div className="flex gap-2">
                  {status === 'pending' && (
                    <Button
                      size="sm"
                      variant="success"
                      loading={act.isPending && act.variables?.id === l.id && act.variables.action === 'approve'}
                      onClick={() => act.mutate({ id: l.id, action: 'approve' })}
                    >
                      Approve
                    </Button>
                  )}
                  {(status === 'pending' || status === 'active') && (
                    <Button size="sm" variant="secondary" className="text-red-600" onClick={() => setRejecting(l)}>
                      {takeDown ? 'Take down' : 'Reject'}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {query.hasNextPage && (
          <div className="mt-6 flex justify-center">
            <Button variant="secondary" onClick={() => query.fetchNextPage()} loading={query.isFetchingNextPage}>
              Load more
            </Button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!rejecting}
        title={`${takeDown ? 'Take down' : 'Reject'} ${rejecting?.title ?? 'listing'}?`}
        description={`${takeDown ? 'The listing is hidden from buyers right away. ' : ''}The dealer sees this reason and can fix the listing and resubmit.`}
        confirmLabel={takeDown ? 'Take down listing' : 'Reject listing'}
        tone="danger"
        loading={act.isPending}
        onConfirm={() => rejecting && reason.trim() && act.mutate({ id: rejecting.id, action: 'reject', reason: reason.trim() })}
        onClose={() => setRejecting(null)}
      >
        <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required)" maxLength={500} aria-label="Rejection reason" />
      </ConfirmDialog>
    </div>
  );
}

function Users() {
  const [q, setQ] = useState('');
  const [role, setRole] = useState<Role | ''>('');
  const debouncedQ = useDebouncedValue(q.trim(), 350);
  const qc = useQueryClient();
  const toast = useToast();

  const query = useInfiniteQuery({
    queryKey: ['admin', 'users', debouncedQ, role],
    queryFn: ({ pageParam, signal }) =>
      api<CursorPage<User>>('/admin/users', {
        query: { q: debouncedQ, role: role || undefined, cursor: pageParam, limit: 25 },
        signal,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const users = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);

  const update = useMutation({
    mutationFn: ({ id, body, path }: { id: string; path: 'status' | 'verification'; body: object }) =>
      api<User>(`/admin/users/${id}/${path}`, { method: 'PATCH', body }),
    onSuccess: () => {
      toast('User updated');
      void qc.invalidateQueries({ queryKey: ['admin'] });
    },
    onError: (err) => toast(errorMessage(err), 'error'),
  });

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email" className="pl-9" aria-label="Search users" />
        </div>
        <Select value={role} onChange={(e) => setRole(e.target.value as Role | '')} className="sm:w-40" aria-label="Role">
          <option value="">All roles</option>
          <option value="buyer">Buyers</option>
          <option value="seller">Dealers</option>
          <option value="admin">Admins</option>
        </Select>
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3">
                  <p className="flex items-center gap-1 font-medium text-slate-900">
                    {u.sellerProfile?.businessName ?? u.name}
                    {u.sellerProfile?.verified && <BadgeCheck className="size-4 text-brand-600" />}
                  </p>
                  <p className="text-xs text-slate-500">{u.email} · {u.phone}</p>
                  {u.sellerProfile && (
                    <p className="text-xs text-slate-500">
                      {u.sellerProfile.branches[0] ? formatAddress(u.sellerProfile.branches[0]) : 'No address yet'}
                      {u.sellerProfile.branches.length > 1 && ` · ${u.sellerProfile.branches.length} branches`}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 capitalize">{u.role === 'seller' ? 'Dealer' : u.role}</td>
                <td className="px-4 py-3 text-slate-500">{formatDate(u.createdAt)}</td>
                <td className="px-4 py-3">
                  <Badge tone={u.status === 'active' ? 'green' : 'red'} className="capitalize">{u.status}</Badge>
                </td>
                <td className="px-4 py-3">
                  {u.role !== 'admin' && (
                    <div className="flex justify-end gap-2">
                      {u.sellerProfile && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => update.mutate({ id: u.id, path: 'verification', body: { verified: !u.sellerProfile!.verified } })}
                        >
                          {u.sellerProfile.verified ? 'Unverify' : 'Verify'}
                        </Button>
                      )}
                      <StatusButton user={u} onChange={(status) => update.mutate({ id: u.id, path: 'status', body: { status } })} />
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {query.isPending && <div className="flex justify-center py-8"><Spinner /></div>}
        {!query.isPending && users.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No users found</p>}
      </div>
      {query.hasNextPage && (
        <div className="mt-6 flex justify-center">
          <Button variant="secondary" onClick={() => query.fetchNextPage()} loading={query.isFetchingNextPage}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}

function StatusButton({ user, onChange }: { user: User; onChange: (status: UserStatus) => void }) {
  const [open, setOpen] = useState(false);
  if (user.status === 'suspended') {
    return (
      <Button size="sm" variant="secondary" onClick={() => onChange('active')}>
        Reactivate
      </Button>
    );
  }
  return (
    <>
      <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => setOpen(true)}>
        Suspend
      </Button>
      <ConfirmDialog
        open={open}
        title={`Suspend ${user.name}?`}
        description="They are signed out everywhere and their live listings are hidden. Reactivating doesn't republish listings."
        confirmLabel="Suspend"
        tone="danger"
        onConfirm={() => {
          onChange('suspended');
          setOpen(false);
        }}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
