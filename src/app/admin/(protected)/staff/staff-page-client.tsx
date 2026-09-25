"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createStaff, deleteStaff, resetStaffPassword, updateStaffDetails, type StaffMember } from "./actions";
import { useConfirmDialog } from "../_components/confirm-dialog";
import { useToast } from "../_components/toast";
import { DeleteButton, EditButton, PermissionsButton } from "../_components/action-icons";

type Modal =
  | "new"
  | { kind: "edit"; member: StaffMember }
  | { kind: "reset"; member: StaffMember }
  | null;

export default function StaffPageClient({
  staff,
  serviceRoleConfigured,
}: {
  staff: StaffMember[];
  serviceRoleConfigured: boolean;
}) {
  const router = useRouter();
  const showToast = useToast();
  const { confirm, dialog } = useConfirmDialog();
  const [modal, setModal] = useState<Modal>(null);

  async function handleDelete(member: StaffMember) {
    if (!(await confirm(`Remove ${member.email}? They'll immediately lose access to the admin panel.`))) return;
    try {
      await deleteStaff(member.id);
      showToast("Staff account removed.");
      router.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Something went wrong", "error");
    }
  }

  return (
    <div className="space-y-4">
      {!serviceRoleConfigured && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Creating, deleting, changing email, or resetting a staff password needs one more setup step — add{" "}
          <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">SUPABASE_SERVICE_ROLE_KEY</code> to
          the environment (Supabase Dashboard → Settings → API → service_role key). Viewing/editing permissions and
          renaming an existing staff account still work without it.
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={() => setModal("new")}
          disabled={!serviceRoleConfigured}
          title={serviceRoleConfigured ? undefined : "Add SUPABASE_SERVICE_ROLE_KEY first"}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          + Add Staff
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Added</th>
              <th className="w-36 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {staff.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50/60">
                <td className="px-4 py-3 font-medium text-gray-900">{s.name || "—"}</td>
                <td className="px-4 py-3 text-gray-600">{s.email}</td>
                <td className="px-4 py-3 text-gray-500">
                  {new Date(s.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <PermissionsButton
                      onClick={() => router.push(`/admin/staff/${s.id}`)}
                      label="Edit permissions"
                    />
                    <EditButton
                      onClick={() => setModal({ kind: "edit", member: s })}
                      label="Edit name/email"
                    />
                    <DeleteButton onClick={() => handleDelete(s)} label="Remove staff" />
                  </div>
                </td>
              </tr>
            ))}
            {staff.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-gray-400">
                  No staff accounts yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modal === "new" && (
        <CreateStaffModal
          onClose={() => setModal(null)}
          onCreated={() => {
            setModal(null);
            router.refresh();
          }}
        />
      )}

      {modal && typeof modal === "object" && modal.kind === "edit" && (
        <EditStaffModal
          member={modal.member}
          serviceRoleConfigured={serviceRoleConfigured}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            router.refresh();
          }}
          onResetPassword={() => setModal({ kind: "reset", member: modal.member })}
        />
      )}

      {modal && typeof modal === "object" && modal.kind === "reset" && (
        <ResetPasswordModal member={modal.member} onClose={() => setModal(null)} />
      )}

      {dialog}
    </div>
  );
}

function CreateStaffModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const showToast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createStaff({ email, password, name });
      showToast("Staff account created.");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Add a staff account</h2>
          <button onClick={onClose} aria-label="Close" className="text-xl leading-none text-gray-400 hover:text-gray-600">
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Name (optional)</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Priya Sharma"
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="staff@example.com"
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Password</label>
            <input
              type="text"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">Share this with them directly — it&apos;s set now, not emailed.</p>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? "Creating..." : "Create Staff Account"}
          </button>
          <p className="text-xs text-gray-500">
            New accounts start with no access — turn on the pages/actions they need from their permissions page
            after creating them.
          </p>
        </form>
      </div>
    </div>
  );
}

function EditStaffModal({
  member,
  serviceRoleConfigured,
  onClose,
  onSaved,
  onResetPassword,
}: {
  member: StaffMember;
  serviceRoleConfigured: boolean;
  onClose: () => void;
  onSaved: () => void;
  onResetPassword: () => void;
}) {
  const showToast = useToast();
  const [name, setName] = useState(member.name ?? "");
  const [email, setEmail] = useState(member.email);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emailChanged = email.trim().toLowerCase() !== member.email;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await updateStaffDetails(member.id, { name, email });
      showToast("Staff details updated.");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Edit staff details</h2>
          <button onClick={onClose} aria-label="Close" className="text-xl leading-none text-gray-400 hover:text-gray-600">
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Priya Sharma"
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
            {emailChanged && !serviceRoleConfigured && (
              <p className="mt-1 text-xs text-amber-600">
                Changing the email needs SUPABASE_SERVICE_ROLE_KEY set up first.
              </p>
            )}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <button
            type="button"
            onClick={onResetPassword}
            disabled={!serviceRoleConfigured}
            title={serviceRoleConfigured ? undefined : "Add SUPABASE_SERVICE_ROLE_KEY first"}
            className="w-full rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Reset Password Instead
          </button>
        </form>
      </div>
    </div>
  );
}

function ResetPasswordModal({ member, onClose }: { member: StaffMember; onClose: () => void }) {
  const showToast = useToast();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setSaving(true);
    try {
      await resetStaffPassword(member.id, password);
      showToast(`Password reset for ${member.email}.`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Reset password</h2>
          <button onClick={onClose} aria-label="Close" className="text-xl leading-none text-gray-400 hover:text-gray-600">
            ×
          </button>
        </div>
        <p className="mb-3 text-sm text-gray-500">For {member.email}</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">New password</label>
            <input
              type="text"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Confirm password</label>
            <input
              type="text"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter the password"
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Set New Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
