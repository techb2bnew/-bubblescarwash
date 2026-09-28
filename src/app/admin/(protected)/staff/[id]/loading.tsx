import { PageHeaderSkeleton, TableSkeleton } from "../../_components/skeletons";

export default function Loading() {
  return (
    <div className="space-y-4">
      <PageHeaderSkeleton withAction={false} />
      <TableSkeleton rows={13} />
    </div>
  );
}
