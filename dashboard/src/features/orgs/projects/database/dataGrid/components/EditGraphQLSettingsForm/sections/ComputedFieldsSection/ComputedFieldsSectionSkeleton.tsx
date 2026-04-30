import { Skeleton } from '@/components/ui/v3/skeleton';

const SKELETON_KEYS = ['first', 'second'];

export default function ComputedFieldsSectionSkeleton() {
  return (
    <div className="flex flex-col gap-4 px-6 pb-4">
      <div className="box grid grid-flow-row gap-4 overflow-hidden rounded-lg border-1 py-4">
        <div className="grid grid-flow-col place-content-between gap-3 px-4">
          <div className="grid grid-flow-row gap-1">
            <h2 className="font-semibold text-lg">Computed Fields</h2>
            <p className="text-muted-foreground text-sm+">
              Expose function results as virtual columns in the GraphQL API.
            </p>
          </div>
        </div>
        <div className="grid gap-2 px-4">
          {SKELETON_KEYS.map((key) => (
            <Skeleton key={`computed-field-skeleton-${key}`} className="h-12" />
          ))}
          <Skeleton className="h-10 border-dashed" />
        </div>
      </div>
    </div>
  );
}
