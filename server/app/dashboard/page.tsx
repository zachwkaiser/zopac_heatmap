import { auth, signOut } from '@/auth';

export default async function DashboardPage() {
  const session = await auth();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-4 rounded-lg bg-gray-50 p-8">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-gray-600">
          Welcome, {session?.user?.name || session?.user?.email}!
        </p>
        <p className="text-sm text-gray-500">
          You have successfully logged in.
        </p>
        <form
          action={async () => {
            'use server';
            await signOut();
          }}
        >
          <button
            type="submit"
            className="w-full rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
          >
            Sign Out
          </button>
        </form>
      </div>
    </main>
  );
}
