import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/db';

type StaffInvite = {
  inviteId?: string;
  vendorId?: string;
  vendorName?: string;
  staffName?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  role?: string;
  permissions?: string[];
  status?: 'pending' | 'accepted' | 'cancelled' | 'expired';
  inviteCode?: string;
  inviteUrl?: string;
  invitedBy?: string;
  invitedByEmail?: string;
  createdAt?: unknown;
  expiresAt?: unknown;
  acceptedAt?: unknown;
};

const StaffInviteAcceptPage = () => {
  const { inviteCode } = useParams<{ inviteCode: string }>();

  const [invite, setInvite] = useState<StaffInvite | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadInvite = async () => {
      if (!inviteCode) {
        setError('Invite code is missing.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError('');

        const inviteRef = doc(db, 'staff_invites', inviteCode);
        const inviteSnap = await getDoc(inviteRef);

        if (!inviteSnap.exists()) {
          setError('Staff invite was not found.');
          setInvite(null);
          return;
        }

        const data = inviteSnap.data() as StaffInvite;

        setInvite({
          ...data,
          inviteId: data.inviteId || inviteSnap.id,
        });
      } catch (err: any) {
        console.error('[STAFF INVITE LOAD ERROR]', err);
        setError(err?.message || 'Failed to load staff invite.');
      } finally {
        setLoading(false);
      }
    };

    loadInvite();
  }, [inviteCode]);

  const status = invite?.status || 'pending';
  const isPending = status === 'pending';

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <section className="mx-auto max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <div className="mb-6 border-b border-slate-800 pb-4">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-orange-400">
            seiGEN Commerce Staff Invite
          </p>
          <h1 className="mt-2 text-2xl font-black text-white">Staff Invitation</h1>
          <p className="mt-2 text-sm text-slate-400">
            Review your staff invite details before accepting access.
          </p>
        </div>

        {loading && (
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
            Loading staff invite...
          </div>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-red-800 bg-red-950/40 p-4 text-sm text-red-200">
            {error}
          </div>
        )}

        {!loading && invite && (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Vendor</p>
              <p className="mt-1 text-lg font-black text-white">
                {invite.vendorName || 'Vendor Store'}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                  Staff Name
                </p>
                <p className="mt-1 font-bold text-white">{invite.staffName || 'Not provided'}</p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Role</p>
                <p className="mt-1 font-bold text-white">{invite.role || 'staff'}</p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                  Invite Code
                </p>
                <p className="mt-1 font-mono text-sm font-bold text-orange-300">
                  {invite.inviteCode || inviteCode}
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Status</p>
                <p className="mt-1 font-bold uppercase text-white">{status}</p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                Permissions
              </p>

              {invite.permissions && invite.permissions.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {invite.permissions.map((permission) => (
                    <span
                      key={permission}
                      className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-bold text-slate-300"
                    >
                      {permission}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-400">No permissions listed.</p>
              )}
            </div>

            {!isPending && (
              <div className="rounded-xl border border-yellow-700 bg-yellow-950/40 p-4 text-sm text-yellow-200">
                This invite is currently marked as <strong>{status}</strong>. Only pending invites
                can be accepted.
              </div>
            )}

            {isPending && (
              <div className="rounded-xl border border-orange-700 bg-orange-950/30 p-4">
                <p className="text-sm text-orange-100">
                  This invite is valid and ready for staff account setup. In the next step, we will
                  connect this page to create or link the staff login account.
                </p>
              </div>
            )}

            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <Link
                to="/register"
                className="rounded-xl bg-orange-600 px-4 py-3 text-center text-xs font-black uppercase tracking-widest text-white hover:bg-orange-500"
              >
                Create Account
              </Link>

              <Link
                to="/login"
                className="rounded-xl border border-slate-700 px-4 py-3 text-center text-xs font-black uppercase tracking-widest text-slate-200 hover:bg-slate-800"
              >
                Login
              </Link>

              <Link
                to="/"
                className="rounded-xl border border-slate-700 px-4 py-3 text-center text-xs font-black uppercase tracking-widest text-slate-400 hover:bg-slate-800"
              >
                Back Home
              </Link>
            </div>
          </div>
        )}
      </section>
    </main>
  );
};

export default StaffInviteAcceptPage;
