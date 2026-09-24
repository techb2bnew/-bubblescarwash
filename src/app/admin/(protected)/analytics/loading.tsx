import { ChartCardSkeleton, PageHeaderSkeleton, TableSkeleton } from "../_components/skeletons";

export default function Loading() {
  return (
    <div className="space-y-8">
      <PageHeaderSkeleton withAction={false} />
      <ChartCardSkeleton />
      <TableSkeleton rows={5} />
    </div>
  );
}
