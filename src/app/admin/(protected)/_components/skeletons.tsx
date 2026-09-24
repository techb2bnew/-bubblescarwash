/**
 * Shared loading-state building blocks for every admin route's `loading.tsx`.
 * Next.js renders these instantly on navigation (before the page's async
 * Server Component data fetch resolves) — see the App Router `loading.js`
 * convention. Kept generic/composable rather than one bespoke skeleton per
 * page, since almost every admin page is either "header + table" or
 * "header + cards", and a close approximation beats a blank screen or a
 * bare spinner without maintaining N near-identical layouts.
 */

function Block({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-gray-200 ${className ?? ""}`} />;
}

export function PageHeaderSkeleton({ withAction = true }: { withAction?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="space-y-2">
        <Block className="h-7 w-44" />
        <Block className="h-4 w-72" />
      </div>
      {withAction && <Block className="h-9 w-36 shrink-0" />}
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      <Block className="h-10 w-full max-w-md" />
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-100 bg-gray-50 p-3">
          <Block className="h-4 w-full max-w-xs" />
        </div>
        <div className="divide-y divide-gray-100">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4">
              <Block className="h-4 flex-1" />
              <Block className="h-4 w-24" />
              <Block className="h-4 w-20" />
              <Block className="h-6 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Default shape for a list/CRUD admin page: title + action button + a table. */
export function AdminPageSkeleton({ rows = 6, withAction = true }: { rows?: number; withAction?: boolean }) {
  return (
    <div className="space-y-4">
      <PageHeaderSkeleton withAction={withAction} />
      <TableSkeleton rows={rows} />
    </div>
  );
}

export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-2 rounded-lg border border-gray-200 bg-white p-4">
          <Block className="h-8 w-16" />
          <Block className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

export function ChartCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={`rounded-lg border border-gray-200 bg-white p-4 ${className ?? ""}`}>
      <Block className="mb-4 h-4 w-32" />
      <Block className="h-56 w-full" />
    </div>
  );
}

/** Dashboard: stat cards up top, a couple of chart cards below. */
export function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <PageHeaderSkeleton withAction={false} />
      <StatCardsSkeleton />
      <div className="grid gap-4 md:grid-cols-2">
        <ChartCardSkeleton />
        <ChartCardSkeleton />
      </div>
    </div>
  );
}

/** Calendar-style page: a big calendar/embed panel beside a narrower side panel. */
export function CalendarPageSkeleton() {
  return (
    <div className="space-y-4">
      <PageHeaderSkeleton withAction={false} />
      <div className="flex flex-col gap-4 lg:flex-row">
        <Block className="h-[70vh] max-h-[720px] min-h-[420px] flex-1" />
        <Block className="h-[70vh] max-h-[720px] min-h-[420px] w-full lg:w-96" />
      </div>
    </div>
  );
}

/** A form-heavy settings page (Set Operations, Permissions): title + a few stacked panels. */
export function PanelListSkeleton({ panels = 4 }: { panels?: number }) {
  return (
    <div className="space-y-4">
      <PageHeaderSkeleton withAction={false} />
      <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
        {Array.from({ length: panels }).map((_, i) => (
          <div key={i} className="p-4">
            <Block className="h-5 w-40" />
          </div>
        ))}
      </div>
    </div>
  );
}
