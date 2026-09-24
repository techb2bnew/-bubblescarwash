import { AdminPageSkeleton } from "../_components/skeletons";

export default function Loading() {
  return <AdminPageSkeleton withAction={false} rows={8} />;
}
