import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, uploadWithProgress } from '@/lib/api';
import type { CursorPage, ListingDetail, ListingStatus, MediaItem, OwnerListing, SellerStats, User } from '@/lib/types';
import { useAuth } from '../auth/AuthContext';

export const sellerKeys = {
  all: ['seller'] as const,
  listings: (status?: ListingStatus) => ['seller', 'listings', status ?? 'all'] as const,
  stats: ['seller', 'stats'] as const,
  listing: (id: string) => ['seller', 'listing', id] as const,
};

export function useMyListings(status?: ListingStatus) {
  return useInfiniteQuery({
    queryKey: sellerKeys.listings(status),
    queryFn: ({ pageParam, signal }) =>
      api<CursorPage<OwnerListing>>('/listings/mine', { query: { status, cursor: pageParam, limit: 20 }, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useSellerStats() {
  return useQuery({
    queryKey: sellerKeys.stats,
    queryFn: ({ signal }) => api<SellerStats>('/listings/mine/stats', { signal }),
  });
}

export function useOwnedListing(id: string | undefined) {
  return useQuery({
    queryKey: sellerKeys.listing(id ?? ''),
    queryFn: ({ signal }) => api<ListingDetail>(`/listings/mine/${id}`, { signal }),
    enabled: !!id,
    staleTime: 0,
  });
}

export interface ListingInput {
  makeSlug: string;
  modelSlug: string;
  variant?: string | null;
  year: number;
  kmDriven: number;
  fuelType: string;
  transmission: string;
  bodyType?: string | null;
  ownerCount: number;
  color?: string | null;
  price: number;
  negotiable: boolean;
  registrationState?: string | null;
  insuranceValidTill?: string | null;
  description?: string | null;
  features: string[];
  branchId: string;
  imageIds: string[];
  publish?: boolean;
}

/** Any seller write invalidates the dashboard and public listing caches. */
function useInvalidateListings() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: sellerKeys.all }),
      qc.invalidateQueries({ queryKey: ['listings'] }),
      qc.invalidateQueries({ queryKey: ['sellers'] }),
    ]);
}

export interface BranchInput {
  name: string;
  addressLine: string;
  locality?: string;
  city: string;
  state: string;
  pincode: string;
  phone?: string;
  lat?: number;
  lng?: number;
}

/** The API returns the updated account, which is where the dealer's branches live. */
export function useSaveBranch(id?: string) {
  const { setUser } = useAuth();
  const invalidate = useInvalidateListings();
  return useMutation({
    mutationFn: (input: BranchInput) =>
      id
        ? api<User>(`/me/branches/${id}`, { method: 'PUT', body: input })
        : api<User>('/me/branches', { method: 'POST', body: input }),
    onSuccess: (user) => {
      setUser(user);
      return invalidate();
    },
  });
}

export function useRemoveBranch() {
  const { setUser } = useAuth();
  const invalidate = useInvalidateListings();
  return useMutation({
    mutationFn: (id: string) => api<User>(`/me/branches/${id}`, { method: 'DELETE' }),
    onSuccess: (user) => {
      setUser(user);
      return invalidate();
    },
  });
}

export function useSaveListing(id?: string) {
  const invalidate = useInvalidateListings();
  return useMutation({
    mutationFn: (input: ListingInput) =>
      id
        ? api<OwnerListing>(`/listings/${id}`, { method: 'PATCH', body: input })
        : api<OwnerListing>('/listings', { method: 'POST', body: input }),
    onSuccess: invalidate,
  });
}

export type ListingAction = 'publish' | 'deactivate' | 'mark-sold' | 'delete';

export function useListingAction() {
  const invalidate = useInvalidateListings();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: ListingAction }): Promise<OwnerListing | void> =>
      action === 'delete'
        ? api<void>(`/listings/${id}`, { method: 'DELETE' })
        : api<OwnerListing>(`/listings/${id}/${action}`, { method: 'POST' }),
    onSuccess: invalidate,
  });
}

/** Uploads in batches of 10 (the API limit) and reports overall progress. */
export async function uploadImages(files: Blob[], onProgress?: (fraction: number) => void): Promise<MediaItem[]> {
  const results: MediaItem[] = [];
  for (let i = 0; i < files.length; i += 10) {
    const batch = files.slice(i, i + 10);
    const form = new FormData();
    batch.forEach((file, j) => form.append('files', file, `photo-${i + j}.jpg`));
    const uploaded = await uploadWithProgress<MediaItem[]>('/media/images', form, (f) =>
      onProgress?.((i + f * batch.length) / files.length),
    );
    results.push(...uploaded);
  }
  onProgress?.(1);
  return results;
}
