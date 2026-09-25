export default function HomePage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen gap-6 p-8">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-blue-600 mb-2">KIDDO</h1>
        <p className="text-xl text-gray-600">Bog&apos;cha boshqaruv tizimi</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md w-full">
        <p className="text-center text-gray-500 mb-6">
          O&apos;zbekiston bog&apos;chalari uchun oddiy va qulay platforma
        </p>

        <a
          href="/login"
          className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-xl transition-colors"
        >
          Tizimga kirish
        </a>
      </div>

      <p className="text-sm text-gray-400">
        KIDDO &copy; {new Date().getFullYear()}
      </p>
    </main>
  );
}
