export function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200 mt-auto">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-center space-y-2 text-sm text-gray-600">
          <div className="flex items-center space-x-4">
            <span>Created by</span>
            <span className="font-medium text-gray-900">Dennis Diaz</span>
          </div>
          <div className="flex items-center space-x-2">
            <span>Contact:</span>
            <a
              href="mailto:dennis.diaz.tech@gmail.com"
              className="text-blue-600 hover:text-blue-800 hover:underline"
            >
              dennis.diaz.tech@gmail.com
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
