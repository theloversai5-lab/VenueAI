import { getAdminStats, getAdminUserList } from "@/lib/admin";

export default async function AdminPage() {
  const [stats, users] = await Promise.all([getAdminStats(), getAdminUserList()]);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total users" value={stats.totalUsers.toString()} />
        <StatCard label="Total API cost" value={`$${stats.totalApiCostUsd.toFixed(2)}`} />
        <StatCard label="Total revenue (5×)" value={`$${stats.totalRevenueUsd.toFixed(2)}`} />
      </div>

      <div className="glass-card mt-8 overflow-x-auto rounded-xl">
        <table className="w-full text-left text-sm">
          <thead className="text-[color:var(--text-muted)]">
            <tr>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Credits</th>
              <th className="px-4 py-3">API cost</th>
              <th className="px-4 py-3">Charged</th>
              <th className="px-4 py-3">Joined</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-white/10">
                <td className="px-4 py-3">{u.email}</td>
                <td className="px-4 py-3">{u.phoneNumber ?? "—"}</td>
                <td className="px-4 py-3">{u.companyName ?? "—"}</td>
                <td className="px-4 py-3">{u.balanceCredits}</td>
                <td className="px-4 py-3">${Number(u.lifetimeApiCostUsd).toFixed(2)}</td>
                <td className="px-4 py-3">{u.lifetimeChargedCredits}</td>
                <td className="px-4 py-3">{new Date(u.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-card rounded-xl p-5">
      <p className="text-sm text-[color:var(--text-muted)]">{label}</p>
      <p className="heading-font text-3xl text-loverai-gold">{value}</p>
    </div>
  );
}
